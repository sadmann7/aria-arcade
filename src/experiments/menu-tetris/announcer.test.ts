import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAnnouncer } from "./announcer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAnnouncer", () => {
  test("says the first message at once and spaces out the rest", () => {
    const said: string[] = [];
    const announcer = createAnnouncer({ say: (text) => said.push(text) });
    announcer.push("One");
    announcer.push("Two");
    expect(said).toEqual(["One"]);
    vi.advanceTimersByTime(899);
    expect(said).toEqual(["One"]);
    vi.advanceTimersByTime(1);
    expect(said).toEqual(["One", "Two"]);
  });

  test("a newer message with the same key replaces the waiting one", () => {
    const said: string[] = [];
    const announcer = createAnnouncer({ say: (text) => said.push(text) });
    announcer.push("Spawned");
    announcer.push("Lands at column 1", "landing");
    announcer.push("Lands at column 2", "landing");
    announcer.push("Lands at column 3", "landing");
    vi.runAllTimers();
    expect(said).toEqual(["Spawned", "Lands at column 3"]);
  });

  test("keeps only the newest few messages", () => {
    const said: string[] = [];
    const announcer = createAnnouncer({
      say: (text) => said.push(text),
      limit: 2,
    });
    announcer.push("A");
    for (const text of ["B", "C", "D", "E"]) announcer.push(text);
    vi.runAllTimers();
    expect(said).toEqual(["A", "D", "E"]);
  });

  test("stop drops everything still waiting", () => {
    const said: string[] = [];
    const announcer = createAnnouncer({ say: (text) => said.push(text) });
    announcer.push("A");
    announcer.push("B");
    announcer.stop();
    vi.runAllTimers();
    expect(said).toEqual(["A"]);
  });
});
