"use client";

import { announce, prepareAnnouncements } from "@ui-sdk/core";
import { addMonths, todayDate } from "@ui-sdk/core/date";
import { Button } from "@ui-sdk/react/button";
import {
  Calendar,
  CalendarDay,
  type CalendarFocusedChangeReason,
  CalendarGrid,
  CalendarHeading,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  createCalendarController,
} from "@ui-sdk/react/calendar";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import Link from "next/link";
import * as React from "react";

import {
  createGame,
  type Direction,
  type Game,
  MONTHS,
  speedOf,
  tick,
  turn,
} from "./game";
import { createSession } from "./session";

const KEYS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  A: "left",
  D: "right",
  W: "up",
  S: "down",
};

const PAD: { direction: Direction; label: string; glyph: string }[] = [
  { direction: "left", label: "A day earlier", glyph: "←" },
  { direction: "up", label: "A week earlier", glyph: "↑" },
  { direction: "down", label: "A week later", glyph: "↓" },
  { direction: "right", label: "A day later", glyph: "→" },
];

const NAVIGATION = new Set(["Home", "End", "PageUp", "PageDown", "Enter", " "]);

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
});

const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function monthName(offset: number, month: string) {
  const first = addMonths(`${month}-01`, offset);
  return monthFormat.format(new Date(`${first}T00:00:00Z`));
}

function shortDate(date: string) {
  return shortFormat.format(new Date(`${date}T00:00:00Z`));
}

const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

const primaryClass =
  "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface CalendarSnakeProps {
  seed?: number;
  today?: string;
  initialGame?: Game;
}

