import { describe, expect, test } from "vitest";

import {
  armedRows,
  cellsOf,
  createGame,
  type Falling,
  fallInterval,
  type Game,
  ghostOf,
  hardDrop,
  HEIGHT,
  isBlocked,
  type Kind,
  KINDS,
  landedPieces,
  level,
  move,
  rotate,
  shapeOf,
  softDrop,
  tick,
  unvisitedArmed,
  visit,
  WIDTH,
} from "./game";

function place(
  game: Game,
  pieceId: number,
  kind: Kind,
  points: [number, number][],
) {
  return {
    ...game,
    kinds: { ...game.kinds, [pieceId]: kind },
    cells: [
      ...game.cells,
      ...points.map(([row, col], index) => ({
        id: `${pieceId}-${index}`,
        pieceId,
        row,
        col,
      })),
    ],
  };
}

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing value");
  return value;
}

function withFalling(game: Game, falling: Omit<Falling, "id">): Game {
  return { ...game, falling: { id: 99, ...falling } };
}

function bottomRowExcept(game: Game, missing: number[]) {
  let next = game;
  let pieceId = 50;
  for (let col = 0; col < WIDTH; col++) {
    if (missing.includes(col)) continue;
    next = place(next, pieceId++, "I", [[HEIGHT - 1, col]]);
  }
  return next;
}

function visitAll(game: Game, ids: string[]) {
  let next = game;
  const cleared: number[] = [];
  for (const id of ids) {
    const result = visit(next, id);
    next = result.game;
    cleared.push(...result.cleared);
  }
  return { game: next, cleared };
}

describe("pieces", () => {
  test("every tetromino has four cells", () => {
    for (const kind of KINDS) {
      for (let rotation = 0; rotation < 4; rotation++) {
        expect(shapeOf(kind, rotation)).toHaveLength(4);
      }
    }
  });

  test("four turns bring a piece back to where it started", () => {
    for (const kind of KINDS) {
      expect(shapeOf(kind, 4)).toEqual(shapeOf(kind, 0));
    }
  });

  test("a new game spawns a piece at the top and shows the next one", () => {
    const game = createGame(7);
    expect(game.falling).not.toBeNull();
    expect(KINDS).toContain(game.next);
    const rows = cellsOf(must(game.falling)).map((point) => point.row);
    expect(Math.min(...rows)).toBe(0);
  });

  test("the same seed deals the same pieces", () => {
    const a = createGame(42);
    const b = createGame(42);
    expect(a.falling?.kind).toBe(b.falling?.kind);
    expect(a.next).toBe(b.next);
    expect(a.bag).toEqual(b.bag);
  });

  test("the bag deals all seven pieces before repeating", () => {
    let game = createGame(3);
    const dealt: Kind[] = [must(game.falling).kind];
    for (let index = 0; index < 6; index++) {
      dealt.push(game.next);
      game = { ...hardDrop(game), cells: [], kinds: {} };
    }
    expect(new Set(dealt).size).toBe(7);
  });
});

describe("collision", () => {
  test("walls stop sideways moves", () => {
    let game = withFalling(createGame(1), {
      kind: "O",
      rotation: 0,
      row: 0,
      col: 0,
    });
    game = move(game, -1);
    expect(game.falling?.col).toBe(0);
    game = withFalling(game, {
      kind: "O",
      rotation: 0,
      row: 0,
      col: WIDTH - 2,
    });
    expect(move(game, 1).falling?.col).toBe(WIDTH - 2);
  });

  test("landed cells block a move", () => {
    let game = withFalling(createGame(1), {
      kind: "O",
      rotation: 0,
      row: 0,
      col: 4,
    });
    game = place(game, 1, "O", [[0, 6]]);
    expect(move(game, 1).falling?.col).toBe(4);
    expect(move(game, -1).falling?.col).toBe(3);
  });

  test("the floor and the edges count as blocked", () => {
    const game = createGame(1);
    expect(isBlocked(game, [{ row: HEIGHT, col: 0 }])).toBe(true);
    expect(isBlocked(game, [{ row: 0, col: -1 }])).toBe(true);
    expect(isBlocked(game, [{ row: 0, col: WIDTH }])).toBe(true);
    expect(isBlocked(game, [{ row: HEIGHT - 1, col: WIDTH - 1 }])).toBe(false);
  });

  test("a piece that can't fall locks and the next one spawns", () => {
    let game = withFalling(createGame(1), {
      kind: "O",
      rotation: 0,
      row: HEIGHT - 2,
      col: 0,
    });
    const next = game.next;
    game = tick(game);
    expect(game.cells).toHaveLength(4);
    expect(game.cells.every((cell) => cell.pieceId === 99)).toBe(true);
    expect(game.kinds[99]).toBe("O");
    expect(game.falling?.kind).toBe(next);
  });

  test("the hard drop lands on the stack and scores two per row", () => {
    let game = withFalling(createGame(1), {
      kind: "O",
      rotation: 0,
      row: 0,
      col: 0,
    });
    game = place(game, 1, "I", [[HEIGHT - 1, 0]]);
    expect(ghostOf(game)?.row).toBe(HEIGHT - 3);
    game = hardDrop(game);
    const rows = game.cells
      .filter((cell) => cell.pieceId === 99)
      .map((cell) => cell.row);
    expect(Math.max(...rows)).toBe(HEIGHT - 2);
    expect(game.score).toBe((HEIGHT - 3) * 2);
  });

  test("a soft drop moves down one row and scores one", () => {
    const game = createGame(1);
    const dropped = softDrop(game);
    expect(dropped.falling?.row).toBe(must(game.falling).row + 1);
    expect(dropped.score).toBe(1);
  });

  test("the game ends when a new piece has no room", () => {
    let game = createGame(1);
    for (let col = 3; col < 7; col++) {
      game = place(game, 100 + col, "I", [
        [0, col],
        [1, col],
      ]);
    }
    game = withFalling(game, {
      kind: "O",
      rotation: 0,
      row: HEIGHT - 2,
      col: 0,
    });
    game = tick(game);
    expect(game.status).toBe("over");
    expect(game.falling).toBeNull();
    expect(tick(game)).toBe(game);
  });
});

