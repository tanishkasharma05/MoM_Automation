// Real FFmpeg (compiled to WebAssembly), not the browser's AudioContext.
//
// The old implementation used AudioContext.decodeAudioData(), which loads
// the ENTIRE recording into a single decoded PCM Float32Array before doing
// anything else. For multi-hour recordings that's several GB of RAM, and
// the browser eventually throws "Unable to decode audio data" — the tab
// runs out of memory before Groq ever sees a byte.
//
// FFmpeg's segment muxer instead streams the input, transcodes, and writes
// chunk files incrementally — it never holds the whole decoded signal in
// memory at once. It also runs off the main thread (ffmpeg.wasm spins up
// a Web Worker internally), so the UI doesn't freeze during processing.
//
// Chunks are also SIZE-targeted, not duration-targeted: we transcode to a
// fixed, known bitrate (32kbps mono MP3 — plenty for speech, and what
// Whisper effectively works with internally anyway), so segment duration
// can be computed directly from Groq's ~25MB request limit instead of
// guessing a fixed minute count that breaks for different source formats.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const TARGET_BYTES_PER_CHUNK = 18 * 1024 * 1024; // stay well under Groq's ~25MB cap
const OUTPUT_BITRATE_KBPS = 32; // mono, speech-optimized — small and plenty clear for Whisper
const OUTPUT_BYTES_PER_SEC = (OUTPUT_BITRATE_KBPS * 1000) / 8;
const SEGMENT_SECONDS = Math.floor(TARGET_BYTES_PER_CHUNK / OUTPUT_BYTES_PER_SEC);

const LOAD_TIMEOUT_MS = 20000; // if the fast core hasn't loaded by then, stop waiting and fall back

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

async function loadMultiThreaded(ffmpeg) {
  // The official-recommended pattern: fetch each core file ourselves and
  // hand ffmpeg.wasm blob: URLs, rather than plain paths. Letting the
  // library resolve the worker script's own path internally is a known
  // source of silent hangs on some self-hosted setups — blob URLs sidestep
  // that resolution entirely.
  const base = '/ffmpeg/mt';
  const [coreURL, wasmURL, workerURL] = await Promise.all([
    toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript'),
  ]);
  await ffmpeg.load({ coreURL, wasmURL, workerURL });
}

async function loadSingleThreaded(ffmpeg) {
  const base = '/ffmpeg/st';
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  ]);
  await ffmpeg.load({ coreURL, wasmURL });
}

async function getFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      // Multi-threaded WASM (several x faster — uses multiple CPU threads)
      // requires SharedArrayBuffer, which browsers only expose on pages
      // serving Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy
      // headers. Not every host has those configured, so we detect it and
      // fall back to the single-threaded core rather than breaking.
      const canUseMultiThread = typeof window !== 'undefined' && window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';

      if (canUseMultiThread) {
        onProgress?.('Loading audio engine (fast mode)...');
        const ffmpeg = new FFmpeg();
        try {
          await withTimeout(loadMultiThreaded(ffmpeg), LOAD_TIMEOUT_MS, 'Fast audio engine timed out');
          ffmpegInstance = ffmpeg;
          return ffmpeg;
        } catch (e) {
          console.warn('Multi-threaded FFmpeg failed to load, falling back to single-threaded:', e);
          try { ffmpeg.terminate(); } catch { /* already dead */ }
        }
      }

      onProgress?.('Loading audio engine...');
      const ffmpeg = new FFmpeg();
      await loadSingleThreaded(ffmpeg);
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
}

