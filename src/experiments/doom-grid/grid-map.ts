import type { Door, Item, Line, Monster, Snapshot } from "./snapshot";

import { doorKeyNames, itemName, monsterName } from "./things";

export const gridSize = 24;
export const cellUnits = 64;
// A door or switch belongs to the cell this far in front of its line.
const frontReach = 24;
// The view recenters once the player is this close to its edge.
const followMargin = 5;
// A door is passable once its gap is as tall as the player.
const passableOpen = 56;

/** The world cell at the grid's top left corner. North is up. */
export interface Origin {
  cx: number;
  cy: number;
}

export interface GridPosition {
  row: number;
  col: number;
}

export type Terrain = "floor" | "door" | "exit";

export interface TerrainCell {
  terrain: Terrain;
  line: number | null;
}

/**
 * What lies between two neighboring cells: `open`, `wall`, or the index of a
 * door line.
 */
export type Passage = "open" | "wall" | number;

export interface TerrainMap {
  cells: TerrainCell[];
  east: Passage[];
  south: Passage[];
}

export interface MapGrid extends TerrainMap {
  mapCells: MapCell[];
  doors: Map<number, Door>;
}

export interface MapCell extends GridPosition {
  id: string;
  terrain: Terrain;
  line: number | null;
  door: Door | null;
  isPlayer: boolean;
  isReachable: boolean;
  monsters: Monster[];
  items: Item[];
}

export function cellId({ row, col }: GridPosition) {
  return `${row}:${col}`;
}

export function worldCell(x: number, y: number) {
  return { cx: Math.floor(x / cellUnits), cy: Math.floor(y / cellUnits) };
}

export function gridPosition(origin: Origin, x: number, y: number) {
  const { cx, cy } = worldCell(x, y);
  return { row: origin.cy - cy, col: cx - origin.cx };
}

export function isInside({ row, col }: GridPosition) {
  return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
}

export function cellCenter(origin: Origin, { row, col }: GridPosition) {
  return {
    x: (origin.cx + col) * cellUnits + cellUnits / 2,
    y: (origin.cy - row) * cellUnits + cellUnits / 2,
  };
}

export function centerOn(x: number, y: number): Origin {
  const { cx, cy } = worldCell(x, y);
  return { cx: cx - gridSize / 2, cy: cy + gridSize / 2 };
}

export function followPlayer(
  origin: Origin | null,
  x: number,
  y: number,
): Origin {
  if (!origin) return centerOn(x, y);
  const { row, col } = gridPosition(origin, x, y);
  const low = followMargin;
  const high = gridSize - 1 - followMargin;
  if (row < low || row > high || col < low || col > high) {
    return centerOn(x, y);
  }
  return origin;
}

function cross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function crossesSegment(
  line: Line,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const d1 = cross(line.x1, line.y1, line.x2, line.y2, from.x, from.y);
  const d2 = cross(line.x1, line.y1, line.x2, line.y2, to.x, to.y);
  const d3 = cross(from.x, from.y, to.x, to.y, line.x1, line.y1);
  const d4 = cross(from.x, from.y, to.x, to.y, line.x2, line.y2);
  if (d1 === 0 && d2 === 0) {
    const along = (x: number, y: number) =>
      (x - from.x) * (to.x - from.x) + (y - from.y) * (to.y - from.y);
    const length = along(to.x, to.y);
    const start = along(line.x1, line.y1);
    const end = along(line.x2, line.y2);
    return Math.max(start, end) >= 0 && Math.min(start, end) <= length;
  }
  return (
    ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) &&
    ((d3 >= 0 && d4 <= 0) || (d3 <= 0 && d4 >= 0))
  );
}

// Doom draws a line's front side on its right, facing the room it belongs to.
function frontOf(line: Line) {
  const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) || 1;
  return {
    x: (line.x1 + line.x2) / 2 + ((line.y2 - line.y1) / length) * frontReach,
    y: (line.y1 + line.y2) / 2 - ((line.x2 - line.x1) / length) * frontReach,
  };
}

