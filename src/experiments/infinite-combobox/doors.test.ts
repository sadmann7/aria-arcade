import { describe, expect, test } from "vitest";

import { BOTTOM, getDoors } from "./doors";

describe("getDoors", () => {
  test("every layer above the bottom has a way down and a dead end", () => {
    for (let depth = 1; depth < BOTTOM; depth++) {
      const doors = getDoors(depth, `from ${depth}`);
      expect(doors.some((door) => door.quip === null)).toBe(true);
      expect(doors.some((door) => door.quip !== null)).toBe(true);
      expect(new Set(doors.map((door) => door.value)).size).toBe(doors.length);
      expect(new Set(doors.map((door) => door.label)).size).toBe(doors.length);
    }
  });

  test("the bottom layer has only dead ends", () => {
    const doors = getDoors(BOTTOM, "anything");
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.every((door) => door.quip !== null)).toBe(true);
  });

  test("the same path always gives the same doors", () => {
    expect(getDoors(37, "A smaller door")).toEqual(
      getDoors(37, "A smaller door"),
    );
  });
});
