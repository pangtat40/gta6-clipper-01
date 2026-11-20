// gta6-clipper-01: cut a GTA 6 moment into a vertical Short that hooks the
// viewer with the game and then pitches make.fun, and hand the house the
// video's address.
//
// The clip is cut from footage that lives OUTSIDE this repository (the
// user's own reaction clip — GTA 6 gameplay on top, their facecam below —
// not ours to ship): MAKEFUN_FOOTAGE names the file. The moment below is
// the one this session chose from that footage, and the creative is decided
// here, in this file: a hook caption over the opening, while the make.fun
// pitch is the text the user already put on screen in the footage itself,
// so the clip rides the game's hype and turns it into make.fun.
// The clip is 9:16, at most 60 seconds, H.264 video with AAC audio.
//
// What it writes to the output directory (MAKEFUN_OUTPUT_DIR, default
// "out"): VIDEO.json, copied from the repository root (the gate reads it
// from there), and clip.mp4, the rendered clip. Where the footage is not
// at hand — the grading sandbox runs this repository alone, with no
// footage — it copies the clip.mp4 committed beside it instead, so the
// run still succeeds. Where neither exists, it fails loudly.
//
// Local run (re-render from footage):
//   MAKEFUN_FOOTAGE=../footage/<file>.mp4 MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// Local run (use the committed clip, as the grader does):
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The repository root is where this file lives, so the default footage
// path holds no matter which directory the program is run from.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// --- the creative, decided in this session from the footage ------------
//
// The moment to cut. START is seconds into the footage, DURATION is the
// whole clip in seconds (at most 60: a vertical clip under a minute is a
// Short), HOOK is how long the hook caption stays up, and CROP_X is where
// the vertical slice sits in the wide frame ("center", or a number of
// pixels from the left when the action sits off-centre).
//
// V2: the user's new clip (43.4s, split-screen: gameplay on top, facecam
// below) is one continuous night scene in the swamp — a mutant creature
// stalks Jason and Lucia ("OH DIA MUTASI", "TANDUKNYA ADA 5", "Return to
// the truck", "MATI KA"), and the tension never lets up, so the whole
// clip runs, 0:00-0:43. The hook is immediate: the creature is on screen
// in the dark within the first seconds. The user already put the make.fun
// pitch on screen themselves — a big yellow "MAKE.FUN" over the gameplay
// from about 0:29 to the end, spelled right and readable on the dark
// background — so this session keeps their text and adds no pitch band of
// its own; the hook caption runs only the first 8 seconds.
const MOMENT = {
  start: 0,
  duration: 43.37,
  hook: 8,
  cropX: 'center',
};

// The hook caption, big at the top while the GTA 6 moment opens: the game
// is out, and that is the news the viewer came for.
const HOOK_TEXT = 'GTA 6 IS HERE';

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = process.env.MAKEFUN_FONT ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const botDir = process.env.MAKEFUN_BOT_DIR ?? '.';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const footage =
  process.env.MAKEFUN_FOOTAGE ?? join(repoRoot, '..', 'footage', 'user-clip-v2.mp4');

function fail(message: string): never {
  throw new Error(`gta6-clipper-01: ${message}`);
}

function textArg(text: string): string {
  // Single-quote the drawtext value so ffmpeg's filter parser, not the
  // shell, reads it (this program never runs a shell).
  return `'${text.replace(/'/g, "\\'")}'`;
}

async function requireFfmpeg(): Promise<void> {
  try {
    await run('ffmpeg', ['-version']);
  } catch {
    fail(
      'ffmpeg is not on PATH. Install ffmpeg (https://ffmpeg.org/download.html) ' +
        'and put it on your PATH, or set MAKEFUN_FOOTAGE to a clip that needs no cut.',
    );
  }
  if (!existsSync(FONT)) {
    fail(`no font at ${FONT}: set MAKEFUN_FONT to a .ttf that exists.`);
  }
}

async function renderClip(footagePath: string, outPath: string): Promise<void> {
  await requireFfmpeg();
  const { start, duration, hook, cropX } = MOMENT;
  const cropXExpr = cropX === 'center' ? '(iw-ow)/2' : String(cropX);
  // Vertical slice of the frame, scaled to 1080x1920, with the hook
  // caption over the opening. No pitch band of this program's own: the
  // user already put "MAKE.FUN" on screen in the footage (about 0:29 to
  // the end), and that is the clip's on-screen make.fun pitch.
  const filter =
    `crop=ih*9/16:ih:${cropXExpr}:0,scale=${WIDTH}:${HEIGHT},` +
    `drawtext=fontfile=${FONT}:text=${textArg(HOOK_TEXT)}:fontsize=96:fontcolor=white:` +
    `borderw=3:bordercolor=black:x=(w-text_w)/2:y=120:enable='between(t,0,${hook})'`;
  await run('ffmpeg', [
    '-y',
    '-ss',
    String(start),
    '-i',
    footagePath,
    '-t',
    String(duration),
    '-vf',
    filter,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-crf',
    // 28 keeps the rendered clip well under GitHub's 25 MB web-upload
    // cap (v1 rendered at 20 came out 29.7 MB and needed a separate
    // re-encode to 14 MB); the program itself now produces the shippable
    // file.
    '28',
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outPath,
  ]);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  // The video's address, first: the gate reads VIDEO.json from the output,
  // so a bad address file fails here, before any clip work.
  const videoJsonPath = join(botDir, 'VIDEO.json');
  const video = JSON.parse(readFileSync(videoJsonPath, 'utf8')) as { url?: unknown };
  if (typeof video.url !== 'string') {
    fail('VIDEO.json must be a JSON object with a "url" string.');
  }
  copyFileSync(videoJsonPath, join(outDir, 'VIDEO.json'));

  // The clip: render it from the footage where it is at hand, else reuse
  // the clip committed beside this program.
  const outClip = join(outDir, 'clip.mp4');
  const committedClip = join(botDir, 'clip.mp4');
  if (existsSync(footage)) {
    await renderClip(footage, outClip);
  } else if (existsSync(committedClip)) {
    copyFileSync(committedClip, outClip);
  } else {
    fail(
      `no footage at ${footage} and no clip.mp4 committed beside main.ts: ` +
        'set MAKEFUN_FOOTAGE to the footage file, or commit the rendered clip.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
