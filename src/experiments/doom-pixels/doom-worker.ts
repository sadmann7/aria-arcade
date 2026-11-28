import { downsample, rowsFor } from "./resolution";

interface DoomModule {
  FS: { writeFile(path: string, data: Uint8Array | string): void };
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  callMain(args: string[]): number;
  _wadsmith_run_frame(): void;
  _wadsmith_frame_count(): number;
  _wadsmith_frame_rgba(): number;
  _wadsmith_frame_width(): number;
  _wadsmith_frame_height(): number;
  _wadsmith_key(pressed: number, key: number): void;
  _wadsmith_set_paused(paused: number): void;
  _wadsmith_game_state(): number;
  _wadsmith_audio_init(sampleRate: number): void;
  _wadsmith_audio_render(frames: number): number;
  _wadsmith_set_sound(volume: number, muted: number): void;
}

type CreateDoom = (options: {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
}) => Promise<DoomModule>;

export type DoomRequest =
  | {
      type: "start";
      engineBase: string;
      columns: number;
      sampleRate: number;
      audioPort: MessagePort | null;
    }
  | { type: "resolution"; columns: number }
  | { type: "drawn" }
  | { type: "key"; isPressed: boolean; key: number }
  | { type: "pause"; isPaused: boolean }
  | { type: "hidden"; isHidden: boolean }
  | { type: "sound"; isMuted: boolean };

export type DoomResponse =
  | {
      type: "frame";
      buffer: ArrayBuffer;
      columns: number;
      rows: number;
      engineFrame: number;
    }
  | { type: "error"; message: string };

const scope = self as unknown as Worker;
const frameMs = 1000 / 60;

const engineConfig = `fullscreen 0
use_vsync 0
uncapped 1
fpslimit 0
widescreen 0
current_video_height 400
dynamic_resolution 0
screenblocks 10
screen_melt 0
show_endoom 0
disk_icon 0
grabmouse 0
hud_crosshair 0
show_messages 1
autorun 0
novert 1
freelook 0
autosave 0
snd_module 0
snd_channels 8
snd_limiter 0
pitched_sounds 0
full_sounds 0
extra_music 0
`;

let doom: DoomModule | null = null;
let columns = 0;
let isReady = true;
let sentFrame = -1;
const levelState = 0;
let gameState = -1;
let isPaused = false;
let isHidden = false;
let isMuted = false;
const soundVolume = 8;
const audioBlockFrames = 512;
const audioBlocksAhead = 4;
const audioPumpMs = 4;
const errors: string[] = [];

scope.addEventListener("message", (event: MessageEvent<DoomRequest>) => {
  const request = event.data;
  if (request.type === "start") {
    columns = request.columns;
    start(request).catch((error: unknown) =>
      post({
        type: "error",
        message:
          errors.findLast((line) => line.trim()) ??
          (error instanceof Error ? error.message : String(error)),
      }),
    );
    return;
  }
  if (request.type === "resolution") {
    columns = request.columns;
    sentFrame = -1;
    isReady = true;
  }
  if (request.type === "pause") isPaused = request.isPaused;
  if (request.type === "hidden") isHidden = request.isHidden;
  if (request.type === "sound") isMuted = request.isMuted;
  if (!doom) return;
  if (request.type === "drawn") {
    isReady = true;
    sendFrame(doom);
  } else if (request.type === "key") {
    doom._wadsmith_key(request.isPressed ? 1 : 0, request.key);
  } else if (request.type === "sound") {
    applySound(doom);
  } else if (request.type === "pause" || request.type === "hidden") {
    doom._wadsmith_set_paused(isPaused || isHidden ? 1 : 0);
    // Pausing does nothing between levels, so a hidden tab mutes too.
    applySound(doom);
  }
});

const missingEngineMessage =
  "The Doom engine isn't built in this checkout. Run pnpm setup:engine, then reload.";

