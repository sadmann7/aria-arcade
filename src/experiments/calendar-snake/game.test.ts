import { describe, expect, test } from "vitest";

import { boardOf, createGame, type Game, tick, turn } from "./game";

function at(game: Game, patch: Partial<Game>): Game {
  return { ...game, ...patch };
}

describe("calendar snake", () => {
  const game = createGame("2026-11", 7);

  test("plays across three months", () => {
    expect(boardOf("2026-11")).toEqual({
      first: "2026-11-01",
      last: "2027-01-31",
    });
    expect(game.snake).toEqual(["2026-11-10", "2026-11-09", "2026-11-08"]);
    expect(game.cake).not.toBeNull();
    expect(game.snake).not.toContain(game.cake);
  });

  test("moves a day sideways and a week up or down", () => {
    const quiet = at(game, { cake: "2027-01-31" });
    expect(tick(quiet).snake).toEqual([
      "2026-11-11",
      "2026-11-10",
      "2026-11-09",
    ]);
    expect(tick(turn(quiet, "down")).snake[0]).toBe("2026-11-17");
    expect(tick(turn(quiet, "up")).snake[0]).toBe("2026-11-03");
  });

  test("ignores turning back on itself", () => {
    expect(turn(game, "left")).toBe(game);
    expect(turn(game, "right")).toBe(game);
  });

  test("queues two turns for the next ticks", () => {
    const quiet = at(game, { cake: "2027-01-31" });
    const turned = turn(turn(quiet, "down"), "left");
    const first = tick(turned);
    expect(first.snake[0]).toBe("2026-11-17");
    expect(tick(first).snake[0]).toBe("2026-11-16");
  });

  test("grows, books a meeting and moves the cake when it eats", () => {
    const fed = tick(at(game, { cake: "2026-11-11" }));
    expect(fed.score).toBe(1);
    expect(fed.snake).toHaveLength(4);
    expect(fed.meetings).toHaveLength(1);
    expect(fed.cake).not.toBe("2026-11-11");
    expect([...fed.snake, fed.cake]).not.toContain(fed.meetings[0]);
  });

  test("ends off the calendar, on a meeting or on itself", () => {
    const edge = tick(at(game, { snake: ["2027-01-31", "2027-01-30"] }));
    expect(edge).toMatchObject({ status: "over", crash: "edge" });
    const early = tick(
      at(game, { snake: ["2026-11-01", "2026-11-02"], direction: "left" }),
    );
    expect(early.crash).toBe("edge");
    const meeting = tick(at(game, { meetings: ["2026-11-11"] }));
    expect(meeting.crash).toBe("meeting");
    const loop = tick(
      at(game, {
        snake: [
          "2026-11-10",
          "2026-11-03",
          "2026-11-04",
          "2026-11-11",
          "2026-11-12",
        ],
      }),
    );
    expect(loop.crash).toBe("self");
    expect(tick(loop)).toBe(loop);
  });

  test("can follow its own tail", () => {
    const chase = tick(
      at(game, {
        cake: "2027-01-31",
        snake: ["2026-11-10", "2026-11-03", "2026-11-04", "2026-11-11"],
      }),
    );
    expect(chase.status).toBe("playing");
    expect(chase.snake[0]).toBe("2026-11-11");
  });
});
