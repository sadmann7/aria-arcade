import type { Snapshot } from "./snapshot";

import { directionFrom } from "./grid-map";
import { monsterName } from "./things";

export type Priority = "polite" | "assertive";

export interface Announcement {
  /** Messages with the same key replace each other while they wait. */
  key: string;
  text: string;
  priority: Priority;
  /** How long a message with this key stays quiet after it was spoken. */
  cooldownMs: number;
}

export const lowHealth = 25;

export function describeChanges(
  previous: Snapshot | null,
  next: Snapshot,
): Announcement[] {
  const said: Announcement[] = [];
  const say = (
    key: string,
    text: string,
    priority: Priority = "polite",
    cooldownMs = 0,
  ) => said.push({ key, text, priority, cooldownMs });

  if (!previous || previous.level !== next.level) {
    say("level", `Map ${String(next.map).padStart(2, "0")}`);
    return said;
  }
  const player = next.player;
  if (player.dead && !previous.player.dead) {
    say("death", "You died. Press Enter on your cell to restart.", "assertive");
    return said;
  }
  if (!player.dead && previous.player.dead) say("death", "Back on your feet.");

  const before = new Map(previous.monsters.map((m) => [m.id, m]));
  for (const monster of next.monsters) {
    const old = before.get(monster.id);
    const name = monsterName(monster.type);
    if (old?.isAlive && !monster.isAlive) {
      say(`monster:${monster.id}`, `Killed the ${name}.`);
    } else if (old && monster.isAlive && monster.health < old.health) {
      say(`monster:${monster.id}`, `Hit the ${name}, ${monster.health} left.`);
    } else if (monster.isAlive && monster.isVisible && !old?.isVisible) {
      say(
        `sight:${monster.id}`,
        `${capitalize(name)} in view, ${directionFrom(player, monster)}.`,
        "polite",
        8000,
      );
    }
  }

  if (player.health < previous.player.health && !player.dead) {
    const isLow = player.health <= lowHealth;
    say(
      "damage",
      isLow
        ? `Low health, ${player.health}.`
        : `Took damage, ${player.health} health.`,
      isLow && previous.player.health > lowHealth ? "assertive" : "polite",
    );
  }

  const doors = new Map(previous.doors.map((door) => [door.line, door]));
  for (const door of next.doors) {
    const old = doors.get(door.line);
    if (!old || !door.isMoving || old.isMoving) continue;
    say(
      `door:${door.line}`,
      door.open > old.open || old.open === 0
        ? `Door opening, ${directionFrom(player, door)}.`
        : `Door closing, ${directionFrom(player, door)}.`,
    );
  }

  if (next.message.seq !== previous.message.seq && next.message.text) {
    say("message", next.message.text);
  }
  if (next.walk.seq === previous.walk.seq) {
    if (next.walk.state === "blocked" && previous.walk.state === "moving") {
      say("walk", "Blocked.");
    }
  }
  return said;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface Throttle {
  push(announcement: Announcement, now: number): void;
  take(now: number): Announcement | null;
  clear(): void;
}

export interface ThrottleOptions {
  /** The shortest gap between two polite messages. */
  gapMs: number;
  /** The most messages that wait; the oldest polite one is dropped past it. */
  maxWaiting: number;
}

export function createThrottle({
  gapMs,
  maxWaiting,
}: ThrottleOptions): Throttle {
  let waiting: Announcement[] = [];
  let lastSpoken = -Infinity;
  const spokenAt = new Map<string, number>();

  return {
    push(announcement, now) {
      const quietUntil =
        (spokenAt.get(announcement.key) ?? -Infinity) + announcement.cooldownMs;
      if (now < quietUntil) return;
      waiting = waiting.filter((other) => other.key !== announcement.key);
      waiting.push(announcement);
      while (waiting.length > maxWaiting) {
        const polite = waiting.findIndex(
          (other) => other.priority === "polite",
        );
        waiting.splice(polite === -1 ? 0 : polite, 1);
      }
    },
    take(now) {
      const urgent = waiting.findIndex(
        (other) => other.priority === "assertive",
      );
      const index = urgent !== -1 ? urgent : now - lastSpoken >= gapMs ? 0 : -1;
      const next = index === -1 ? undefined : waiting[index];
      if (!next) return null;
      waiting.splice(index, 1);
      lastSpoken = now;
      spokenAt.set(next.key, now);
      return next;
    },
    clear() {
      waiting = [];
    },
  };
}
