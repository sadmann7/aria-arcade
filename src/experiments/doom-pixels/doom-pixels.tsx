"use client";

import { announce, type GridCell, prepareAnnouncements } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import Link from "next/link";
import * as React from "react";

import { Controls } from "./controls";
import { doomKey, pauseCode } from "./keys";
import { createPainter, type FrameStats, type PaintMode } from "./painter";
import { createPixelGridController, pixelKey, rowKey } from "./pixel-grid";
import { PixelGridCell, PixelGridRoot, PixelGridRow } from "./pixel-grid-parts";
import {
  columnChoices,
  defaultColumns,
  gridLinesUpTo,
  hexColor,
  pixelCount,
  resolutionLabel,
  rowsFor,
} from "./resolution";
import { SettingSwitch } from "./setting-switch";
import { type DoomFrame, useDoom } from "./use-doom";

export function DoomPixels() {
  const [columns, setColumns] = React.useState<number>(defaultColumns);
  const [mode, setMode] = React.useState<PaintMode>("rows");
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
        cells: () =>
          stageRef.current?.querySelectorAll<HTMLElement>(
            '[data-slot="pixel-grid-cell"]',
          ) ?? [],
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
    painter.setMode(mode);
  }, [mode, painter]);

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
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 lg:h-dvh">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to the gallery
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Doom pixels</h1>
        <p className="text-xs text-pretty text-muted-foreground">
          Freedoom, drawn into one UI SDK grid cell per pixel.
        </p>
      </header>
      <section
        aria-label="Settings"
        className="flex flex-wrap items-end gap-x-5 gap-y-3"
      >
        <Select
          value={String(columns)}
          onValueChange={(value) => {
            if (typeof value === "string") changeColumns(Number(value));
          }}
        >
          <div className="grid gap-1">
            <SelectLabel className="text-xs text-muted-foreground">
              Resolution
            </SelectLabel>
            <SelectTrigger className="flex h-8 min-w-44 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-sm tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-open:bg-muted">
              <SelectValue />
              <span aria-hidden="true" className="text-muted-foreground">
                ▾
              </span>
            </SelectTrigger>
          </div>
          <SelectContent className="m-0 grid min-w-(--anchor-width) gap-0.5 rounded-lg border border-border bg-card p-1 text-sm text-foreground shadow-xl shadow-black/50">
            {columnChoices.map((choice) => (
              <SelectItem
                key={choice}
                value={String(choice)}
                label={resolutionLabel(choice)}
                className="flex cursor-pointer justify-between gap-4 rounded-md px-2.5 py-1.5 tabular-nums select-none data-highlighted:bg-muted data-selected:font-medium data-selected:text-primary"
              >
                <span>{resolutionLabel(choice)}</span>
                <span className="text-xs text-muted-foreground">
                  {pixelCount(choice).toLocaleString("en-US")} cells
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Field className="grid gap-1">
          <FieldLabel className="text-xs text-muted-foreground">
            Paint with
          </FieldLabel>
          <SegmentedControl
            value={mode}
            onValueChange={(value) => {
              if (isPaintMode(value)) setMode(value);
            }}
            className="relative flex h-8 rounded-md border border-border bg-card p-0.5 text-sm"
          >
            <SegmentedControlIndicator className="absolute inset-y-0.5 left-(--indicator-left) w-(--indicator-width) rounded bg-muted transition-[left,width] motion-reduce:transition-none" />
            {paintModes.map((paintMode) => (
              <SegmentedControlItem
                key={paintMode}
                value={paintMode}
                className="relative rounded px-2.5 focus-visible:outline-2 focus-visible:outline-ring data-checked:text-foreground"
              >
                {paintLabels[paintMode]}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </Field>
        <div className="flex h-8 flex-wrap items-center gap-x-5 gap-y-2">
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
            className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            {isPaused ? "Play" : "Pause"}
          </Button>
        </div>
      </section>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <div
          ref={stageRef}
          data-paused={isPaused ? "" : undefined}
          data-paint={mode}
          className="group relative aspect-8/5 w-full max-w-[calc((100dvh-12rem)*1.6)] min-w-0 overflow-hidden rounded-md bg-black ring-1 ring-border focus-within:ring-2 focus-within:ring-ring"
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
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-neutral-800)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-neutral-800)_1px,transparent_1px)] bg-size-[var(--cell-width)_var(--cell-height)]"
            />
          ) : null}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {status}
        </p>
      </div>
      <footer className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <Controls />
        <Readout
          columns={columns}
          mode={mode}
          stats={stats}
          buildMs={buildMs}
        />
      </footer>
    </main>
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
  const rowIndexes = Array.from({ length: rows }, (_, row) => row);
  const columnIndexes = Array.from({ length: columns }, (_, col) => col);
  return (
    <PixelGridRoot
      rows={rows}
      columns={columns}
      controller={controller}
      describe={describe}
      aria-label={`Doom screen, ${resolutionLabel(columns)}`}
      style={
        {
          "--columns": columns,
          "--rows": rows,
        } as React.CSSProperties
      }
      className="grid size-full grid-rows-[repeat(var(--rows),1fr)]"
    >
      {rowIndexes.map((row) => (
        <PixelGridRow
          key={row}
          id={rowKey(row)}
          row={row}
          className="grid grid-cols-[repeat(var(--columns),1fr)]"
        >
          {columnIndexes.map((col) => (
            <PixelGridCell
              key={col}
              id={pixelKey(row, col)}
              row={row}
              col={col}
              className="outline-none group-data-[paint=rows]:bg-transparent! group-data-paused:focus-visible:relative group-data-paused:focus-visible:z-10 group-data-paused:focus-visible:outline-2 group-data-paused:focus-visible:outline-ring group-data-paused:focus-visible:outline-solid"
            />
          ))}
        </PixelGridRow>
      ))}
    </PixelGridRoot>
  );
});

const paintLabels: Record<PaintMode, string> = {
  cells: "Live cells",
  rows: "Live rows",
  direct: "Style writes",
};

const paintModes = Object.keys(paintLabels) as PaintMode[];

function isPaintMode(value: unknown): value is PaintMode {
  return paintModes.some((paintMode) => paintMode === value);
}

interface ReadoutProps {
  columns: number;
  mode: PaintMode;
  stats: FrameStats | null;
  buildMs: number | null;
}

function Readout({ columns, mode, stats, buildMs }: ReadoutProps) {
  const total = pixelCount(columns);
  return (
    <p className="tabular-nums">
      {total.toLocaleString("en-US")} cells · {paintLabels[mode].toLowerCase()}
      {buildMs === null ? "" : ` · built in ${Math.round(buildMs)} ms`}
      {stats
        ? ` · ${stats.fps.toFixed(1)} fps (engine ${Math.round(stats.engineFps)}) · ${stats.frameMs.toFixed(1)} ms a frame, ${stats.scriptMs.toFixed(1)} ms script · ${Math.round(stats.changed).toLocaleString("en-US")} cells changed`
        : " · measuring…"}
    </p>
  );
}
