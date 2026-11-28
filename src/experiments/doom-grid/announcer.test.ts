import { describe, expect, it } from "vitest";

import type { Monster } from "./snapshot";

import {
  type Announcement,
  createThrottle,
  describeChanges,
} from "./announcer";
import { testSnapshot } from "./test-snapshot";

const imp: Monster = {
  id: 5,
  type: 3001,
  x: 32,
  y: 32 + 64 * 3,
  health: 60,
  isAlive: true,
  isVisible: false,
};

function texts(announcements: Announcement[]) {
  return announcements.map((announcement) => announcement.text);
}

describe("describeChanges", () => {
  const before = testSnapshot({ monsters: [imp] });

  it("names the map on a new level", () => {
    expect(texts(describeChanges(null, before))).toEqual(["Map 01"]);
  });

  it("stays quiet when only the player moves", () => {
    const moved = testSnapshot({
      monsters: [imp],
      player: { ...before.player, x: 96, angle: 0 },
      walk: { seq: 1, state: "moving" },
    });
    expect(describeChanges(before, moved)).toEqual([]);
  });

  it("says when a monster comes into view, with where", () => {
    const seen = testSnapshot({ monsters: [{ ...imp, isVisible: true }] });
    expect(texts(describeChanges(before, seen))).toEqual([
      "Serpentipede in view, 3 cells north.",
    ]);
  });

  it("reports hits and kills", () => {
    const hit = testSnapshot({ monsters: [{ ...imp, health: 40 }] });
    expect(texts(describeChanges(before, hit))).toEqual([
      "Hit the serpentipede, 40 left.",
    ]);
    const dead = testSnapshot({
      monsters: [{ ...imp, health: -5, isAlive: false }],
    });
    expect(texts(describeChanges(before, dead))).toEqual([
      "Killed the serpentipede.",
    ]);
  });

  it("reports damage, and low health urgently once", () => {
    const hurt = testSnapshot({ player: { ...before.player, health: 80 } });
    expect(describeChanges(before, hurt)).toMatchObject([
      { text: "Took damage, 80 health.", priority: "polite" },
    ]);
    const low = testSnapshot({ player: { ...before.player, health: 20 } });
    expect(describeChanges(hurt, low)).toMatchObject([
      { text: "Low health, 20.", priority: "assertive" },
    ]);
    const lower = testSnapshot({ player: { ...before.player, health: 10 } });
    expect(describeChanges(low, lower)).toMatchObject([
      { text: "Low health, 10.", priority: "polite" },
    ]);
  });

  it("reports a door starting to open once for both its faces", () => {
    const door = {
      line: 9,
      x: 32,
      y: 160,
      open: 0,
      isMoving: false,
      key: 0,
      sector: 4,
    };
    const otherFace = { ...door, line: 10, y: 176 };
    const closed = testSnapshot({ doors: [door, otherFace] });
    const opening = testSnapshot({
      doors: [
        { ...door, open: 4, isMoving: true },
        { ...otherFace, open: 4, isMoving: true },
      ],
    });
    expect(texts(describeChanges(closed, opening))).toEqual([
      "Door opening, 2 cells north.",
    ]);
    expect(describeChanges(opening, opening)).toEqual([]);
  });

  it("passes the engine's pickup message through", () => {
    const picked = testSnapshot({
      message: { seq: 1, text: "Picked up some bullets." },
    });
    expect(texts(describeChanges(before, picked))).toEqual([
      "Picked up some bullets.",
    ]);
  });

  it("says when the player dies, urgently", () => {
    const dead = testSnapshot({
      player: { ...before.player, health: 0, dead: true },
    });
    expect(describeChanges(before, dead)).toMatchObject([
      { key: "death", priority: "assertive" },
    ]);
  });
});

function message(
  key: string,
  overrides: Partial<Announcement> = {},
): Announcement {
  return { key, text: key, priority: "polite", cooldownMs: 0, ...overrides };
}

describe("createThrottle", () => {
  it("leaves a gap between polite messages", () => {
    const throttle = createThrottle({ gapMs: 1000, maxWaiting: 4 });
    throttle.push(message("a"), 0);
    throttle.push(message("b"), 0);
    expect(throttle.take(0)?.key).toBe("a");
    expect(throttle.take(500)).toBeNull();
    expect(throttle.take(1000)?.key).toBe("b");
    expect(throttle.take(5000)).toBeNull();
  });

  it("lets an urgent message skip the gap and the line", () => {
    const throttle = createThrottle({ gapMs: 1000, maxWaiting: 4 });
    throttle.push(message("a"), 0);
    expect(throttle.take(0)?.key).toBe("a");
    throttle.push(message("b"), 100);
    throttle.push(message("low", { priority: "assertive" }), 100);
    expect(throttle.take(100)?.key).toBe("low");
  });

  it("replaces a waiting message with a newer one of the same key", () => {
    const throttle = createThrottle({ gapMs: 1000, maxWaiting: 4 });
    throttle.push(message("x"), 0);
    expect(throttle.take(0)?.key).toBe("x");
    throttle.push(message("damage", { text: "Took damage, 90 health." }), 10);
    throttle.push(message("damage", { text: "Took damage, 70 health." }), 20);
    expect(throttle.take(1000)?.text).toBe("Took damage, 70 health.");
    expect(throttle.take(3000)).toBeNull();
  });

  it("never lets the queue grow past its limit", () => {
    const throttle = createThrottle({ gapMs: 1000, maxWaiting: 3 });
    for (const key of ["a", "b", "c", "d", "e"]) throttle.push(message(key), 0);
    const spoken = [0, 1000, 2000, 3000].map((now) => throttle.take(now)?.key);
    expect(spoken).toEqual(["c", "d", "e", undefined]);
  });

  it("keeps a message quiet through its cooldown", () => {
    const throttle = createThrottle({ gapMs: 100, maxWaiting: 4 });
    const sighting = message("sight:5", { cooldownMs: 8000 });
    throttle.push(sighting, 0);
    expect(throttle.take(0)?.key).toBe("sight:5");
    throttle.push(sighting, 2000);
    expect(throttle.take(2000)).toBeNull();
    throttle.push(sighting, 8000);
    expect(throttle.take(8000)?.key).toBe("sight:5");
  });
});