async function start({
  engineBase,
  sampleRate,
  audioPort,
}: Extract<DoomRequest, { type: "start" }>) {
  // The build writes engine.json last, so it only exists once every file does.
  const built = await fetch(`${engineBase}engine.json`, { method: "HEAD" });
  if (!built.ok) throw new Error(missingEngineMessage);
  const [{ default: createDoom }, base, wad] = await Promise.all([
    import(
      /* turbopackIgnore: true */ /* webpackIgnore: true */ `${engineBase}woof.js`
    ) as Promise<{ default: CreateDoom }>,
    fetchBytes(`${engineBase}woof.pk3`),
    fetchBytes(`${engineBase}freedoom-0.13.0.wad.gz`).then(gunzip),
  ]);
  const engine = await createDoom({
    print: () => {},
    printErr: (line) => errors.push(line),
  });
  engine.FS.writeFile("/freedoom2.wad", wad);
  engine.FS.writeFile("/woof.pk3", base);
  engine.FS.writeFile("/woof.cfg", engineConfig);
  if (audioPort) engine._wadsmith_audio_init(sampleRate);
  engine.callMain([
    "-iwad",
    "/freedoom2.wad",
    "-warp",
    "1",
    "-skill",
    "3",
    "-nogui",
    "-config",
    "/woof.cfg",
    ...(audioPort ? [] : ["-nosound", "-nomusic", "-nosfx"]),
  ]);
  doom = engine;
  if (audioPort) {
    applySound(engine);
    pumpAudio(engine, audioPort);
  }
  setInterval(runFrame, frameMs);
}

function runFrame() {
  if (!doom) return;
  doom._wadsmith_run_frame();
  const state = doom._wadsmith_game_state();
  // Pausing only takes while a level runs, so a pause asked for on another
  // screen waits for the next level.
  if (state !== gameState && state === levelState && (isPaused || isHidden)) {
    doom._wadsmith_set_paused(1);
  }
  gameState = state;
  sendFrame(doom);
}

// One frame waits for the page to draw the last, so a slow page drops frames
// rather than falling behind the game.
function sendFrame(engine: DoomModule) {
  const frame = engine._wadsmith_frame_count();
  if (!isReady || frame === sentFrame) return;
  isReady = false;
  sentFrame = frame;
  const width = engine._wadsmith_frame_width();
  const height = engine._wadsmith_frame_height();
  const start = engine._wadsmith_frame_rgba();
  const rgba = engine.HEAPU8.subarray(start, start + width * height * 4);
  const rows = rowsFor(columns);
  const colors = downsample(rgba, width, height, columns, rows);
  post(
    {
      type: "frame",
      buffer: colors.buffer,
      columns,
      rows,
      engineFrame: frame,
    },
    [colors.buffer],
  );
}

function applySound(engine: DoomModule) {
  engine._wadsmith_set_sound(soundVolume, isMuted || isHidden ? 1 : 0);
}

function pumpAudio(engine: DoomModule, port: MessagePort) {
  let sent = 0;
  let played = 0;
  port.addEventListener("message", (event: MessageEvent<number>) => {
    played = event.data;
  });
  port.start();
  setInterval(() => {
    while (sent - played < audioBlockFrames * audioBlocksAhead) {
      const channels = renderAudio(engine, audioBlockFrames);
      port.postMessage(
        channels,
        channels.map((channel) => channel.buffer),
      );
      sent += audioBlockFrames;
    }
  }, audioPumpMs);
}

function renderAudio(engine: DoomModule, frames: number) {
  const start = engine._wadsmith_audio_render(frames) >> 2;
  const samples = engine.HEAPF32;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    left[index] = samples[start + index * 2] ?? 0;
    right[index] = samples[start + index * 2 + 1] ?? 0;
  }
  return [left, right];
}

async function fetchBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} is missing.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function gunzip(data: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function post(message: DoomResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer);
}