// Splits the given file into an ordered array of small MP3/audio chunk Files.
// Chunks are read off FFmpeg's virtual filesystem and deleted immediately
// after reading, so peak memory stays roughly constant regardless of how
// long the source recording is.
//
// SPEED: the old implementation always fully DECODED and RE-ENCODED the
// entire file (even a 2-hour mp3), which is by far the slowest part of the
// whole pipeline — CPU-bound transcoding work done in WASM. Most uploads
// are already compressed (mp3/m4a/webm/ogg), so we now try a fast "stream
// copy" split first: FFmpeg's segment muxer just slices the existing
// compressed bytes at segment boundaries, no decode/encode at all. This is
// typically 5-15x faster. If the container/codec can't be segment-copied
// cleanly (rare — e.g. some raw/uncompressed formats), we transparently
// fall back to the original decode+re-encode path.
export async function splitAudioIntoChunks(file, onProgress) {
  const ffmpeg = await getFFmpeg(onProgress);

  onProgress?.('Preparing audio for splitting...');
  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.dat');
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const onFFmpegProgress = ({ progress }) => {
    if (typeof progress === 'number' && progress >= 0 && progress <= 1) {
      onProgress?.(`Splitting audio... ${Math.round(progress * 100)}%`);
    }
  };

  let usedCopy = false;
  try {
    onProgress?.('Analyzing audio...');
    const duration = await probeDurationSeconds(ffmpeg, inputName);

    if (duration && duration > 0) {
      // Actual average bitrate of the source file — lets us size copy
      // segments to land under Groq's cap without re-encoding.
      const bytesPerSecond = file.size / duration;
      const copySegmentSeconds = Math.max(30, Math.floor(TARGET_BYTES_PER_CHUNK / bytesPerSecond));

      onProgress?.('Splitting audio (fast mode)...');
      ffmpeg.on('progress', onFFmpegProgress);
      try {
        await ffmpeg.exec([
          '-i', inputName,
          '-c', 'copy',
          '-f', 'segment',
          '-segment_time', String(copySegmentSeconds),
          '-reset_timestamps', '1',
          'chunk_%03d' + (inputName.match(/\.\w+$/)?.[0] || '.mp3'),
        ]);
        usedCopy = true;
      } finally {
        ffmpeg.off('progress', onFFmpegProgress);
      }
    }
  } catch (e) {
    console.warn('Fast stream-copy split failed, falling back to re-encode:', e);
    usedCopy = false;
  }

  const chunkExt = usedCopy ? (inputName.match(/\.\w+$/)?.[0] || '.mp3') : '.mp3';

  if (!usedCopy) {
    // Fallback: original decode + re-encode path (slower, but works for
    // any input FFmpeg can decode, regardless of container/codec).
    onProgress?.('Splitting audio...');
    ffmpeg.on('progress', onFFmpegProgress);
    try {
      await ffmpeg.exec([
        '-i', inputName,
        '-ac', '1',
        '-ar', '16000',
        '-b:a', `${OUTPUT_BITRATE_KBPS}k`,
        '-f', 'segment',
        '-segment_time', String(SEGMENT_SECONDS),
        '-reset_timestamps', '1',
        'chunk_%03d.mp3',
      ]);
    } finally {
      ffmpeg.off('progress', onFFmpegProgress);
    }
  }

  await ffmpeg.deleteFile(inputName);

  // FFmpeg's virtual FS doesn't support directory listing in this build,
  // so read sequentially until a chunk index is missing. Reads/deletes are
  // cheap in-memory virtual-FS ops (not the slow part — the transcode
  // above was), so sequential here is fine and keeps things simple.
  const mimeType = usedCopy ? guessMimeType(chunkExt) : 'audio/mpeg';
  const chunks = [];
  for (let i = 0; ; i++) {
    const name = `chunk_${String(i).padStart(3, '0')}${chunkExt}`;
    let data;
    try {
      data = await ffmpeg.readFile(name);
    } catch {
      break; // no more chunks
    }
    chunks.push(new File([data.buffer], name, { type: mimeType }));
    await ffmpeg.deleteFile(name); // free the virtual FS copy immediately
    onProgress?.(`Prepared chunk ${chunks.length}...`);
    if (chunks.length > 500) break; // sanity bound
  }

  return chunks;
}

// Runs a metadata-only pass (no output file) so FFmpeg prints the source
// Duration to its log without decoding/transcoding a single frame — this
// is near-instant even for multi-hour files.
async function probeDurationSeconds(ffmpeg, inputName) {
  return new Promise((resolve) => {
    let duration = null;
    const onLog = ({ message }) => {
      const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(message || '');
      if (m) {
        duration = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
      }
    };
    ffmpeg.on('log', onLog);
    // '-i' with no output errors out by design — we only need the log line
    // it prints on the way there, so the rejection is expected and ignored.
    ffmpeg.exec(['-i', inputName]).catch(() => {}).finally(() => {
      ffmpeg.off('log', onLog);
      resolve(duration);
    });
  });
}

function guessMimeType(ext) {
  const map = {
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
    '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.opus': 'audio/opus',
    '.wav': 'audio/wav', '.aac': 'audio/aac', '.flac': 'audio/flac',
  };
  return map[ext] || 'audio/mpeg';
}

// Call this as soon as you know a large file will need splitting (e.g. on
// file selection, before the user clicks "process") so the ~few-second
// WASM engine load overlaps with whatever the user does next instead of
// sitting on the critical path once processing actually starts. Safe to
// call multiple times — subsequent calls reuse the same in-flight/loaded
// instance.
export function preloadFFmpeg() {
  return getFFmpeg().catch((e) => console.warn('FFmpeg preload failed (will retry on demand):', e));
}
