import { normalizeMoM } from './mom';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
// Optional: one or more free Groq keys (console.groq.com) enable file-upload
// transcription via Groq's hosted Whisper. Without any, uploaded-file
// transcription is skipped and only live-recording transcription (browser
// Web Speech API) works.
//
// Multiple keys: set VITE_GROQ_API_KEY as a comma-separated list
// (e.g. "gsk_abc...,gsk_def...,gsk_ghi...") OR set VITE_GROQ_API_KEY,
// VITE_GROQ_API_KEY_2, VITE_GROQ_API_KEY_3, ... individually — both forms
// are supported and merged together. Each free Groq account gets its own
// rate/quota limit, so spreading load across keys multiplies your effective
// transcription throughput.
function loadGroqKeys() {
  const keys = [];
  const primary = import.meta.env.VITE_GROQ_API_KEY;
  if (primary) keys.push(...primary.split(',').map((k) => k.trim()).filter(Boolean));

  for (let i = 2; i <= 10; i++) {
    const extra = import.meta.env[`VITE_GROQ_API_KEY_${i}`];
    if (extra) keys.push(extra.trim());
  }
  return [...new Set(keys)]; // dedupe in case the same key was listed twice
}

const GROQ_API_KEYS = loadGroqKeys();
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const GROQ_SIZE_LIMIT = 24 * 1024 * 1024; // stay safely under Groq's ~25MB request cap

// Round-robins across keys so parallel chunk uploads spread across accounts
// from the start, rather than all hammering key[0] until it 429s.
let keyCursor = 0;
function nextKeyIndex() {
  const i = keyCursor % GROQ_API_KEYS.length;
  keyCursor++;
  return i;
}

function isRateLimitOrQuotaError(status) {
  return status === 429 || status === 402 || status === 403;
}

async function transcribeWithKey(file, apiKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3-turbo');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`Transcription failed: ${errText || response.statusText}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  return data.text;
}

// Tries each Groq key in turn (starting from a rotating offset), moving on
// to the next key only when the current one is actually rate-limited/out of
// quota (429/402/403). Other errors (bad audio, network) fail immediately
// instead of silently burning through every key.
async function transcribeSingleFile(file) {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error(
      'File transcription needs a free Groq API key. Get one at console.groq.com and set VITE_GROQ_API_KEY in your .env — or use Live Recording instead, which transcribes in-browser for free.'
    );
  }

  const startOffset = nextKeyIndex();
  let lastErr;

  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    const key = GROQ_API_KEYS[(startOffset + attempt) % GROQ_API_KEYS.length];
    try {
      return await transcribeWithKey(file, key);
    } catch (err) {
      lastErr = err;
      if (!isRateLimitOrQuotaError(err.status)) throw err; // real failure, don't burn other keys on it
      // else: this key is exhausted/rate-limited — fall through and try the next one
    }
  }

  throw new Error(
    `All ${GROQ_API_KEYS.length} Groq API key(s) are rate-limited or out of quota. ${lastErr?.message || ''}`
  );
}

// Runs async tasks with at most `limit` running concurrently, preserving
// the original order of results — a small worker pool instead of either
// fully sequential (slow) or unbounded Promise.all (can hit rate limits).
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

export async function transcribeAudio(audioFile, onProgress) {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error(
      'File transcription needs a free Groq API key. Get one at console.groq.com and set VITE_GROQ_API_KEY in your .env — or use Live Recording instead, which transcribes in-browser for free.'
    );
  }

  if (audioFile.size <= GROQ_SIZE_LIMIT) {
    return transcribeSingleFile(audioFile);
  }

  // File is too large for a single request — split it with real FFmpeg
  // (streams the input, never holds the whole recording in memory) into
  // small chunks, then transcribe several chunks in parallel and stitch
  // the results back together in the original order.
  onProgress?.('Splitting large audio file into chunks...');
  const { splitAudioIntoChunks } = await import('./audioChunk');
  const chunks = await splitAudioIntoChunks(audioFile, onProgress);

  let completed = 0;
  // Scale parallel Whisper calls with the number of Groq keys available —
  // each key has its own rate limit, so more keys can sustain more
  // concurrent requests. Capped at 6 to stay a reasonable, well-behaved client.
  const CONCURRENCY = Math.min(6, Math.max(3, GROQ_API_KEYS.length * 2));
  const transcripts = await runWithConcurrency(chunks, CONCURRENCY, async (chunk) => {
    const text = await transcribeSingleFile(chunk);
    completed++;
    onProgress?.(`Transcribed ${completed} of ${chunks.length} parts...`);
    return text;
  });

  return transcripts.join(' ');
}