describe("rotation", () => {
  test("a T turns clockwise and back", () => {
    const game = withFalling(createGame(1), {
      kind: "T",
      rotation: 0,
      row: 5,
      col: 4,
    });
    const turned = rotate(game, 1);
    expect(turned.falling?.rotation).toBe(1);
    expect(cellsOf(must(turned.falling))).toEqual(
      expect.arrayContaining([
        { row: 5, col: 5 },
        { row: 6, col: 5 },
        { row: 7, col: 5 },
        { row: 6, col: 6 },
      ]),
    );
    expect(rotate(turned, -1).falling).toEqual(game.falling);
  });

  test("the O never turns", () => {
    const game = withFalling(createGame(1), {
      kind: "O",
      rotation: 0,
      row: 5,
      col: 4,
    });
    expect(rotate(game, 1)).toBe(game);
  });

  test("a turn against the wall kicks the piece back inside", () => {
    const game = withFalling(createGame(1), {
      kind: "I",
      rotation: 1,
      row: 5,
      col: -2,
    });
    const turned = rotate(game, 1);
    expect(turned.falling?.rotation).toBe(2);
    for (const point of cellsOf(must(turned.falling))) {
      expect(point.col).toBeGreaterThanOrEqual(0);
    }
  });

  test("a turn with no room stays put", () => {
    let game = withFalling(createGame(1), {
      kind: "I",
      rotation: 0,
      row: HEIGHT - 2,
      col: 0,
    });
    for (let col = 0; col < WIDTH; col++) {
      game = place(game, 200 + col, "I", [[HEIGHT - 3, col]]);
    }
    expect(rotate(game, 1)).toBe(game);
  });
});