function passageThrough(
  lines: Line[],
  from: { x: number; y: number },
  to: { x: number; y: number },
): Passage {
  let passage: Passage = "open";
  for (const line of lines) {
    if (!crossesSegment(line, from, to)) continue;
    if (line.kind === "door") return line.index;
    passage = "wall";
  }
  return passage;
}

export function mapTerrain(lines: Line[], origin: Origin): TerrainMap {
  const size = gridSize * gridSize;
  const cells: TerrainCell[] = Array.from({ length: size }, () => ({
    terrain: "floor",
    line: null,
  }));
  const west = origin.cx * cellUnits;
  const south = (origin.cy - gridSize) * cellUnits;
  const east = west + gridSize * cellUnits;
  const north = (origin.cy + 1) * cellUnits;
  const nearby = lines.filter(
    (line) =>
      Math.max(line.x1, line.x2) >= west &&
      Math.min(line.x1, line.x2) <= east &&
      Math.max(line.y1, line.y2) >= south &&
      Math.min(line.y1, line.y2) <= north,
  );
  for (const line of nearby) {
    if (line.kind === "wall") continue;
    const front = frontOf(line);
    const position = gridPosition(origin, front.x, front.y);
    const cell = cells[position.row * gridSize + position.col];
    if (!isInside(position) || !cell || cell.terrain === "door") continue;
    cell.terrain = line.kind;
    cell.line = line.index;
  }
  const eastPassages: Passage[] = Array.from({ length: size }, () => "wall");
  const southPassages: Passage[] = Array.from({ length: size }, () => "wall");
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const index = row * gridSize + col;
      const center = cellCenter(origin, { row, col });
      if (col < gridSize - 1) {
        eastPassages[index] = passageThrough(nearby, center, {
          x: center.x + cellUnits,
          y: center.y,
        });
      }
      if (row < gridSize - 1) {
        southPassages[index] = passageThrough(nearby, center, {
          x: center.x,
          y: center.y - cellUnits,
        });
      }
    }
  }
  return { cells, east: eastPassages, south: southPassages };
}

function canCross(
  passage: Passage | undefined,
  doors: Map<number, Door>,
  isWalking: boolean,
) {
  if (passage === undefined || passage === "wall") return false;
  if (passage === "open" || !isWalking) return true;
  return (doors.get(passage)?.open ?? 0) >= passableOpen;
}

function passageBetween(
  map: TerrainMap,
  from: GridPosition,
  to: GridPosition,
): Passage | undefined {
  if (!isInside(to)) return undefined;
  const fromIndex = from.row * gridSize + from.col;
  const toIndex = to.row * gridSize + to.col;
  if (to.col === from.col + 1) return map.east[fromIndex];
  if (to.col === from.col - 1) return map.east[toIndex];
  if (to.row === from.row + 1) return map.south[fromIndex];
  return map.south[toIndex];
}