export async function generateMoM(transcript, meetingTitle, department, extra = {}) {
  const { meetingDate, attendees, agenda, notes } = extra;

  const contextLines = [
    `Meeting Title: ${meetingTitle}`,
    department && `Department: ${department}`,
    meetingDate && `Meeting Date: ${meetingDate}`,
    attendees?.length && `Known Attendees (provided by the organizer — merge with any others mentioned in the transcript): ${attendees.join(', ')}`,
    agenda?.length && `Planned Agenda Topics (provided by the organizer): ${agenda.join('; ')}`,
    notes && `Additional Context From Organizer: ${notes}`,
  ].filter(Boolean).join('\n');

  const prompt = `You are an expert meeting secretary. Based on the following meeting transcript and organizer-provided context, generate a professional and structured Minutes of Meeting (MoM).

${contextLines}

Transcript:
${transcript}

Generate a MoM with these sections:
1. Meeting Overview
2. Attendees (combine the organizer-provided attendees above with anyone else mentioned in the transcript, deduplicated)
3. Key Discussion Points (use the planned agenda topics above as a guide for what to look for in the transcript, but only include what was actually discussed)
4. Decisions Made
5. Action Items — for each one, infer as much as you can from the transcript
6. Next Steps
7. Risks & Concerns raised during the meeting, if any
8. Follow-up Items that need attention before the next meeting, if any
9. Next Meeting — a date, timeframe, or topic for the next meeting if one was mentioned

Format the output as clean JSON with these keys: overview, attendees, discussion_points, decisions, action_items, next_steps, risks_concerns, follow_up_items, next_meeting.

If a section has nothing to report, return an empty array (or empty string for next_meeting) rather than inventing content — do not write placeholder text like "Not specified" inside the field itself; just leave it empty and the UI will handle it.

action_items must be an array of objects, not plain strings. Each object must have exactly these keys:
- "text": string — a clear, concise description of the task
- "assignee": string — the person responsible, inferred from the transcript, or "Unassigned" if not mentioned
- "due_date": string — a deadline inferred from the transcript (e.g. "2026-07-20", "next Friday", "tomorrow"), or "" if no deadline was mentioned

Example: "action_items": [{"text": "Change the oil", "assignee": "Ashok Bajaj", "due_date": "tomorrow"}]`;

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error('MoM generation failed');
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return normalizeMoM(parsed);
}

export async function generateMoMFromText(transcript, meetingTitle, department, extra) {
  return generateMoM(transcript, meetingTitle, department, extra);
}

// --- AI Notes ---
// Lighter-weight than generateMoM: no meeting structure, just pulls a title,
// a short summary, and the important points (decisions, action items,
// questions, ideas) out of a raw voice note transcript.

function normalizeHighlights(val) {
  const arr = Array.isArray(val) ? val : val ? [val] : [];
  const allowed = new Set(['important', 'action', 'decision', 'question', 'idea']);
  return arr.map((h) => {
    if (typeof h === 'string') return { type: 'important', text: h };
    const type = allowed.has(h?.type) ? h.type : 'important';
    return { type, text: h?.text || h?.point || JSON.stringify(h) };
  }).filter((h) => h.text);
}

export async function generateNoteHighlights(transcript, existingTitle = '') {
  const prompt = `You are an assistant that turns a raw voice-note transcript into a quick, skimmable note.

Transcript:
${transcript}

Return clean JSON with these keys:
- "title": a short (max 8 words) descriptive title for this note${existingTitle ? ` (the user already suggested: "${existingTitle}" — reuse it unless the transcript clearly suggests something better)` : ''}
- "summary": 1-3 sentence plain-language summary of what was said
- "tags": array of 1-5 short topic tags (single words or short phrases)
- "highlights": array of objects, each { "type", "text" }, where "type" is one of "important", "action", "decision", "question", "idea" and "text" is a concise (under ~20 words) point pulled from the transcript. Only include what's actually said — do not invent content. Return an empty array if nothing stands out.

Prioritize genuinely important or actionable points over restating everything that was said.`;

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error('Note analysis failed');
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    title: (typeof parsed.title === 'string' && parsed.title.trim()) || existingTitle || 'Untitled Note',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
    highlights: normalizeHighlights(parsed.highlights),
  };
}
