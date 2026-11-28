"use client";

import { announce, prepareAnnouncements } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
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
import { Shell } from "./shell";
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
  "inline-flex items-center justify-center border-[1.5px] border-input px-4 py-[13px] font-pixel text-sm leading-[18px] font-bold tracking-[0.06em] whitespace-nowrap text-foreground uppercase hover:border-foreground disabled:opacity-40";

const primaryClass =
  "inline-flex flex-1 items-center justify-center bg-foreground px-3.5 py-[13px] font-pixel text-sm leading-[18px] font-bold tracking-[0.06em] whitespace-nowrap text-background uppercase shadow-[5px_5px_0_var(--color-primary)] active:translate-[5px] active:shadow-none disabled:opacity-40 disabled:shadow-none";

const startClass =
  "inline-flex items-center justify-center bg-primary px-5 py-3 font-pixel text-sm leading-[18px] font-bold tracking-[0.06em] text-primary-foreground uppercase shadow-[5px_5px_0_var(--color-foreground)] active:translate-[5px] active:shadow-none";

const hints = [
  {
    key: "Left, right and down arrows",
    cap: "← → ↓",
    hint: "Move · drop a row",
  },
  { key: "Space", cap: "Space", hint: "Hard drop" },
  { key: "Up arrow, X or Z", cap: "↑ X · Z", hint: "Rotate" },
  { key: "P", cap: "P", hint: "Pause" },
  { key: "Tab", cap: "Tab", hint: "Clear rows" },
  { key: "Escape", cap: "Esc", hint: "Back to steering" },
];

