export const WIDTH = 10;
export const HEIGHT = 20;

export type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];

export interface Point {
  row: number;
  col: number;
}

export interface Cell extends Point {
  id: string;
  pieceId: number;
}

export interface Falling extends Point {
  id: number;
  kind: Kind;
  rotation: number;
}

export interface Batch {
  size: number;
  cleared: number;
}

export type Status = "playing" | "over";

export interface Game {
  cells: Cell[];
  kinds: Record<number, Kind>;
  visited: string[];
  rowBatch: (number | null)[];
  batches: Record<number, Batch>;
  falling: Falling | null;
  next: Kind;
  bag: Kind[];
  seed: number;
  nextId: number;
  score: number;
  lines: number;
  status: Status;
}

const SHAPES: Record<Kind, { size: number; cells: [number, number][] }> = {
  I: {
    size: 4,
    cells: [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  },
  O: {
    size: 2,
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  T: {
    size: 3,
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  },
  S: {
    size: 3,
    cells: [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
  },
  Z: {
    size: 3,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  },
  J: {
    size: 3,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  },
  L: {
    size: 3,
    cells: [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  },
};

const KICKS: [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [0, -2],
  [0, 2],
];

const LINE_POINTS = [0, 100, 300, 500, 800];

export function shapeOf(kind: Kind, rotation: number): Point[] {
  const { size, cells } = SHAPES[kind];
  const turns = ((rotation % 4) + 4) % 4;
  return cells.map(([row, col]) => {
    let point = { row, col };
    for (let turn = 0; turn < turns; turn++) {
      point = { row: point.col, col: size - 1 - point.row };
    }
    return point;
  });
}

export function cellsOf(piece: Falling): Point[] {
  return shapeOf(piece.kind, piece.rotation).map((point) => ({
    row: piece.row + point.row,
    col: piece.col + point.col,
  }));
}

function random(seed: number) {
  const next = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(next ^ (next >>> 15), next | 1);
  value = (value + Math.imul(value ^ (value >>> 7), value | 61)) ^ value;
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, seed: next };
}

function draw(bag: Kind[], seed: number) {
  let pool = bag;
  let state = seed;
  if (pool.length === 0) {
    const rolls = KINDS.map((kind) => {
      const roll = random(state);
      state = roll.seed;
      return { kind, key: roll.value };
    });
    pool = rolls.sort((a, b) => a.key - b.key).map((roll) => roll.kind);
  }
  const [kind = "I", ...rest] = pool;
  return { kind, bag: rest, seed: state };
}

export function spawnPoint(kind: Kind): Point {
  const { size } = SHAPES[kind];
  return {
    row: kind === "I" ? -1 : 0,
    col: Math.floor((WIDTH - size) / 2),
  };
}

export function createGame(seed = Date.now()): Game {
  const first = draw([], seed);
  const second = draw(first.bag, first.seed);
  const game: Game = {
    cells: [],
    kinds: {},
    visited: [],
    rowBatch: Array.from({ length: HEIGHT }, () => null),
    batches: {},
    falling: null,
    next: second.kind,
    bag: second.bag,
    seed: second.seed,
    nextId: 1,
    score: 0,
    lines: 0,
    status: "playing",
  };
  return spawn(game, first.kind);
}

export function isBlocked(game: Game, points: Point[]) {
  return points.some(
    (point) =>
      point.col < 0 ||
      point.col >= WIDTH ||
      point.row < 0 ||
      point.row >= HEIGHT ||
      game.cells.some(
        (cell) => cell.row === point.row && cell.col === point.col,
      ),
  );
}

function spawn(game: Game, kind: Kind): Game {
  const falling: Falling = {
    id: game.nextId,
    kind,
    rotation: 0,
    ...spawnPoint(kind),
  };
  if (isBlocked(game, cellsOf(falling))) {
    return { ...game, falling: null, status: "over" };
  }
  return { ...game, falling, nextId: game.nextId + 1 };
}

export function level(game: Pick<Game, "lines">) {
  return Math.floor(game.lines / 10) + 1;
}

export function fallInterval(currentLevel: number) {
  return Math.max(80, Math.round(800 * 0.85 ** (currentLevel - 1)));
}

function shift(game: Game, rows: number, cols: number): Game | null {
  if (game.status !== "playing" || !game.falling) return null;
  const moved = {
    ...game.falling,
    row: game.falling.row + rows,
    col: game.falling.col + cols,
  };
  if (isBlocked(game, cellsOf(moved))) return null;
  return { ...game, falling: moved };
}

export function move(game: Game, cols: number): Game {
  return shift(game, 0, cols) ?? game;
}

export function rotate(game: Game, turns: 1 | -1): Game {
  if (game.status !== "playing" || !game.falling) return game;
  if (game.falling.kind === "O") return game;
  for (const [rows, cols] of KICKS) {
    const turned = {
      ...game.falling,
      rotation: (game.falling.rotation + turns + 4) % 4,
      row: game.falling.row + rows,
      col: game.falling.col + cols,
    };
    if (!isBlocked(game, cellsOf(turned))) return { ...game, falling: turned };
  }
  return game;
}

export function armedRows(game: Pick<Game, "cells">) {
  const counts = new Map<number, number>();
  for (const cell of game.cells) {
    counts.set(cell.row, (counts.get(cell.row) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count === WIDTH)
    .map(([row]) => row)
    .sort((a, b) => b - a);
}

function lock(game: Game): Game {
  if (!game.falling) return game;
  const piece = game.falling;
  const before = new Set(armedRows(game));
  const cells = [
    ...game.cells,
    ...cellsOf(piece).map((point, index) => ({
      ...point,
      id: `${piece.id}-${index}`,
      pieceId: piece.id,
    })),
  ];
  const armed = armedRows({ cells }).filter((row) => !before.has(row));
  const rowBatch = [...game.rowBatch];
  const batches = { ...game.batches };
  if (armed.length > 0) {
    batches[piece.id] = { size: armed.length, cleared: 0 };
    for (const row of armed) rowBatch[row] = piece.id;
  }
  const upcoming = draw(game.bag, game.seed);
  return spawn(
    {
      ...game,
      cells,
      kinds: { ...game.kinds, [piece.id]: piece.kind },
      rowBatch,
      batches,
      falling: null,
      next: upcoming.kind,
      bag: upcoming.bag,
      seed: upcoming.seed,
    },
    game.next,
  );
}

export function tick(game: Game): Game {
  if (game.status !== "playing") return game;
  return shift(game, 1, 0) ?? lock(game);
}

export function softDrop(game: Game): Game {
  const moved = shift(game, 1, 0);
  if (!moved) return tick(game);
  return { ...moved, score: moved.score + 1 };
}

export function dropDistance(game: Game) {
  if (!game.falling) return 0;
  let distance = 0;
  while (
    !isBlocked(
      game,
      cellsOf({ ...game.falling, row: game.falling.row + distance + 1 }),
    )
  ) {
    distance++;
  }
  return distance;
}

export function ghostOf(game: Game): Falling | null {
  if (!game.falling) return null;
  return { ...game.falling, row: game.falling.row + dropDistance(game) };
}

export function hardDrop(game: Game): Game {
  if (game.status !== "playing" || !game.falling) return game;
  const distance = dropDistance(game);
  return lock({
    ...game,
    falling: { ...game.falling, row: game.falling.row + distance },
    score: game.score + distance * 2,
  });
}

function clearRow(game: Game, row: number): Game {
  const batchId = game.rowBatch[row] ?? null;
  const batch = batchId === null ? undefined : game.batches[batchId];
  const cleared = batch ? batch.cleared + 1 : 1;
  const points =
    ((LINE_POINTS[Math.min(cleared, 4)] ?? 0) -
      (LINE_POINTS[Math.min(cleared - 1, 4)] ?? 0)) *
    level(game);
  const removed = new Set(
    game.cells.filter((cell) => cell.row === row).map((cell) => cell.id),
  );
  const cells = game.cells
    .filter((cell) => !removed.has(cell.id))
    .map((cell) => (cell.row < row ? { ...cell, row: cell.row + 1 } : cell));
  const rowBatch = [
    null,
    ...game.rowBatch.slice(0, row),
    ...game.rowBatch.slice(row + 1),
  ];
  const batches = { ...game.batches };
  if (batchId !== null && batch) {
    if (cleared >= batch.size) delete batches[batchId];
    else batches[batchId] = { ...batch, cleared };
  }
  const falling =
    game.falling && cellsOf(game.falling).every((point) => point.row < row)
      ? { ...game.falling, row: game.falling.row + 1 }
      : game.falling;
  return {
    ...game,
    cells,
    falling,
    rowBatch,
    batches,
    visited: game.visited.filter((id) => !removed.has(id)),
    score: game.score + points,
    lines: game.lines + 1,
  };
}

export interface VisitResult {
  game: Game;
  cleared: number[];
}

export function visit(game: Game, cellId: string): VisitResult {
  if (game.status !== "playing" || game.visited.includes(cellId)) {
    return { game, cleared: [] };
  }
  const cell = game.cells.find((candidate) => candidate.id === cellId);
  if (!cell || !armedRows(game).includes(cell.row)) {
    return { game, cleared: [] };
  }
  const visited = [...game.visited, cellId];
  const isRowDone = game.cells
    .filter((candidate) => candidate.row === cell.row)
    .every((candidate) => visited.includes(candidate.id));
  const next = { ...game, visited };
  if (!isRowDone) return { game: next, cleared: [] };
  return { game: clearRow(next, cell.row), cleared: [cell.row] };
}

export function unvisitedArmed(game: Game) {
  const armed = new Set(armedRows(game));
  return game.cells.filter(
    (cell) => armed.has(cell.row) && !game.visited.includes(cell.id),
  );
}

export interface LandedPiece {
  id: number;
  kind: Kind;
  cells: Cell[];
}

export function landedPieces(game: Game): LandedPiece[] {
  const byPiece = new Map<number, Cell[]>();
  for (const cell of game.cells) {
    const list = byPiece.get(cell.pieceId) ?? [];
    list.push(cell);
    byPiece.set(cell.pieceId, list);
  }
  return [...byPiece]
    .map(([id, cells]) => ({ id, kind: game.kinds[id] ?? "I", cells }))
    .sort((a, b) => {
      const lowestA = Math.max(...a.cells.map((cell) => cell.row));
      const lowestB = Math.max(...b.cells.map((cell) => cell.row));
      if (lowestA !== lowestB) return lowestB - lowestA;
      const leftA = Math.min(...a.cells.map((cell) => cell.col));
      const leftB = Math.min(...b.cells.map((cell) => cell.col));
      return leftA - leftB;
    });
}

export function rowFromBottom(row: number) {
  return HEIGHT - row;
}