describe("arming and clearing", () => {
  test("a full row arms and stays on the board", () => {
    let game = withFalling(bottomRowExcept(createGame(1), [4, 5]), {
      kind: "O",
      rotation: 0,
      row: 0,
      col: 4,
    });
    expect(armedRows(game)).toEqual([]);
    game = hardDrop(game);
    expect(armedRows(game)).toEqual([HEIGHT - 1]);
    expect(game.cells.filter((cell) => cell.row === HEIGHT - 1)).toHaveLength(
      WIDTH,
    );
    expect(game.lines).toBe(0);
  });

  test("a row clears only once every cell in it has been visited", () => {
    let game = bottomRowExcept(createGame(1), []);
    const row = game.cells.filter((cell) => cell.row === HEIGHT - 1);
    const ids = row.map((cell) => cell.id);

    const almost = visitAll(game, ids.slice(0, -1));
    expect(almost.cleared).toEqual([]);
    expect(armedRows(almost.game)).toEqual([HEIGHT - 1]);
    expect(unvisitedArmed(almost.game).map((cell) => cell.id)).toEqual([
      ids.at(-1),
    ]);

    game = visit(almost.game, must(ids.at(-1))).game;
    expect(armedRows(game)).toEqual([]);
    expect(game.cells).toHaveLength(0);
    expect(game.lines).toBe(1);
    expect(game.visited).toEqual([]);
  });

  test("visiting the same cell twice counts once", () => {
    const game = bottomRowExcept(createGame(1), []);
    const id = must(game.cells[0]).id;
    const once = visit(game, id).game;
    expect(visit(once, id).game).toBe(once);
  });

  test("visiting a cell in an unarmed row does nothing", () => {
    const game = bottomRowExcept(createGame(1), [0]);
    const result = visit(game, must(game.cells[0]).id);
    expect(result.game).toBe(game);
    expect(result.cleared).toEqual([]);
  });

  test("clearing a row drops the rows above it and keeps the piece together", () => {
    let game = bottomRowExcept(createGame(1), [0]);
    game = place(game, 1, "J", [
      [HEIGHT - 3, 0],
      [HEIGHT - 2, 0],
      [HEIGHT - 1, 0],
    ]);
    for (let col = 1; col < WIDTH; col++) {
      game = place(game, 300 + col, "I", [[HEIGHT - 2, col]]);
    }
    expect(armedRows(game)).toEqual([HEIGHT - 1, HEIGHT - 2]);
    const bottom = game.cells
      .filter((cell) => cell.row === HEIGHT - 1)
      .map((cell) => cell.id);
    game = visitAll(game, bottom).game;
    expect(armedRows(game)).toEqual([HEIGHT - 1]);
    const piece = landedPieces(game).find((candidate) => candidate.id === 1);
    expect(piece?.cells.map((cell) => cell.row).sort()).toEqual([
      HEIGHT - 2,
      HEIGHT - 1,
    ]);
  });

  test("a falling piece above a cleared row drops with the stack", () => {
    let game = withFalling(bottomRowExcept(createGame(1), [9]), {
      kind: "O",
      rotation: 0,
      row: HEIGHT - 4,
      col: 0,
    });
    game = place(game, 1, "I", [
      [HEIGHT - 5, 0],
      [HEIGHT - 1, 9],
    ]);
    game = visitAll(
      game,
      game.cells
        .filter((cell) => cell.row === HEIGHT - 1)
        .map((cell) => cell.id),
    ).game;
    expect(game.falling?.row).toBe(HEIGHT - 3);
    expect(isBlocked(game, cellsOf(must(game.falling)))).toBe(false);
  });

  test("visits in a row that hasn't cleared survive another row clearing", () => {
    let game = bottomRowExcept(createGame(1), []);
    for (let col = 0; col < WIDTH; col++) {
      game = place(game, 400 + col, "I", [[HEIGHT - 2, col]]);
    }
    const upper = must(game.cells.find((cell) => cell.row === HEIGHT - 2));
    game = visit(game, upper.id).game;
    const bottom = game.cells
      .filter((cell) => cell.row === HEIGHT - 1)
      .map((cell) => cell.id);
    game = visitAll(game, bottom).game;
    expect(game.visited).toEqual([upper.id]);
    expect(game.cells.find((cell) => cell.id === upper.id)?.row).toBe(
      HEIGHT - 1,
    );
  });
});

describe("scoring", () => {
  function armTogether(count: number) {
    let game = createGame(1);
    for (let row = HEIGHT - count; row < HEIGHT; row++) {
      for (let col = 1; col < WIDTH; col++) {
        game = place(game, row * 100 + col, "I", [[row, col]]);
      }
    }
    game = withFalling(game, {
      kind: "I",
      rotation: 1,
      row: HEIGHT - 4,
      col: -2,
    });
    return hardDrop({ ...game, score: 0 });
  }

  function clearAll(game: Game) {
    let next = { ...game, score: 0 };
    while (armedRows(next).length > 0) {
      next = visitAll(
        next,
        unvisitedArmed(next).map((cell) => cell.id),
      ).game;
    }
    return next;
  }

  test.each([
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
  ])("%i rows armed by one piece score %i", (count, points) => {
    const game = armTogether(count);
    expect(armedRows(game)).toHaveLength(count);
    expect(clearAll(game).score).toBe(points);
  });

  test("rows armed by different pieces score as singles", () => {
    let game = bottomRowExcept(createGame(1), []);
    for (let col = 0; col < WIDTH; col++) {
      game = place(game, 500 + col, "I", [[HEIGHT - 2, col]]);
    }
    expect(clearAll(game).score).toBe(200);
  });

  test("ten lines raise the level and the speed", () => {
    expect(level({ lines: 0 })).toBe(1);
    expect(level({ lines: 9 })).toBe(1);
    expect(level({ lines: 10 })).toBe(2);
    expect(fallInterval(2)).toBeLessThan(fallInterval(1));
    expect(fallInterval(99)).toBeGreaterThan(0);
  });

  test("line points scale with the level", () => {
    const game = { ...bottomRowExcept(createGame(1), []), lines: 20 };
    const cleared = clearAll(game);
    expect(cleared.score).toBe(300);
  });
});