const KEY_ORDER: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];

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
  const panelRef = React.useRef<HTMLDivElement>(null);

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
    function onVisibilityChange() {
      if (document.hidden) setPausedBy((current) => current ?? "blur");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isRunning]);

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
    if (pausedBy === "blur") setPausedBy(null);
    if (mode === "clear") {
      setMode("steer");
      boardRef.current?.focus();
    }
    session.apply(UPDATES[action]);
  }

  function onPauseButton() {
    if (pausedBy) {
      setPausedBy(null);
      boardRef.current?.focus();
    } else {
      togglePause();
    }
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

  function onGameBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (
      next instanceof Node &&
      (gameRef.current?.contains(next) || panelRef.current?.contains(next))
    ) {
      return;
    }
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

  const chip = !isStarted
    ? "Insert coin"
    : isOver
      ? "Final"
      : pausedBy
        ? "Hold"
        : mode === "clear"
          ? "Clearing"
          : "Steering";

  const headline = !isStarted
    ? "Press start."
    : isOver
      ? "That's the stack."
      : pausedBy
        ? "Take five."
        : mode === "clear"
          ? "The piece waits."
          : "Steer the piece.";

  return (
    <Shell
      tape="04"
      tags={["Keyboard", "Screen reader"]}
      title="Menu Tetris"
      kicker="Toolbars · menubars · tab lists · arrow every cell to clear"
      hints={hints}
      stageClassName="flex-col items-center justify-center gap-8 p-4 sm:flex-row sm:gap-12"
      panel={
        <div ref={panelRef} onBlur={onGameBlur} className="contents">
          <section aria-label="Score" className="arcade-panel">
            <p
              aria-hidden="true"
              className="arcade-panel-head arcade-label text-primary"
            >
              Score
            </p>
            <dl className="tabular-nums">
              <div className="px-4 pt-3.5 pb-2.5">
                <dt className="sr-only">Score</dt>
                <dd className="arcade-readout text-[72px] leading-16 text-accent">
                  <span aria-hidden="true">
                    {String(game.score)
                      .padStart(6, "0")
                      .replace(/(\d{3})$/, ",$1")}
                  </span>
                  <span className="sr-only">{game.score}</span>
                </dd>
              </div>
              <div className="arcade-panel-row border-t border-divider pt-2.5 pb-3.5">
                <div className="arcade-stat">
                  <dt className="arcade-label">Level</dt>
                  <dd className="arcade-readout text-4xl leading-[34px]">
                    {currentLevel}
                  </dd>
                </div>
                <div className="arcade-stat">
                  <dt className="arcade-label">Lines</dt>
                  <dd className="arcade-readout text-4xl leading-[34px]">
                    {game.lines}
                  </dd>
                </div>
              </div>
            </dl>
          </section>
          <div className="flex gap-3">
            {mode === "steer" ? (
              <Button
                className={primaryClass}
                disabled={pieces.length === 0}
                onClick={enterClearing}
              >
                Clear rows
              </Button>
            ) : (
              <Button
                className={primaryClass}
                onClick={() => boardRef.current?.focus()}
              >
                Back to steering
              </Button>
            )}
            <Button
              className={buttonClass}
              disabled={!isStarted || isOver}
              onClick={onPauseButton}
            >
              {pausedBy ? "Resume" : "Pause"}
            </Button>
          </div>
          <section className="flex flex-col gap-2.5 pt-1">
            <h2 className="arcade-label">The pieces</h2>
            <ul className="grid grid-cols-[1fr_130px] gap-x-2.5 gap-y-[7px] text-sm leading-[18px] text-secondary-foreground">
              {KEY_ORDER.map((kind) => (
                <li key={kind} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                    style={{ backgroundColor: WIDGETS[kind].color }}
                  />
                  {WIDGETS[kind].name}
                </li>
              ))}
            </ul>
          </section>
        </div>
      }
    >
      <div ref={gameRef} onBlur={onGameBlur} className="contents">
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
          className="group/board relative shrink-0 border-2 border-border bg-background p-0.5 shadow-[8px_8px_0_#000000b3] outline-none [--cell:clamp(0.9rem,min(calc((100vw-3rem)/10.5),calc((100dvh-386px)/19.8)),1.625rem)] focus-visible:border-ring data-[mode=clear]:border-primary data-[mode=clear]:shadow-[8px_8px_0_#000000b3,0_0_48px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
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
                className="col-span-full bg-white/3 data-armed:-mx-0.5 data-armed:-my-px data-armed:bg-primary/25"
                style={{ gridRow: row + 1 }}
              />
            ))}
            {ghost
              ? cellsOf(ghost).map((point) => (
                  <div
                    key={`ghost-${point.row}-${point.col}`}
                    aria-hidden="true"
                    className="border-2 border-dashed border-foreground/30"
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
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-background/80 p-4 text-center backdrop-blur-[2px]">
              <p className="font-display text-2xl leading-7 font-black tracking-[-0.03em] uppercase [font-stretch:125%] [font-variation-settings:'wdth'_125]">
                {!isStarted ? "Menu Tetris" : isOver ? "Game over" : "Paused"}
              </p>
              {isOver ? (
                <p className="font-readout text-xl leading-5 text-muted-foreground">
                  Score {game.score} · {game.lines} lines
                </p>
              ) : null}
              <Button className={startClass} onClick={start}>
                {!isStarted ? "Start" : isOver ? "Play again" : "Resume"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex w-full max-w-[340px] flex-col gap-7">
          <div className="flex flex-col gap-2.5">
            <p
              aria-hidden="true"
              className="flex flex-wrap items-center gap-2.5"
            >
              <span className="arcade-label bg-primary px-2 py-1 text-primary-foreground">
                {chip}
              </span>
              {armed.length > 0 ? (
                <span className="arcade-label">
                  {armed.length} armed {armed.length === 1 ? "row" : "rows"}
                </span>
              ) : null}
            </p>
            <p
              aria-hidden="true"
              className="font-display text-[30px] leading-8 font-black tracking-[-0.03em] uppercase [font-stretch:125%] [font-variation-settings:'wdth'_125]"
            >
              {headline}
            </p>
            <p
              className="text-base leading-6 text-secondary-foreground"
              data-mode={mode}
            >
              {status}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 max-sm:hidden">
            <p className="arcade-label">Next · {WIDGETS[game.next].name}</p>
            <div
              inert
              className="grid w-fit gap-0.5 border border-border bg-card p-2 [--cell:1.75rem]"
              style={{
                gridTemplateColumns: "repeat(4, var(--cell))",
                gridTemplateRows: "repeat(2, var(--cell))",
              }}
            >
              {isStarted ? (
                <PieceWidget key={game.next} piece={nextView(game.next)} />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <p aria-hidden="true" className="arcade-label">
              Steering pad · toolbar
            </p>
            <Toolbar
              aria-label="Steering pad"
              className="grid touch-manipulation grid-cols-6 gap-1.5"
            >
              {PAD.map((button) => (
                <ToolbarButton
                  key={button.action}
                  aria-label={button.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => steer(button.action)}
                  className="grid h-12 place-items-center border-[1.5px] border-input bg-card text-xl text-foreground select-none hover:border-foreground active:bg-foreground active:text-background"
                >
                  <span aria-hidden="true">{button.glyph}</span>
                </ToolbarButton>
              ))}
            </Toolbar>
          </div>
        </div>
      </div>
      <div id="menu-tetris-help" hidden>
        <p>Keys</p>
        <ul>
          <li>
            Left and Right move, Down drops a row, Space drops all the way.
          </li>
          <li>Up or X rotates right, Z rotates left, P pauses.</li>
          <li>
            Tab leaves the board for the stack. Arrow through every cell of an
            armed row to clear it. The piece waits while you clear.
          </li>
          <li>Escape goes back to steering.</li>
        </ul>
      </div>
    </Shell>
  );
}
