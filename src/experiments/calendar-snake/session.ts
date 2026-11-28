import { type Crash, type Game } from "./game";

export interface Session {
  get: () => Game | null;
  subscribe: (listener: () => void) => () => void;
  apply: (update: (game: Game) => Game) => void;
  replace: (game: Game | null) => void;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function spoken(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

const CRASHES: Record<Crash, string> = {
  edge: "Ran off the calendar.",
  self: "Ran into your own day.",
  meeting: "Ran into a meeting.",
};

export function describe(before: Game, after: Game) {
  if (before.status === "playing" && after.status === "over" && after.crash) {
    return [`${CRASHES[after.crash]} Game over. ${after.score} eaten.`];
  }
  if (after.score > before.score) {
    const meeting = after.meetings.at(-1);
    return [
      [
        `Ate the cake. ${after.snake.length} days long.`,
        meeting ? `Meeting booked on ${spoken(meeting)}.` : "",
        after.cake ? `Next cake on ${spoken(after.cake)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    ];
  }
  return [];
}

export function createSession(
  game: Game | null,
  say: (text: string) => void,
): Session {
  let state = game;
  const listeners = new Set<() => void>();

  function set(next: Game | null) {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    apply(update) {
      const before = state;
      if (!before) return;
      const after = update(before);
      set(after);
      for (const text of describe(before, after)) say(text);
    },
    replace(next) {
      set(next);
      if (next?.cake) say(`Cake on ${spoken(next.cake)}.`);
    },
  };
}
