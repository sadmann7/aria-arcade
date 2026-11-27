import { type Announcer, createAnnouncer } from "./announcer";
import {
  armedRows,
  cellsOf,
  type Game,
  ghostOf,
  level,
  rowFromBottom,
  visit,
} from "./game";

export interface SessionOptions {
  game: Game;
  names: Record<string, string>;
  say: (text: string) => void;
  gap?: number;
}

export interface Session {
  get: () => Game;
  subscribe: (listener: () => void) => () => void;
  apply: (update: (game: Game) => Game) => void;
  visit: (cellId: string) => number[];
  replace: (game: Game) => void;
  say: (text: string, key?: string) => void;
  stop: () => void;
}

function list(values: number[]) {
  if (values.length === 1) return `${values[0]}`;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

export function landingOf(game: Game) {
  const ghost = ghostOf(game);
  if (!ghost) return "";
  const points = cellsOf(ghost);
  const cols = points.map((point) => point.col + 1);
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  const row = rowFromBottom(Math.max(...points.map((point) => point.row)));
  const where =
    left === right ? `column ${left}` : `columns ${left} to ${right}`;
  return `Lands on ${where}, row ${row}.`;
}

export function describe(
  before: Game,
  after: Game,
  names: Record<string, string>,
): [string, string][] {
  const messages: [string, string][] = [];
  if (before.status === "playing" && after.status === "over") {
    return [[`Game over. Score ${after.score}.`, "over"]];
  }
  const armedBefore = new Set(armedRows(before));
  const armed = armedRows(after).filter((row) => !armedBefore.has(row));
  if (armed.length > 0) {
    const rows = list(armed.map(rowFromBottom).sort((a, b) => a - b));
    const noun = armed.length === 1 ? "Row" : "Rows";
    messages.push([
      `${noun} ${rows} armed. Tab into the stack to clear.`,
      "armed",
    ]);
  }
  if (level(after) > level(before)) {
    messages.push([`Level ${level(after)}.`, "level"]);
  }
  if (after.falling && after.falling.id !== before.falling?.id) {
    messages.push([
      `${names[after.falling.kind]}. ${landingOf(after)}`,
      "piece",
    ]);
  } else if (
    after.falling &&
    before.falling &&
    (after.falling.col !== before.falling.col ||
      after.falling.rotation !== before.falling.rotation)
  ) {
    messages.push([landingOf(after), "landing"]);
  }
  return messages;
}

export function createSession({
  game,
  names,
  say,
  gap,
}: SessionOptions): Session {
  let state = game;
  const listeners = new Set<() => void>();
  const announcer: Announcer = createAnnouncer({ say, gap });

  function set(next: Game) {
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
      const after = update(before);
      set(after);
      for (const [text, key] of describe(before, after, names)) {
        announcer.push(text, key);
      }
    },
    visit(cellId) {
      const result = visit(state, cellId);
      set(result.game);
      if (result.cleared.length > 0) {
        const left = armedRows(result.game).length;
        const rows = list(result.cleared.map(rowFromBottom));
        const rest =
          left === 0
            ? "Back to steering."
            : `${left} armed ${left === 1 ? "row" : "rows"} left.`;
        announcer.push(`Row ${rows} cleared. ${rest}`, "cleared");
      }
      return result.cleared;
    },
    replace(next) {
      announcer.stop();
      set(next);
    },
    say(text, key) {
      announcer.push(text, key);
    },
    stop() {
      announcer.stop();
    },
  };
}
