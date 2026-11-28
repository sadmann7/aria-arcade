interface DoomModule {
  FS: { writeFile(path: string, data: Uint8Array | string): void };
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  UTF8ToString(pointer: number): string;
  callMain(args: string[]): number;
  _wadsmith_run_frame(): void;
  _wadsmith_frame_count(): number;
  _wadsmith_frame_rgba(): number;
  _wadsmith_frame_width(): number;
  _wadsmith_frame_height(): number;
  _wadsmith_key(pressed: number, key: number): void;
  _wadsmith_set_paused(paused: number): void;
  _doom_grid_tic(): number;
  _doom_grid_snapshot(): number;
  _doom_grid_lines(): number;
  _doom_grid_walk(x: number, y: number): void;
  _doom_grid_walk_state(): number;
  _doom_grid_stop(): void;
  _doom_grid_press_use(): void;
  _wadsmith_game_state(): number;
  _doom_grid_fire(id: number): number;
  _doom_grid_use(line: number): number;
  _doom_grid_set_speed(percent: number): void;
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
      sampleRate: number;
      audioPort: MessagePort | null;
    }
  | { type: "path"; points: { x: number; y: number }[] }
  | { type: "stop" }
  | { type: "fire"; id: number }
  | { type: "use"; line: number }
  | { type: "continue" }
  | { type: "weapon"; key: string }
  | { type: "speed"; percent: number }
  | { type: "pause"; isPaused: boolean }
  | { type: "hidden"; isHidden: boolean }
  | { type: "sound"; isMuted: boolean };

export type DoomResponse =
  | {
      type: "frame";
      buffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | { type: "snapshot"; json: string; lines: string | null }
  | { type: "intermission" }
  | { type: "error"; message: string };

const scope = self as unknown as Worker;
const frameMs = 1000 / 60;

const engineConfig = `fullscreen 0
use_vsync 0
uncapped 1
fpslimit 0
widescreen 0
current_video_height 200
dynamic_resolution 0
screenblocks 10
screen_melt 0
show_endoom 0
disk_icon 0
grabmouse 0
hud_crosshair 0
show_messages 1
show_pickup_messages 1
autorun 0
novert 1
freelook 0
player_bobbing 1
autosave 0
snd_module 0
snd_channels 8
snd_limiter 0
pitched_sounds 0
full_sounds 0
extra_music 0
`;

let doom: DoomModule | null = null;
let lastTic = -1;
let lastLevel = -1;
let path: { x: number; y: number }[] = [];
const walkArrived = 2;
const walkMoving = 1;
const keyTapMs = 120;
const intermissionState = 1;
const levelState = 0;
let gameState = -1;
let speed = 100;
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
  if (request.type === "speed") speed = request.percent;
  if (request.type === "pause") isPaused = request.isPaused;
  if (request.type === "hidden") isHidden = request.isHidden;
  if (request.type === "sound") isMuted = request.isMuted;
  if (!doom) return;
  const engine = doom;
  if (request.type === "path") {
    path = request.points;
    walkNext(engine);
  } else if (request.type === "stop") {
    path = [];
    engine._doom_grid_stop();
  } else if (request.type === "fire") engine._doom_grid_fire(request.id);
  else if (request.type === "use") engine._doom_grid_use(request.line);
  else if (request.type === "continue") engine._doom_grid_press_use();
  else if (request.type === "weapon") {
    const key = request.key.charCodeAt(0);
    engine._wadsmith_key(1, key);
    setTimeout(() => engine._wadsmith_key(0, key), keyTapMs);
  } else if (request.type === "speed") {
    engine._doom_grid_set_speed(request.percent);
  } else if (request.type === "sound") applySound(engine);
  else {
    engine._wadsmith_set_paused(isPaused || isHidden ? 1 : 0);
    // Pausing does nothing between levels, so a hidden tab mutes too.
    if (request.type === "hidden") applySound(engine);
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
  engine._doom_grid_set_speed(speed);
  if (audioPort) {
    applySound(engine);
    pumpAudio(engine, audioPort);
  }
  setInterval(runFrame, frameMs);
}

function walkNext(engine: DoomModule) {
  const next = path.shift();
  if (next) engine._doom_grid_walk(next.x, next.y);
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
  if (state !== gameState && state === intermissionState) {
    post({ type: "intermission" });
  }
  gameState = state;
  const walk = doom._doom_grid_walk_state();
  if (walk === walkArrived && path.length > 0) walkNext(doom);
  else if (walk !== walkMoving) path = [];
  sendFrame(doom);
  const tic = doom._doom_grid_tic();
  if (tic === lastTic) return;
  lastTic = tic;
  const json = doom.UTF8ToString(doom._doom_grid_snapshot());
  const level = levelOf(json);
  const lines =
    level === lastLevel ? null : doom.UTF8ToString(doom._doom_grid_lines());
  lastLevel = level;
  post({ type: "snapshot", json, lines });
}

function levelOf(json: string) {
  return Number(/"level":(\d+)/.exec(json)?.[1] ?? -1);
}

function sendFrame(module: DoomModule) {
  const width = module._wadsmith_frame_width();
  const height = module._wadsmith_frame_height();
  const start = module._wadsmith_frame_rgba();
  const pixels = module.HEAPU8.slice(start, start + width * height * 4);
  post({ type: "frame", buffer: pixels.buffer, width, height }, [
    pixels.buffer,
  ]);
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