export function CalendarSnake({
  seed,
  today,
  initialGame,
}: CalendarSnakeProps) {
  const [session] = React.useState(() =>
    createSession(initialGame ?? null, (text) => announce(text)),
  );
  const [calendar] = React.useState(() => createCalendarController());
  const game = React.useSyncExternalStore(
    session.subscribe,
    session.get,
    session.get,
  );
  const [pausedBy, setPausedBy] = React.useState<"user" | "blur" | null>(null);
  const [best, setBest] = React.useState(0);
  const boardRef = React.useRef<HTMLDivElement>(null);

  const isPlaying = game?.status === "playing";
  const isRunning = isPlaying && pausedBy === null;
  const head = game?.snake[0] ?? null;
  const month = game ? game.first.slice(0, 7) : undefined;
  const score = game?.score ?? 0;
  const speed = game ? speedOf(game) : 0;

  React.useEffect(() => {
    prepareAnnouncements(document);
  }, []);

  React.useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      session.apply(tick);
      const after = session.get();
      if (after?.status === "over") {
        setBest((current) => Math.max(current, after.score));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [isRunning, speed, session]);

  React.useEffect(() => {
    if (!isRunning || !head) return;
    calendar.focus(head);
  }, [isRunning, head, calendar]);

  React.useEffect(() => {
    if (!isRunning) return;
    function onVisibilityChange() {
      if (document.hidden) setPausedBy((current) => current ?? "blur");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isRunning]);

  function start() {
    if (!game || game.status === "over") {
      const date = today ?? todayDate();
      session.replace(createGame(date.slice(0, 7), seed ?? Date.now()));
    }
    setPausedBy(null);
    const next = session.get()?.snake[0];
    if (next) calendar.focus(next);
  }

  function steer(direction: Direction) {
    if (!isPlaying || pausedBy === "user") return;
    if (pausedBy === "blur") setPausedBy(null);
    session.apply((current) => turn(current, direction));
  }

  function togglePause() {
    if (!isPlaying) return;
    if (pausedBy) {
      setPausedBy(null);
      if (head) calendar.focus(head);
    } else {
      setPausedBy("user");
    }
  }

  function onKeyDownCapture(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest("[data-slot=calendar-day]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = KEYS[event.key];
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      steer(direction);
      return;
    }
    if (event.key === "p" || event.key === "P" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      togglePause();
      return;
    }
    if (event.key === "Enter" && !isPlaying) {
      event.preventDefault();
      event.stopPropagation();
      start();
      return;
    }
    if (NAVIGATION.has(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onFocusedChange(
    date: string,
    details: { reason: CalendarFocusedChangeReason; cancel: () => void },
  ) {
    if (details.reason === "imperative" || !isPlaying) return;
    if (date === head) return;
    details.cancel();
    if (head) queueMicrotask(() => calendar.focus(head));
  }

  function onCalendarFocus() {
    setPausedBy((current) => (current === "blur" ? null : current));
  }

  function onBoardBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && boardRef.current?.contains(next)) return;
    if (!isPlaying) return;
    setPausedBy((current) => current ?? "blur");
  }

  const status = !game
    ? "Press Start. Arrow keys steer: a day or a week at a time."
    : game.status === "over"
      ? `Game over. ${score} eaten.`
      : pausedBy
        ? "Paused."
        : game.cake
          ? `Cake on ${shortDate(game.cake)}.`
          : "Every day is taken.";

  return (
    <main className="mx-auto grid w-full max-w-5xl content-start gap-5 px-4 py-6 sm:gap-8 sm:py-12">
      <header className="grid gap-2 sm:gap-3">
        <Link
          href="/"
          className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Aria Arcade
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Calendar Snake
        </h1>
        <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground sm:text-base">
          The snake is the focused date and its body is the selection. Left and
          Right move a day, Up and Down a week. Eat the cakes, dodge the
          meetings, and stay inside the quarter.
        </p>
      </header>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <p aria-live="off">{status}</p>
          <dl className="flex gap-4">
            <div className="flex gap-1.5">
              <dt>Eaten</dt>
              <dd className="font-semibold text-foreground">{score}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Length</dt>
              <dd className="font-semibold text-foreground">
                {game?.snake.length ?? 3}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Best</dt>
              <dd className="font-semibold text-foreground">{best}</dd>
            </div>
          </dl>
        </div>
        <div ref={boardRef} onBlur={onBoardBlur} className="relative">
          <Calendar
            mode="multiple"
            readOnly
            value={game?.snake ?? []}
            month={month}
            months={MONTHS}
            today={today}
            showOutsideDays={false}
            unavailable={game?.meetings ?? []}
            controller={calendar}
            onFocusedChange={onFocusedChange}
            onMonthChange={(_, details) => {
              if (game) details.cancel();
            }}
            onKeyDownCapture={onKeyDownCapture}
            onFocus={onCalendarFocus}
            data-playing={isRunning ? "" : undefined}
            className="group/calendar grid gap-3"
          >
            <CalendarHeading className="sr-only" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: MONTHS }, (_, offset) => (
                <div
                  key={offset}
                  className="grid content-start gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <p aria-hidden="true" className="px-1 text-sm font-medium">
                    {month ? monthName(offset, month) : "\u00a0"}
                  </p>
                  <CalendarGrid
                    offset={offset}
                    className="w-full table-fixed border-separate border-spacing-0.5"
                  >
                    <CalendarWeekdays>
                      {(index) => (
                        <CalendarWeekday
                          index={index}
                          className="pb-1 text-xs font-normal text-muted-foreground"
                        />
                      )}
                    </CalendarWeekdays>
                    <CalendarWeeks>
                      {(cell) => (
                        <CalendarDay
                          value={cell.date}
                          data-head={cell.date === head ? "" : undefined}
                          data-cake={cell.date === game?.cake ? "" : undefined}
                          className="relative h-9 rounded-md text-center text-sm text-muted-foreground tabular-nums outline-none select-none focus-visible:ring-2 focus-visible:ring-ring data-head:bg-primary data-head:ring-2 data-head:ring-ring data-head:ring-offset-1 data-head:ring-offset-card data-selected:bg-primary/70 data-selected:font-semibold data-selected:text-primary-foreground data-today:underline data-today:underline-offset-4 data-unavailable:bg-amber-400/20 data-unavailable:text-amber-200 data-unavailable:line-through data-unavailable:decoration-amber-400 data-unavailable:decoration-2 sm:h-10"
                        >
                          {(state) =>
                            cell.date === game?.cake ? (
                              <span aria-hidden="true">🎂</span>
                            ) : (
                              state.label
                            )
                          }
                        </CalendarDay>
                      )}
                    </CalendarWeeks>
                  </CalendarGrid>
                </div>
              ))}
            </div>
          </Calendar>
          {!game || game.status === "over" || pausedBy ? (
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 rounded-xl bg-background/75 p-4 text-center backdrop-blur-[2px]">
              <p className="text-lg font-semibold">
                {!game
                  ? "Calendar Snake"
                  : game.status === "over"
                    ? "Game over"
                    : "Paused"}
              </p>
              {game?.status === "over" ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {score} eaten · {game.snake.length} days long
                </p>
              ) : null}
              <Button className={primaryClass} onClick={start}>
                {!game
                  ? "Start"
                  : game.status === "over"
                    ? "Play again"
                    : "Resume"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
          <Toolbar
            aria-label="Steering pad"
            className="grid touch-manipulation grid-cols-4 gap-1.5 sm:w-64"
          >
            {PAD.map((button) => (
              <ToolbarButton
                key={button.direction}
                aria-label={button.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => steer(button.direction)}
                className="grid h-12 w-14 place-items-center rounded-lg border border-border bg-muted text-lg text-foreground select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-foreground/15"
              >
                <span aria-hidden="true">{button.glyph}</span>
              </ToolbarButton>
            ))}
          </Toolbar>
          <Button
            className={buttonClass}
            disabled={!isPlaying}
            onMouseDown={(event) => event.preventDefault()}
            onClick={togglePause}
          >
            {pausedBy ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>
    </main>
  );
}
