import { describe, expect, it } from "vitest";

import type { Line } from "./snapshot";

import {
  buildGrid,
  cellCenter,
  centerOn,
  describeCell,
  findPath,
  followPlayer,
  gridPosition,
  gridSize,
  isFocusable,
  mapTerrain,
  simplifyPath,
} from "./grid-map";
import { testSnapshot } from "./test-snapshot";

const origin = centerOn(32, 32);

function wall(x1: number, y1: number, x2: number, y2: number): Line {
  return { x1, y1, x2, y2, kind: "wall", index: 0 };
}

// A room of 4 by 4 cells, from (-128, -128) to (128, 128), with a locked door
// in its east wall that faces into the room and opens into a closet.
const door: Line = { x1: 128, y1: 64, x2: 128, y2: 0, kind: "door", index: 7 };
const room: Line[] = [
  wall(-128, 128, 128, 128),
  wall(-128, -128, 128, -128),
  wall(-128, -128, -128, 128),
  wall(128, -128, 128, 0),
  wall(128, 64, 128, 128),
  door,
  wall(128, 64, 192, 64),
  wall(192, 64, 192, 0),
  wall(192, 0, 128, 0),
];
const closedDoor = {
  line: 7,
  x: 128,
  y: 32,
  open: 0,
  isMoving: false,
  key: 1,
  sector: 2,
};

describe("grid position", () => {
  it("puts the player near the middle, with north up", () => {
    expect(gridPosition(origin, 32, 32)).toEqual({ row: 12, col: 12 });
    expect(gridPosition(origin, 32, 96)).toEqual({ row: 11, col: 12 });
    expect(gridPosition(origin, 96, 32)).toEqual({ row: 12, col: 13 });
  });

  it("round trips a cell through its center", () => {
    const center = cellCenter(origin, { row: 3, col: 20 });
    expect(gridPosition(origin, center.x, center.y)).toEqual({
      row: 3,
      col: 20,
    });
  });

  it("keeps the view until the player nears its edge", () => {
    expect(followPlayer(origin, 32 + 64 * 5, 32)).toBe(origin);
    expect(followPlayer(origin, 32 + 64 * 7, 32)).toEqual(
      centerOn(32 + 64 * 7, 32),
    );
    expect(followPlayer(null, 32, 32)).toEqual(origin);
  });
});

describe("mapTerrain", () => {
  const map = mapTerrain(room, origin);
  const player = gridPosition(origin, 32, 32);

  it("blocks a move across a wall that runs along a cell edge", () => {
    const split = mapTerrain([wall(64, -128, 64, 128)], origin);
    expect(split.east[player.row * gridSize + player.col]).toBe("wall");
    expect(split.south[player.row * gridSize + player.col]).toBe("open");
  });

  it("gives a door to the cell in front of it, and to the move through it", () => {
    const front = gridPosition(origin, 96, 32);
    expect(map.cells[front.row * gridSize + front.col]).toEqual({
      terrain: "door",
      line: 7,
    });
    expect(map.east[front.row * gridSize + front.col]).toBe(7);
  });
});

describe("buildGrid", () => {
  const map = mapTerrain(room, origin);
  const snapshot = testSnapshot({
    monsters: [
      {
        id: 11,
        type: 3001,
        x: -96,
        y: 96,
        health: 60,
        isAlive: true,
        isVisible: true,
      },
      {
        id: 12,
        type: 3004,
        x: 96,
        y: 96,
        health: 0,
        isAlive: false,
        isVisible: false,
      },
    ],
    items: [{ id: 21, type: 2007, x: 96, y: -96 }],
    doors: [closedDoor],
  });
  const grid = buildGrid(map, origin, snapshot);
  const at = (x: number, y: number) => {
    const { row, col } = gridPosition(origin, x, y);
    const cell = grid.mapCells[row * gridSize + col];
    if (!cell) throw new Error(`No cell at ${x}, ${y}.`);
    return cell;
  };

  it("places the player, live monsters and items", () => {
    expect(at(32, 32).isPlayer).toBe(true);
    expect(at(-96, 96).monsters.map((m) => m.id)).toEqual([11]);
    expect(at(96, 96).monsters).toEqual([]);
    expect(at(96, -96).items.map((item) => item.id)).toEqual([21]);
  });

  it("reaches the room and what lies past a door, but not the void", () => {
    expect(at(-96, -96).isReachable).toBe(true);
    expect(at(160, 32).isReachable).toBe(true);
    expect(at(-500, -500).isReachable).toBe(false);
    expect(isFocusable(at(-500, -500))).toBe(false);
    expect(isFocusable(at(96, 96))).toBe(true);
  });

  it("names what a cell holds", () => {
    expect(describeCell(at(32, 32), snapshot)).toBe(
      "You, facing north, 100 health",
    );
    expect(describeCell(at(-96, 96), snapshot)).toBe("Serpentipede, 60 health");
    expect(describeCell(at(96, -96), snapshot)).toBe("Bullets");
    expect(describeCell(at(96, 32), snapshot)).toBe("Blue locked door");
    expect(describeCell(at(-500, -500), snapshot)).toBe("Wall");
  });

  it("paths around walls and not through a closed door", () => {
    const from = gridPosition(origin, 32, 32);
    const corner = gridPosition(origin, -96, -96);
    const path = findPath(grid, from, corner);
    expect(path?.length).toBe(4);
    expect(path?.at(-1)).toEqual(corner);
    expect(findPath(grid, from, gridPosition(origin, 160, 32))).toBeNull();
  });

  it("paths through an open door", () => {
    const opened = buildGrid(map, origin, {
      ...snapshot,
      doors: [{ ...closedDoor, open: 72 }],
    });
    const closet = gridPosition(origin, 160, 32);
    expect(
      findPath(opened, gridPosition(origin, 32, 32), closet)?.at(-1),
    ).toEqual(closet);
  });
});

describe("simplifyPath", () => {
  it("keeps only the turns and the end", () => {
    const from = { row: 0, col: 0 };
    const path = [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
    ];
    expect(simplifyPath(path, from)).toEqual([
      { row: 0, col: 2 },
      { row: 2, col: 2 },
    ]);
  });
});
