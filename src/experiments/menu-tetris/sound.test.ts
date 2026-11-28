import { describe, expect, test } from "vitest";

import {
  type Cell,
  createGame,
  type Game,
  hardDrop,
  HEIGHT,
  move,
  rotate,
  tick,
  WIDTH,
} from "./game";
import { effectsOf } from "./sound";

function withFalling(cells: Cell[] = [], row = 5, col = 3): Game {
  return {
    ...createGame(1),
    cells,
    falling: { id: 50, kind: "T", rotation: 0, row, col },
    nextId: 51,
  };
}

function bottomRowExcept(cols: number[]): Cell[] {
  return Array.from({ length: WIDTH }, (_, col) => col)
    .filter((col) => !cols.includes(col))
    .map((col) => ({
      id: `1-${col}`,
      pieceId: 1,
      row: HEIGHT - 1,
      col,
    }));
}

describe("effectsOf", () => {
  test("steering plays a move or rotate sound", () => {
    const game = withFalling();
    expect(effectsOf(game, move(game, 1))).toEqual(["move"]);
    expect(effectsOf(game, rotate(game, 1))).toEqual(["rotate"]);
  });

  test("a move into a wall and a gravity step stay quiet", () => {
    const game = withFalling();
    const wall = withFalling([], 5, 0);
    expect(effectsOf(wall, move(wall, -1))).toEqual([]);
    expect(effectsOf(game, tick(game))).toEqual([]);
  });

  test("a hard drop slams and a resting piece locks", () => {
    const game = withFalling();
    expect(effectsOf(game, hardDrop(game))).toEqual(["drop"]);
    const landed = withFalling([], HEIGHT - 2);
    expect(effectsOf(landed, tick(landed))).toEqual(["lock"]);
  });

  test("filling a row chimes as it arms", () => {
    const game = withFalling(bottomRowExcept([4, 5, 6]), 0, 4);
    expect(effectsOf(game, hardDrop(game))).toEqual(["drop", "armed"]);
  });

  test("topping out plays only the game over sound", () => {
    const game = withFalling();
    expect(effectsOf(game, { ...game, status: "over" })).toEqual(["over"]);
  });
});
