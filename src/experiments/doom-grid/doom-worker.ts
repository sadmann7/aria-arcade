interface DoomModule {
  FS: { writeFile(path: string, data: Uint8Array | string): void };
  HEAPU8: Uint8Array;
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
}

type CreateDoom = (options: {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
}) => Promise<DoomModule>;

export type DoomRequest =
  | { type: "start"; engineBase: string }
  | { type: "path"; points: { x: number; y: number }[] }
  | { type: "stop" }
  | { type: "fire"; id: number }
  | { type: "use"; line: number }
  | { type: "continue" }
  | { type: "weapon"; key: string }
  | { type: "speed"; percent: number }
  | { type: "pause"; isPaused: boolean };

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
let hasStartedLevel = false;
let gameState = -1;
let speed = 100;
let isPaused = false;
const errors: string[] = [];

scope.addEventListener("message", (event: MessageEvent<DoomRequest>) => {
  const request = event.data;
  if (request.type === "start") {
    start(request.engineBase).catch((error: unknown) =>
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
  } else engine._wadsmith_set_paused(request.isPaused ? 1 : 0);
});

async function start(engineBase: string) {
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
    "-nosound",
    "-nomusic",
    "-nosfx",
  ]);
  doom = engine;
  engine._doom_grid_set_speed(speed);
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
  // Pausing only takes once a level runs, so a pause asked for while loading
  // waits for it.
  if (!hasStartedLevel && state === levelState) {
    hasStartedLevel = true;
    if (isPaused) doom._wadsmith_set_paused(1);
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
