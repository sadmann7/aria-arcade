// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { CalendarSnake } from "./calendar-snake";
import { createGame, type Game } from "./game";

const said = vi.hoisted(() => [] as string[]);

vi.mock("@ui-sdk/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ui-sdk/core")>()),
  announce: (text: string) => said.push(text),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = function () {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  said.length = 0;
});

function day(date: string) {
  const cell = document.querySelector<HTMLElement>(`[data-value="${date}"]`);
  if (!cell) throw new Error(`No day ${date}`);
  return cell;
}

function selected() {
  return [...document.querySelectorAll("[data-selected]")].map((cell) =>
    cell.getAttribute("data-value"),
  );
}

async function play(game?: Game) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<CalendarSnake today="2026-11-28" seed={7} initialGame={game} />);
  if (!game) {
    await user.click(screen.getByRole("button", { name: "Start" }));
  } else {
    await act(async () => {
      day(game.snake[0] ?? "").focus();
    });
  }
  return user;
}

async function step(count = 1) {
  for (let index = 0; index < count; index++) {
    await act(async () => {
      vi.advanceTimersByTime(320);
    });
  }
}

describe("calendar snake", () => {
  test("starts with the snake selected and its head focused", async () => {
    await play();
    expect(selected()).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(document.activeElement).toBe(day("2026-11-10"));
    expect(said[0]).toMatch(/^Cake on /);
  });

  test("moves the focus a day each tick", async () => {
    await play();
    await step();
    expect(document.activeElement).toBe(day("2026-11-11"));
    expect(selected()).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
  });

  test("turns with arrow keys instead of moving the focus", async () => {
    const user = await play();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(day("2026-11-10"));
    await step();
    expect(document.activeElement).toBe(day("2026-11-17"));
  });

  test("ignores the calendar's other keys", async () => {
    const user = await play();
    await user.keyboard("{PageDown}{End}{Enter}");
    expect(document.activeElement).toBe(day("2026-11-10"));
    expect(selected()).toHaveLength(3);
  });

  test("eats cake and books a meeting", async () => {
    await play({ ...createGame("2026-11", 7), cake: "2026-11-11" });
    await step();
    expect(selected()).toHaveLength(4);
    expect(document.querySelectorAll("[data-unavailable]")).toHaveLength(1);
    expect(said.at(-1)).toMatch(
      /^Ate the cake\. 4 days long\. Meeting booked on/,
    );
  });

  test("ends on a meeting", async () => {
    await play({ ...createGame("2026-11", 7), meetings: ["2026-11-11"] });
    await step();
    expect(screen.getByText("Game over", { selector: "p" })).toBeDefined();
    expect(said.at(-1)).toBe("Ran into a meeting. Game over. 0 eaten.");
    expect(screen.getByRole("button", { name: "Play again" })).toBeDefined();
  });

  test("pauses with P and resumes", async () => {
    const user = await play();
    await user.keyboard("p");
    await step(3);
    expect(selected()).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    const [resume] = screen.getAllByRole("button", { name: "Resume" });
    if (resume) await user.click(resume);
    await step();
    expect(document.activeElement).toBe(day("2026-11-11"));
  });

  test("pauses when Tab leaves the board for the pad", async () => {
    const user = await play();
    await user.tab();
    const pad = screen.getByRole("button", { name: "A day earlier" });
    expect(document.activeElement).toBe(pad);
    await step(2);
    expect(document.activeElement).toBe(pad);
    expect(selected()).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
  });

  test("steers with capital WASD", async () => {
    const user = await play();
    await user.keyboard("S");
    await step();
    expect(document.activeElement).toBe(day("2026-11-17"));
  });
});
