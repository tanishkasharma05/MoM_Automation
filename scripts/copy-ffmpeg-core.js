// Copies the FFmpeg WASM core from node_modules into public/ffmpeg so it's
// served as a same-origin static asset. Runs automatically before every
// build (see package.json "prebuild" script) — this keeps the ~32MB binary
// out of git entirely; it's regenerated fresh on every install/deploy from
// the @ffmpeg/core npm dependency instead.
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const destDir = path.join(root, 'public', 'ffmpeg');

const targets = [
  {
    label: 'single-threaded (fallback, works everywhere)',
    srcDir: path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm'),
    destSubdir: path.join(destDir, 'st'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm'],
  },
  {
    label: 'multi-threaded (fast, needs cross-origin isolation headers)',
    srcDir: path.join(root, 'node_modules', '@ffmpeg', 'core-mt', 'dist', 'esm'),
    destSubdir: path.join(destDir, 'mt'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js'],
  },
];

for (const target of targets) {
  if (!existsSync(target.srcDir)) {
    console.error(`[copy-ffmpeg-core] missing package for ${target.label} — did npm install run?`);
    process.exit(1);
  }
  mkdirSync(target.destSubdir, { recursive: true });
  for (const file of target.files) {
    copyFileSync(path.join(target.srcDir, file), path.join(target.destSubdir, file));
    console.log(`[copy-ffmpeg-core] copied ${file} -> public/ffmpeg/${path.basename(target.destSubdir)}/ (${target.label})`);
  }
}