const steps: GridPosition[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

function flood(
  start: GridPosition,
  canEnter: (from: GridPosition, to: GridPosition) => boolean,
  target = -1,
) {
  const startIndex = start.row * gridSize + start.col;
  const seen = new Set<number>([startIndex]);
  const previous = new Map<number, number>();
  const queue = [start];
  for (let next = queue.shift(); next; next = queue.shift()) {
    const nextIndex = next.row * gridSize + next.col;
    if (nextIndex === target) break;
    for (const step of steps) {
      const to = { row: next.row + step.row, col: next.col + step.col };
      const index = to.row * gridSize + to.col;
      if (!isInside(to) || seen.has(index) || !canEnter(next, to)) continue;
      seen.add(index);
      previous.set(index, nextIndex);
      queue.push(to);
    }
  }
  return { seen, previous };
}

export function buildGrid(
  map: TerrainMap,
  origin: Origin,
  snapshot: Snapshot,
): MapGrid {
  const mapCells: MapCell[] = map.cells.map((cell, index) => {
    const position = {
      row: Math.floor(index / gridSize),
      col: index % gridSize,
    };
    return {
      ...position,
      id: cellId(position),
      terrain: cell.terrain,
      line: cell.line,
      door: null,
      isPlayer: false,
      isReachable: false,
      monsters: [],
      items: [],
    };
  });
  const doors = new Map(snapshot.doors.map((door) => [door.line, door]));
  const grid: MapGrid = { ...map, mapCells, doors };
  const at = (x: number, y: number) => {
    const position = gridPosition(origin, x, y);
    return isInside(position)
      ? mapCells[position.row * gridSize + position.col]
      : undefined;
  };
  for (const cell of mapCells) {
    if (cell.line !== null) cell.door = doors.get(cell.line) ?? null;
  }
  for (const monster of snapshot.monsters) {
    if (monster.isAlive) at(monster.x, monster.y)?.monsters.push(monster);
  }
  for (const item of snapshot.items) at(item.x, item.y)?.items.push(item);
  const player = at(snapshot.player.x, snapshot.player.y);
  if (!player) return grid;
  player.isPlayer = true;
  const { seen } = flood(player, (from, to) =>
    canCross(passageBetween(map, from, to), doors, false),
  );
  for (const index of seen) {
    const cell = mapCells[index];
    if (cell) cell.isReachable = true;
  }
  return grid;
}

export function isFocusable(cell: MapCell) {
  if (cell.isPlayer || cell.monsters.length > 0 || cell.items.length > 0) {
    return true;
  }
  return cell.isReachable || cell.terrain !== "floor";
}

export function findPath(
  grid: MapGrid,
  from: GridPosition,
  to: GridPosition,
): GridPosition[] | null {
  const start = from.row * gridSize + from.col;
  const target = to.row * gridSize + to.col;
  const { seen, previous } = flood(
    from,
    (step, next) =>
      canCross(passageBetween(grid, step, next), grid.doors, true),
    target,
  );
  if (!seen.has(target)) return null;
  const path: GridPosition[] = [];
  for (let index = target; index !== start;) {
    path.unshift({ row: Math.floor(index / gridSize), col: index % gridSize });
    const parent = previous.get(index);
    if (parent === undefined) break;
    index = parent;
  }
  return path;
}

/** Drops the waypoints a straight walk passes through anyway. */
export function simplifyPath(path: GridPosition[], from: GridPosition) {
  const kept: GridPosition[] = [];
  let last = from;
  for (const [index, point] of path.entries()) {
    const next = path[index + 1];
    if (
      next &&
      Math.sign(point.row - last.row) === Math.sign(next.row - point.row) &&
      Math.sign(point.col - last.col) === Math.sign(next.col - point.col)
    ) {
      last = point;
      continue;
    }
    kept.push(point);
    last = point;
  }
  return kept;
}

const compass = [
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
  "south",
  "south-east",
];

export function compassName(degrees: number) {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return compass[index] ?? "east";
}

export function directionFrom(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const cells = Math.round(
    Math.hypot(to.x - from.x, to.y - from.y) / cellUnits,
  );
  const degrees = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  if (cells === 0) return "right here";
  return `${cells} ${cells === 1 ? "cell" : "cells"} ${compassName(degrees)}`;
}

function describeDoor(door: Door | null) {
  if (!door) return "door";
  const key = door.key ? `${doorKeyNames[door.key]} locked door` : "door";
  return key;
}

function monsterText(monster: Monster) {
  const sight = monster.isVisible ? "" : ", out of sight";
  return `${monsterName(monster.type)}, ${monster.health} health${sight}`;
}

export function describeCell(cell: MapCell, snapshot: Snapshot): string {
  const parts: string[] = [];
  if (cell.isPlayer) {
    parts.push(
      `You, facing ${compassName(snapshot.player.angle)}, ${snapshot.player.health} health`,
    );
  }
  for (const monster of cell.monsters) parts.push(monsterText(monster));
  for (const item of cell.items) parts.push(itemName(item.type));
  if (cell.terrain === "door") parts.push(describeDoor(cell.door));
  if (cell.terrain === "exit") parts.push("exit switch");
  if (parts.length === 0) {
    parts.push(cell.isReachable ? "floor" : "wall");
  }
  const [first = "", ...rest] = parts;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(", ");
}
