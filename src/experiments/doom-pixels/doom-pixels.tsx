"use client";

import { announce, type GridCell, prepareAnnouncements } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import * as React from "react";

import { Controls, shownControls } from "./controls";
import { doomKey, pauseCode } from "./keys";
import { createPainter, type FrameStats } from "./painter";
import { createPixelGridController, pixelKey, rowKey } from "./pixel-grid";
import {
  PixelGridCanvas,
  PixelGridCell,
  PixelGridRoot,
  PixelGridRow,
} from "./pixel-grid-parts";
import {
  columnChoices,
  defaultColumns,
  gridLinesUpTo,
  hexColor,
  pixelCount,
  resolutionLabel,
  rowsFor,
  screenWidth,
} from "./resolution";
import { SettingSwitch } from "./setting-switch";
import { Shell } from "./shell";
import { type DoomFrame, useDoom } from "./use-doom";

export function DoomPixels() {
  const [columns, setColumns] = React.useState<number>(defaultColumns);
  const [isGridShown, setIsGridShown] = React.useState(false);
  const [isSoundOn, setIsSoundOn] = React.useState(true);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasFrame, setHasFrame] = React.useState(false);
  const [stats, setStats] = React.useState<FrameStats | null>(null);
  const [buildMs, setBuildMs] = React.useState<number | null>(null);
  const [controller] = React.useState(createPixelGridController);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const buildStart = React.useRef(0);
  const [painter] = React.useState(() =>
    createPainter({ controller, onStats: setStats }),
  );
  const rows = rowsFor(columns);
  const canShowGrid = columns <= gridLinesUpTo;
  const showsGrid = isGridShown && canShowGrid;
  const isPlaying = isFocused && !isPaused;

  const onFrame = React.useCallback(
    (frame: DoomFrame) => {
      setHasFrame(true);
      painter.receive(frame);
    },
    [painter],
  );

  const { error, isAudioAvailable, send } = useDoom(columns, onFrame);

  React.useEffect(() => {
    prepareAnnouncements(document);
  }, []);

  React.useEffect(
    () =>
      painter.attach({
        onDrawn: () => send({ type: "drawn" }),
      }),
    [painter, send],
  );

  React.useLayoutEffect(() => {
    painter.resize(columns);
    const started = buildStart.current;
    if (started === 0) return;
    const frame = requestAnimationFrame(() => {
      setBuildMs(performance.now() - started);
    });
    return () => cancelAnimationFrame(frame);
  }, [columns, painter]);

  React.useEffect(() => {
    send({ type: "pause", isPaused: !isPlaying });
  }, [isPlaying, send]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const held = new Set<number>();
    const release = () => {
      for (const key of held) send({ type: "key", isPressed: false, key });
      held.clear();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey) return;
      const isDown = event.type === "keydown";
      if (event.code === pauseCode && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (isDown && !event.repeat) {
          release();
          setIsPaused((paused) => !paused);
        }
        return;
      }
      if (isPaused || event.key === "Tab") return;
      const key = doomKey(event);
      if (key === null) return;
      event.preventDefault();
      event.stopPropagation();
      if (isDown && event.repeat) return;
      send({ type: "key", isPressed: isDown, key });
      if (isDown) held.add(key);
      else held.delete(key);
    };
    const onFocusIn = () => setIsFocused(true);
    const onFocusOut = (event: FocusEvent) => {
      if (stage.contains(event.relatedTarget as Node | null)) return;
      release();
      setIsFocused(false);
    };
    stage.addEventListener("keydown", onKey, true);
    stage.addEventListener("keyup", onKey, true);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    return () => {
      release();
      stage.removeEventListener("keydown", onKey, true);
      stage.removeEventListener("keyup", onKey, true);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
    };
  }, [isPaused, send]);

  const describe = React.useCallback(
    ({ row, col }: GridCell) =>
      `${hexColor(painter.colorAt(row, col))}, row ${row + 1}, column ${col + 1}`,
    [painter],
  );

  const changeColumns = (value: number) => {
    if (value === columns) return;
    buildStart.current = performance.now();
    setBuildMs(null);
    setStats(null);
    setColumns(value);
    send({ type: "resolution", columns: value });
    announce(
      `${resolutionLabel(value)}, ${pixelCount(value).toLocaleString("en-US")} cells.`,
    );
  };

  const togglePause = () => {
    setIsPaused((paused) => !paused);
  };

  const status = error
    ? null
    : !hasFrame
      ? "Loading Freedoom…"
      : isPaused
        ? "Paused. Arrow keys move between pixels; P plays again."
        : isFocused
          ? null
          : "Click the screen or tab to it to play.";

  return (
    <Shell
      tape="02"
      tags={["Freedoom phase 2", "Keyboard"]}
      title="Doom Pixels"
      kicker="One UI SDK grid cell per pixel"
      hints={shownControls}
      footerEnd={<Controls />}
      stageClassName="@container items-center justify-center p-4 [--screen:100cqw] lg:[--screen:max(320px,min(calc(100cqw-70px),calc((100dvh-380px)*1.6)))]"
      panel={
        <>
          <Readout columns={columns} stats={stats} buildMs={buildMs} />
          <Select
            value={String(columns)}
            onValueChange={(value) => {
              if (typeof value === "string") changeColumns(Number(value));
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <SelectLabel className="arcade-label">Resolution</SelectLabel>
                <span aria-hidden="true" className="arcade-label">
                  Grid lines up to {gridLinesUpTo}
                </span>
              </div>
              <SelectTrigger className="group flex items-center justify-between gap-2 border-[1.5px] border-foreground px-2.5 py-[7px] font-mono text-base leading-[22px] font-medium hover:bg-white/5 data-open:bg-white/5">
                <SelectValue />
                <span
                  aria-hidden="true"
                  className="font-sans text-xs leading-4 group-data-open:rotate-180"
                >
                  ▾
                </span>
              </SelectTrigger>
            </div>
            <SelectContent className="arcade-panel m-0 min-w-(--anchor-width) p-1 text-foreground">
              {columnChoices.map((choice) => (
                <SelectItem
                  key={choice}
                  value={String(choice)}
                  label={resolutionLabel(choice)}
                  className="group flex cursor-pointer justify-between gap-4 px-2.5 py-[3px] font-mono text-sm leading-5 text-secondary-foreground select-none data-highlighted:bg-muted data-highlighted:text-foreground data-selected:bg-foreground data-selected:text-background"
                >
                  <span>{resolutionLabel(choice)}</span>
                  <span
                    className={`text-[13px] leading-5 group-data-selected:text-background ${choice > screenWidth ? "text-accent" : "text-muted-foreground"}`}
                  >
                    {pixelCount(choice).toLocaleString("en-US")} cells
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="flex w-(--screen) max-w-full flex-col gap-2.5">
        <div aria-hidden="true" className="flex justify-between gap-3">
          <span className="arcade-label text-foreground">
            Doom screen · {resolutionLabel(columns)}
          </span>
          {isPaused ? (
            <span className="arcade-label flex items-center gap-2 text-accent">
              <span className="size-2 bg-accent" />
              Paused
            </span>
          ) : null}
        </div>
        <div
          ref={stageRef}
          data-paused={isPaused ? "" : undefined}
          className="group relative my-1 aspect-8/5 w-full min-w-0 overflow-hidden bg-black outline-[1.5px] outline-offset-[3px] outline-foreground outline-solid focus-within:outline-primary"
        >
          {error ? (
            <div
              role="alert"
              className="grid size-full place-content-center gap-1 p-6 text-center"
            >
              <p className="font-medium">Freedoom didn&apos;t load.</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            <PixelGrid
              key={columns}
              columns={columns}
              rows={rows}
              controller={controller}
              describe={describe}
            />
          )}
          {showsGrid ? (
            <div
              aria-hidden="true"
              style={
                {
                  "--cell-width": `${100 / columns}%`,
                  "--cell-height": `${100 / rows}%`,
                } as React.CSSProperties
              }
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-background)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-background)_60%,transparent)_1px,transparent_1px)] bg-size-[var(--cell-width)_var(--cell-height)]"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pt-1.5">
          <p
            aria-live="polite"
            className="min-h-5 min-w-0 flex-1 text-[15px] leading-5 text-secondary-foreground"
          >
            {status}
          </p>
          <section
            aria-label="Settings"
            className="flex flex-wrap items-center gap-x-5 gap-y-3"
          >
            <SettingSwitch
              label="Show grid"
              isChecked={showsGrid}
              isDisabled={!canShowGrid}
              description={
                canShowGrid
                  ? undefined
                  : `Up to ${resolutionLabel(gridLinesUpTo)}`
              }
              onCheckedChange={setIsGridShown}
            />
            <SettingSwitch
              label="Sound"
              isChecked={isSoundOn && isAudioAvailable}
              isDisabled={!isAudioAvailable}
              description={
                isAudioAvailable ? undefined : "Needs HTTPS or localhost"
              }
              onCheckedChange={(isChecked) => {
                setIsSoundOn(isChecked);
                send({ type: "sound", isMuted: !isChecked });
              }}
            />
            <Button
              onClick={togglePause}
              className="flex items-center gap-2 bg-accent px-3 py-1.5 font-ui text-sm leading-[18px] font-semibold text-accent-foreground hover:bg-accent/90"
            >
              <svg aria-hidden="true" viewBox="0 0 10 12" className="h-3 w-2.5">
                {isPaused ? (
                  <polygon points="0,0 10,6 0,12" fill="currentColor" />
                ) : (
                  <path
                    d="M0 0h3.5v12H0zM6.5 0H10v12H6.5z"
                    fill="currentColor"
                  />
                )}
              </svg>
              {isPaused ? "Play" : "Pause"}
            </Button>
          </section>
        </div>
      </div>
    </Shell>
  );
}

interface PixelGridProps {
  columns: number;
  rows: number;
  controller: ReturnType<typeof createPixelGridController>;
  describe: (cell: GridCell) => string;
}

const PixelGrid = React.memo(function PixelGrid({
  columns,
  rows,
  controller,
  describe,
}: PixelGridProps) {
  const [shown, setShown] = React.useState({ current: 0, previous: 0 });
  const rowIndexes = [...new Set([shown.previous, shown.current])].toSorted(
    (a, b) => a - b,
  );
  const reveal = React.useCallback(({ row }: GridCell) => {
    setShown((last) =>
      last.current === row ? last : { current: row, previous: last.current },
    );
  }, []);
  const columnIndexes = Array.from({ length: columns }, (_, col) => col);
  return (
    <PixelGridRoot
      rows={rows}
      columns={columns}
      controller={controller}
      describe={describe}
      reveal={reveal}
      aria-label={`Doom screen, ${resolutionLabel(columns)}`}
      style={
        {
          "--columns": columns,
          "--rows": rows,
        } as React.CSSProperties
      }
      className="relative isolate size-full"
    >
      <PixelGridCanvas className="pointer-events-none absolute inset-0 -z-10 size-full [image-rendering:pixelated]" />
      {rowIndexes.map((row) => (
        <PixelGridRow
          key={row}
          id={rowKey(row)}
          row={row}
          style={{ top: `${(row * 100) / rows}%` }}
          className="absolute inset-x-0 grid h-[calc(100%/var(--rows))] grid-cols-[repeat(var(--columns),1fr)]"
        >
          {columnIndexes.map((col) => (
            <PixelGridCell
              key={col}
              id={pixelKey(row, col)}
              row={row}
              col={col}
              className="outline-none group-data-paused:focus-visible:relative group-data-paused:focus-visible:z-10 group-data-paused:focus-visible:shadow-[0_0_12px_var(--color-primary)] group-data-paused:focus-visible:outline-[2.5px] group-data-paused:focus-visible:outline-offset-1 group-data-paused:focus-visible:outline-primary group-data-paused:focus-visible:outline-solid"
            />
          ))}
        </PixelGridRow>
      ))}
    </PixelGridRoot>
  );
});

interface ReadoutProps {
  columns: number;
  stats: FrameStats | null;
  buildMs: number | null;
}

function Readout({ columns, stats, buildMs }: ReadoutProps) {
  const total = pixelCount(columns);
  const empty = "—";
  return (
    <section aria-label="Cost" className="arcade-panel">
      <p
        aria-hidden="true"
        className="arcade-panel-head arcade-label text-foreground"
      >
        Cost
      </p>
      <dl className="arcade-panel-row pt-3.5 pb-2.5">
        <div className="arcade-stat">
          <dt className="arcade-label">FPS</dt>
          <dd className="flex items-baseline gap-2">
            <span className="arcade-readout text-[44px] leading-12 tracking-[-0.04em] text-accent">
              {stats ? stats.fps.toFixed(1) : empty}
            </span>
            {stats ? (
              <span className="text-[13px] leading-4 text-muted-foreground">
                engine {Math.round(stats.engineFps)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      <dl className="arcade-panel-row pt-2.5 pb-3.5">
        <Stat label="Cells" value={total.toLocaleString("en-US")} />
        <Stat
          label="Changed"
          value={
            stats ? Math.round(stats.changed).toLocaleString("en-US") : empty
          }
        />
      </dl>
      <dl className="arcade-panel-row pt-2.5 pb-3.5">
        <Stat
          label="Frame"
          value={stats ? `${stats.frameMs.toFixed(1)} ms` : empty}
        />
        <Stat
          label="Script"
          value={stats ? `${stats.scriptMs.toFixed(1)} ms` : empty}
        />
        <Stat
          label="Built"
          value={buildMs === null ? empty : `${Math.round(buildMs)} ms`}
        />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="arcade-stat">
      <dt className="arcade-label">{label}</dt>
      <dd className="arcade-readout text-[22px] leading-7 tracking-[-0.02em]">
        {value}
      </dd>
    </div>
  );
}
