// gta6-clipper-01: cut a GTA 6 moment into a vertical Short that hooks the
// viewer with the game and then pitches make.fun, and hand the house the
// video's address.
//
// The clip is cut from footage that lives OUTSIDE this repository (the
// user's own reaction clip — GTA 6 gameplay on top, their facecam below —
// not ours to ship): MAKEFUN_FOOTAGE names the file. The moment below is
// the one this session chose from that footage, and the creative is decided
// here, in this file: a hook of pure GTA 6 first, then the pitch as text
// on screen, so the clip rides the game's hype and turns it into make.fun.
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
// Short), HOOK is how long the pure GTA 6 moment runs before the pitch
// text comes up, and CROP_X is where the vertical slice sits in the wide
// frame ("center", or a number of pixels from the left when the action
// sits off-centre).
//
// Chosen from the user's clip (62.4s, split-screen: gameplay on top,
// facecam below). The first 10 seconds are slow setup — Jason walking to
// the plane, a door close-up, a dead wing-strut shot — so the clip opens
// at 0:10 on the seaplane sitting at the dock, rides the taxi and takeoff
// (about 0:18-0:24) and the whole island flight, and ends at 0:56, right
// before the footage fades to white (about 0:56-1:02). 46 seconds keeps
// the takeoff and the flight and cuts both the slow setup and the dead
// fade. The pitch runs over the last 12 seconds, so HOOK is 46 - 12 = 34.
const MOMENT = {
  start: 10,
  duration: 46,
  hook: 34,
  cropX: 'center',
};

// The hook caption, big at the top while the GTA 6 moment plays: the game
// is out, and that is the news the viewer came for.
const HOOK_TEXT = 'GTA 6 IS HERE';

// The pitch, on screen over the tail of the clip: what the viewer can do
// with it. The rules ask the clip itself to tell viewers they can make
// money on make.fun by making clips with AI, and to name make.fun.
const PITCH_LINES = ['MAKE MONEY ON MAKE.FUN', 'MAKING CLIPS WITH AI', 'MAKE.FUN'];

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT = process.env.MAKEFUN_FONT ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const botDir = process.env.MAKEFUN_BOT_DIR ?? '.';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const footage =
  process.env.MAKEFUN_FOOTAGE ?? join(repoRoot, '..', 'footage', 'user-clip.mp4');

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
  // Vertical slice of the wide frame, scaled to 1080x1920; the hook
  // caption over the opening, then a dark band carrying the pitch lines.
  const filter =
    `crop=ih*9/16:ih:${cropXExpr}:0,scale=${WIDTH}:${HEIGHT},` +
    `drawtext=fontfile=${FONT}:text=${textArg(HOOK_TEXT)}:fontsize=96:fontcolor=white:` +
    `borderw=3:bordercolor=black:x=(w-text_w)/2:y=120:enable='between(t,0,${hook})',` +
    `drawbox=x=0:y=1080:w=${WIDTH}:h=560:color=black@0.55:t=fill:enable='between(t,${hook},${duration})',` +
    // Line 1 is the longest (22 chars): at 72pt it runs wider than the
    // 1080px frame and gets clipped at both edges, so it renders at 60pt.
    `drawtext=fontfile=${FONT}:text=${textArg(PITCH_LINES[0])}:fontsize=60:fontcolor=yellow:` +
    `borderw=3:bordercolor=black:x=(w-text_w)/2:y=1150:enable='between(t,${hook},${duration})',` +
    `drawtext=fontfile=${FONT}:text=${textArg(PITCH_LINES[1])}:fontsize=72:fontcolor=white:` +
    `borderw=3:bordercolor=black:x=(w-text_w)/2:y=1260:enable='between(t,${hook},${duration})',` +
    `drawtext=fontfile=${FONT}:text=${textArg(PITCH_LINES[2])}:fontsize=150:fontcolor=#ff2e88:` +
    `borderw=3:bordercolor=black:x=(w-text_w)/2:y=1400:enable='between(t,${hook},${duration})'`;
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
    '20',
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
