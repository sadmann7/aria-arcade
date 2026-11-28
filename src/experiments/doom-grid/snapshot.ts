export interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  armor: number;
  weapon: number;
  weapons: number;
  keys: number;
  dead: boolean;
  ammo: number[];
  maxAmmo: number[];
}

export interface Monster {
  id: number;
  type: number;
  x: number;
  y: number;
  health: number;
  isAlive: boolean;
  isVisible: boolean;
}

export interface Item {
  id: number;
  type: number;
  x: number;
  y: number;
}

export interface Door {
  line: number;
  x: number;
  y: number;
  open: number;
  isMoving: boolean;
  key: number;
  sector: number;
}

export type WalkState = "idle" | "moving" | "arrived" | "blocked";

export interface Snapshot {
  tic: number;
  level: number;
  map: number;
  player: Player;
  monsters: Monster[];
  items: Item[];
  doors: Door[];
  walk: { seq: number; state: WalkState };
  shots: number;
  isFiring: boolean;
  message: { seq: number; text: string };
  kills: number;
  totalKills: number;
}

export type LineKind = "wall" | "door" | "exit";

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: LineKind;
  index: number;
}

interface RawSnapshot {
  tic: number;
  level: number;
  map: number;
  player: Omit<Player, "dead"> & { dead: number };
  monsters: [number, number, number, number, number, number, number][];
  items: [number, number, number, number][];
  doors: [number, number, number, number, number, number, number][];
  walk: [number, number];
  shots: number;
  firing: number;
  message: [number, string];
  kills: number;
  totalKills: number;
}

const walkStates: WalkState[] = ["idle", "moving", "arrived", "blocked"];
const lineKinds: Record<number, LineKind> = { 1: "wall", 2: "door", 3: "exit" };

export function parseSnapshot(json: string): Snapshot | null {
  const raw = JSON.parse(json) as RawSnapshot | null;
  if (!raw) return null;
  return {
    tic: raw.tic,
    level: raw.level,
    map: raw.map,
    player: { ...raw.player, dead: raw.player.dead !== 0 },
    monsters: raw.monsters.map(([id, type, x, y, health, alive, visible]) => ({
      id,
      type,
      x,
      y,
      health,
      isAlive: alive !== 0,
      isVisible: visible !== 0,
    })),
    items: raw.items.map(([id, type, x, y]) => ({ id, type, x, y })),
    doors: raw.doors.map(([line, x, y, open, moving, key, sector]) => ({
      line,
      x,
      y,
      open,
      isMoving: moving !== 0,
      key,
      sector,
    })),
    walk: { seq: raw.walk[0], state: walkStates[raw.walk[1]] ?? "idle" },
    shots: raw.shots,
    isFiring: raw.firing !== 0,
    message: { seq: raw.message[0], text: raw.message[1] },
    kills: raw.kills,
    totalKills: raw.totalKills,
  };
}

export function parseLines(json: string): Line[] {
  const raw = JSON.parse(json) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ][];
  return raw.map(([x1, y1, x2, y2, kind, index]) => ({
    x1,
    y1,
    x2,
    y2,
    kind: lineKinds[kind] ?? "wall",
    index,
  }));
}
