import { addDays, addMonths, endOfMonth } from "@ui-sdk/core/date";

export type Direction = "left" | "right" | "up" | "down";
export type Status = "playing" | "over";
export type Crash = "edge" | "self" | "meeting";

export const MONTHS = 3;

export const STEPS: Record<Direction, number> = {
  left: -1,
  right: 1,
  up: -7,
  down: 7,
};

const OPPOSITE: Record<Direction, Direction> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};

export interface Game {
  first: string;
  last: string;
  snake: string[];
  direction: Direction;
  queue: Direction[];
  cake: string | null;
  meetings: string[];
  score: number;
  status: Status;
  crash: Crash | null;
  seed: number;
}

function random(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, (seed + 0x6d2b79f5) | 0];
}

export function boardOf(month: string) {
  const first = `${month}-01`;
  const last = endOfMonth(addMonths(first, MONTHS - 1));
  return { first, last };
}

export function datesOf(game: Pick<Game, "first" | "last">) {
  const dates: string[] = [];
  for (let date = game.first; date <= game.last; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function pick(
  game: Game,
  isAllowed: (date: string) => boolean,
): [string | null, number] {
  const taken = new Set([...game.snake, ...game.meetings]);
  if (game.cake) taken.add(game.cake);
  const free = datesOf(game).filter(
    (date) => !taken.has(date) && isAllowed(date),
  );
  if (free.length === 0) return [null, game.seed];
  const [value, seed] = random(game.seed);
  return [free[Math.floor(value * free.length)] ?? null, seed];
}

function ahead(game: Game, count: number) {
  const head = game.snake[0];
  const dates = new Set<string>();
  if (!head) return dates;
  for (const direction of [game.direction, ...game.queue]) {
    for (let step = 1; step <= count; step++) {
      dates.add(addDays(head, STEPS[direction] * step));
    }
  }
  return dates;
}

export function createGame(month: string, seed = 1): Game {
  const { first, last } = boardOf(month);
  const head = addDays(first, 9);
  const game: Game = {
    first,
    last,
    snake: [head, addDays(head, -1), addDays(head, -2)],
    direction: "right",
    queue: [],
    cake: null,
    meetings: [],
    score: 0,
    status: "playing",
    crash: null,
    seed,
  };
  const near = ahead(game, 3);
  const [cake, next] = pick(game, (date) => !near.has(date));
  return { ...game, cake, seed: next };
}

export function turn(game: Game, direction: Direction): Game {
  if (game.status !== "playing") return game;
  const last = game.queue.at(-1) ?? game.direction;
  if (direction === last || direction === OPPOSITE[last]) return game;
  if (game.queue.length >= 2) return game;
  return { ...game, queue: [...game.queue, direction] };
}

export function nextHead(game: Game) {
  const direction = game.queue[0] ?? game.direction;
  const head = game.snake[0];
  return head ? addDays(head, STEPS[direction]) : null;
}

export function tick(game: Game): Game {
  if (game.status !== "playing") return game;
  const [direction = game.direction, ...queue] = game.queue;
  const head = nextHead(game);
  if (!head) return game;
  const isEating = head === game.cake;
  const body = isEating ? game.snake : game.snake.slice(0, -1);
  const crash: Crash | null =
    head < game.first || head > game.last
      ? "edge"
      : game.meetings.includes(head)
        ? "meeting"
        : body.includes(head)
          ? "self"
          : null;
  if (crash) {
    return { ...game, direction, queue, status: "over", crash };
  }
  const moved: Game = {
    ...game,
    snake: [head, ...body],
    direction,
    queue,
  };
  if (!isEating) return moved;
  const eaten: Game = { ...moved, cake: null, score: game.score + 1 };
  const near = ahead(eaten, 2);
  const [meeting, afterMeeting] = pick(eaten, (date) => !near.has(date));
  const booked: Game = {
    ...eaten,
    meetings: meeting ? [...eaten.meetings, meeting] : eaten.meetings,
    seed: afterMeeting,
  };
  const [cake, seed] = pick(booked, () => true);
  return { ...booked, cake, seed };
}

export function speedOf(game: Game) {
  return Math.max(120, 320 - game.score * 12);
}
