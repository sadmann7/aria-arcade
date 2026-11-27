"use client";

import { announce, prepareAnnouncements } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import Link from "next/link";
import * as React from "react";

import {
  armedRows,
  cellsOf,
  createGame,
  fallInterval,
  type Game,
  ghostOf,
  hardDrop,
  HEIGHT,
  type Kind,
  KINDS,
  landedPieces,
  level,
  move,
  rotate,
  shapeOf,
  softDrop,
  tick,
  unvisitedArmed,
  WIDTH,
} from "./game";
import { createSession, landingOf } from "./session";
import { type PieceView, PieceWidget, WIDGETS } from "./widgets";

type Mode = "steer" | "clear";
type Action = "left" | "right" | "down" | "drop" | "cw" | "ccw";

const KEYS: Record<string, Action | "pause"> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowUp: "cw",
  x: "cw",
  X: "cw",
  z: "ccw",
  Z: "ccw",
  " ": "drop",
  p: "pause",
  P: "pause",
};

const UPDATES: Record<Action, (game: Game) => Game> = {
  left: (game) => move(game, -1),
  right: (game) => move(game, 1),
  down: softDrop,
  drop: hardDrop,
  cw: (game) => rotate(game, 1),
  ccw: (game) => rotate(game, -1),
};

const PAD: { action: Action; label: string; glyph: string }[] = [
  { action: "left", label: "Move left", glyph: "←" },
  { action: "ccw", label: "Rotate left", glyph: "↺" },
  { action: "cw", label: "Rotate right", glyph: "↻" },
  { action: "right", label: "Move right", glyph: "→" },
  { action: "down", label: "Soft drop", glyph: "↓" },
  { action: "drop", label: "Hard drop", glyph: "⤓" },
];

const NAMES = Object.fromEntries(
  KINDS.map((kind) => [kind, WIDGETS[kind].name]),
) as Record<Kind, string>;

const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const primaryClass =
  "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function viewOf(game: Game): PieceView[] {
  const armed = new Set(armedRows(game));
  const visited = new Set(game.visited);
  return landedPieces(game).map((piece) => ({
    id: piece.id,
    kind: piece.kind,
    cells: piece.cells.map((cell) => ({
      ...cell,
      isArmed: armed.has(cell.row),
      isVisited: visited.has(cell.id),
    })),
  }));
}

function fallingView(game: Game): PieceView | null {
  if (!game.falling) return null;
  const piece = game.falling;
  return {
    id: piece.id,
    kind: piece.kind,
    cells: cellsOf(piece).map((point, index) => ({
      ...point,
      id: `${piece.id}-${index}`,
      isArmed: false,
      isVisited: false,
    })),
  };
}

function nextView(kind: Kind): PieceView {
  const points = shapeOf(kind, 0);
  const top = Math.min(...points.map((point) => point.row));
  return {
    id: 0,
    kind,
    cells: points.map((point, index) => ({
      row: point.row - top,
      col: point.col,
      id: `next-${index}`,
      isArmed: false,
      isVisited: false,
    })),
  };
}

interface MenuTetrisProps {
  seed?: number;
  initialGame?: Game;
}

export function MenuTetris({ seed, initialGame }: MenuTetrisProps) {
  const [session] = React.useState(() =>
    createSession({
      game: initialGame ?? createGame(seed ?? 1),
      names: NAMES,
      say: (text) => announce(text),
    }),
  );
  const game = React.useSyncExternalStore(
    session.subscribe,
    session.get,
    session.get,
  );
  const [isStarted, setIsStarted] = React.useState(initialGame !== undefined);
  const [mode, setMode] = React.useState<Mode>("steer");
  const [pausedBy, setPausedBy] = React.useState<"user" | "blur" | null>(null);
  const [clears, setClears] = React.useState(0);
  const [focusers] = React.useState(() => new Map<number, () => void>());
  const gameRef = React.useRef<HTMLDivElement>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);

  const isOver = game.status === "over";
  const isRunning =
    isStarted && !isOver && mode === "steer" && pausedBy === null;
  const currentLevel = level(game);
  const armed = armedRows(game);
  const pieces = viewOf(game);
  const falling = isStarted ? fallingView(game) : null;
  const ghost = isStarted ? ghostOf(game) : null;

  React.useEffect(() => {
    prepareAnnouncements(document);
    return () => session.stop();
  }, [session]);

  React.useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(
      () => session.apply(tick),
      fallInterval(currentLevel),
    );
    return () => clearInterval(timer);
  }, [isRunning, currentLevel, session]);

  React.useEffect(() => {
    if (clears === 0) return;
    const active = document.activeElement;
    if (active && stackRef.current?.contains(active)) return;
    const next = unvisitedArmed(session.get());
    const target = landedPieces(session.get()).find((piece) =>
      next.some((cell) => cell.pieceId === piece.id),
    );
    const focus = target ? focusers.get(target.id) : undefined;
    if (focus) focus();
    else boardRef.current?.focus();
  }, [clears, focusers, session]);

  const register = React.useCallback(
    (id: number, focus: (() => void) | null) => {
      if (focus) focusers.set(id, focus);
      else focusers.delete(id);
    },
    [focusers],
  );

  function start() {
    if (!isStarted || isOver) {
      session.replace(createGame(seed ?? Date.now()));
      setIsStarted(true);
      const fresh = session.get();
      if (fresh.falling) {
        session.say(
          `${NAMES[fresh.falling.kind]}. ${landingOf(fresh)}`,
          "piece",
        );
      }
    }
    setPausedBy(null);
    setMode("steer");
    boardRef.current?.focus();
  }

  function steer(action: Action) {
    if (!isStarted || isOver || pausedBy === "user") return;
    if (mode === "clear") {
      setMode("steer");
      boardRef.current?.focus();
    }
    session.apply(UPDATES[action]);
  }

  function togglePause() {
    if (!isStarted || isOver) return;
    setPausedBy((current) => (current ? null : "user"));
  }

  function enterClearing() {
    const next = unvisitedArmed(game);
    const target =
      pieces.find((piece) => next.some((cell) => cell.pieceId === piece.id)) ??
      pieces[0];
    if (target) focusers.get(target.id)?.();
  }

  function reach(target: EventTarget) {
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (!cell) return;
    setMode("clear");
    if (session.visit(cell).length > 0) setClears((count) => count + 1);
  }

  function onBoardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" && (!isStarted || isOver)) {
      event.preventDefault();
      start();
      return;
    }
    const action = KEYS[event.key];
    if (!action || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (action === "pause") togglePause();
    else steer(action);
  }

  function onBoardFocus(event: React.FocusEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    setMode("steer");
    setPausedBy((current) => (current === "blur" ? null : current));
  }

  function onBoardBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && gameRef.current?.contains(next)) return;
    if (!isStarted || isOver || mode !== "steer") return;
    setPausedBy((current) => current ?? "blur");
  }

  function onStackKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    boardRef.current?.focus();
  }

  const status = !isStarted
    ? "Press Start, or focus the board and press Enter."
    : isOver
      ? `Game over. Score ${game.score}.`
      : pausedBy
        ? "Paused."
        : mode === "clear"
          ? "Clearing. The piece waits. Escape to steer."
          : armed.length > 0
            ? `${armed.length} armed ${armed.length === 1 ? "row" : "rows"}. Tab to clear.`
            : "Steering.";

  return (
    <main className="mx-auto grid w-full max-w-4xl content-start gap-5 px-4 py-6 sm:gap-8 sm:py-12">
      <header className="grid gap-2 sm:gap-3">
        <Link
          href="/"
          className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Aria Arcade
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Menu Tetris
        </h1>
        <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground sm:text-base">
          The pieces are toolbars, menubars, tab lists and button groups. A full
          row only clears once you arrow through every cell in it.
        </p>
      </header>
      <div
        ref={gameRef}
        className="grid justify-center gap-4 sm:grid-cols-[auto_minmax(0,16rem)] sm:justify-start sm:gap-8"
      >
        <div className="grid justify-items-center gap-3">
          <div className="flex w-full items-center justify-between gap-3 text-xs text-muted-foreground tabular-nums sm:hidden">
            <span>
              Score <strong className="text-foreground">{game.score}</strong>
            </span>
            <span>
              Level <strong className="text-foreground">{currentLevel}</strong>
            </span>
            <span>
              Lines <strong className="text-foreground">{game.lines}</strong>
            </span>
            <span>
              Next <strong className="text-foreground">{game.next}</strong>
            </span>
          </div>
          <div
            ref={boardRef}
            role="application"
            aria-roledescription="game board"
            aria-label="Menu Tetris board"
            aria-describedby="menu-tetris-help"
            tabIndex={0}
            data-mode={mode}
            onKeyDown={onBoardKeyDown}
            onFocus={onBoardFocus}
            onBlur={onBoardBlur}
            className="group/board relative rounded-xl border-2 border-border bg-card p-1 outline-none [--cell:clamp(0.9rem,min(calc((100vw-3rem)/10.5),calc((100dvh-17rem)/21)),1.75rem)] focus-visible:border-ring data-[mode=clear]:border-primary"
          >
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: `repeat(${WIDTH}, var(--cell))`,
                gridTemplateRows: `repeat(${HEIGHT}, var(--cell))`,
              }}
            >
              {Array.from({ length: HEIGHT }, (_, row) => (
                <div
                  key={`row-${row}`}
                  aria-hidden="true"
                  data-armed={armed.includes(row) ? "" : undefined}
                  className="col-span-full rounded-[5px] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(var(--cell)-1px),rgb(255_255_255/0.04)_calc(var(--cell)-1px),rgb(255_255_255/0.04)_calc(var(--cell)+2px))] data-armed:bg-primary/25"
                  style={{ gridRow: row + 1 }}
                />
              ))}
              {ghost
                ? cellsOf(ghost).map((point) => (
                    <div
                      key={`ghost-${point.row}-${point.col}`}
                      aria-hidden="true"
                      className="rounded-[5px] border-2 border-dashed border-foreground/30"
                      style={{
                        gridRow: point.row + 1,
                        gridColumn: point.col + 1,
                      }}
                    />
                  ))
                : null}
              <div
                ref={stackRef}
                className="contents"
                onFocus={(event) => reach(event.target)}
                onClick={(event) => reach(event.target)}
                onKeyDown={onStackKeyDown}
              >
                {pieces.map((piece) => (
                  <PieceWidget
                    key={piece.id}
                    piece={piece}
                    onRegister={register}
                  />
                ))}
              </div>
              {falling ? (
                <div inert className="contents">
                  <PieceWidget piece={falling} />
                </div>
              ) : null}
            </div>
            {!isStarted || isOver || pausedBy ? (
              <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 rounded-xl bg-background/75 p-4 text-center backdrop-blur-[2px]">
                <p className="text-lg font-semibold">
                  {!isStarted ? "Menu Tetris" : isOver ? "Game over" : "Paused"}
                </p>
                {isOver ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Score {game.score} · {game.lines} lines
                  </p>
                ) : null}
                <Button className={primaryClass} onClick={start}>
                  {!isStarted ? "Start" : isOver ? "Play again" : "Resume"}
                </Button>
              </div>
            ) : null}
          </div>
          <Toolbar
            aria-label="Steering pad"
            className="grid w-full touch-manipulation grid-cols-6 gap-1.5 sm:max-w-80"
          >
            {PAD.map((button) => (
              <ToolbarButton
                key={button.action}
                aria-label={button.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => steer(button.action)}
                className="grid h-12 place-items-center rounded-lg border border-border bg-muted text-lg text-foreground select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-foreground/15"
              >
                <span aria-hidden="true">{button.glyph}</span>
              </ToolbarButton>
            ))}
          </Toolbar>
        </div>
        <aside className="grid content-start gap-5">
          <dl className="hidden grid-cols-3 gap-3 tabular-nums sm:grid">
            {[
              ["Score", game.score],
              ["Level", currentLevel],
              ["Lines", game.lines],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-0.5 rounded-lg border border-border bg-card px-3 py-2"
              >
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="hidden gap-2 sm:grid">
            <p className="text-xs text-muted-foreground">
              Next: {WIDGETS[game.next].name}
            </p>
            <div
              inert
              className="grid w-fit gap-0.5 rounded-lg border border-border bg-card p-2 [--cell:1.25rem]"
              style={{
                gridTemplateColumns: "repeat(4, var(--cell))",
                gridTemplateRows: "repeat(2, var(--cell))",
              }}
            >
              <PieceWidget key={game.next} piece={nextView(game.next)} />
            </div>
          </div>
          <p
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
            data-mode={mode}
          >
            {status}
          </p>
          <div className="flex flex-wrap gap-2">
            {mode === "steer" ? (
              <Button
                className={buttonClass}
                disabled={pieces.length === 0}
                onClick={enterClearing}
              >
                Clear rows
              </Button>
            ) : (
              <Button
                className={buttonClass}
                onClick={() => boardRef.current?.focus()}
              >
                Back to steering
              </Button>
            )}
            <Button
              className={buttonClass}
              disabled={!isStarted || isOver}
              onClick={togglePause}
            >
              {pausedBy === "user" ? "Resume" : "Pause"}
            </Button>
          </div>
          <div id="menu-tetris-help" className="grid gap-1.5 text-sm">
            <p className="font-medium">Keys</p>
            <ul className="grid gap-1 text-muted-foreground">
              <li>
                Left and Right move, Down drops a row, Space drops all the way.
              </li>
              <li>Up or X rotates right, Z rotates left, P pauses.</li>
              <li>
                Tab leaves the board for the stack. Arrow through every cell of
                an armed row to clear it. The piece waits while you clear.
              </li>
              <li>Escape goes back to steering.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
