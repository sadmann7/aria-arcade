import type { PixelGridController } from "./pixel-grid";
import type { DoomFrame } from "./use-doom";

import { pixelKey, rowKey } from "./pixel-grid";
import {
  columnStops,
  hexColor,
  pixelCount,
  rowGradient,
  rowsFor,
} from "./resolution";

export type PaintMode = "cells" | "rows" | "direct";

export interface FrameStats {
  fps: number;
  engineFps: number;
  frameMs: number;
  scriptMs: number;
  changed: number;
}

interface PainterOptions {
  controller: PixelGridController;
  onStats: (stats: FrameStats) => void;
}

interface PainterTarget {
  cells: () => Iterable<HTMLElement>;
  onDrawn: () => void;
}

const statsEveryMs = 1000;
const noChanges: Record<string, number> = {};

function emptyTotals() {
  return {
    since: 0,
    frames: 0,
    frameMs: 0,
    scriptMs: 0,
    changed: 0,
    firstEngineFrame: -1,
    lastEngineFrame: -1,
  };
}

export function createPainter({ controller, onStats }: PainterOptions) {
  let target: PainterTarget | null = null;
  let after: MessageChannel | null = null;
  let columns = 0;
  let mode: PaintMode = "cells";
  let current = new Int32Array(0);
  let keys: string[] = [];
  let rowKeys: string[] = [];
  let stops: string[] = [];
  let elements: HTMLElement[] | null = null;
  let pending: DoomFrame | null = null;
  let frameRequest = 0;
  let totals = emptyTotals();
  let drawn: {
    start: number;
    scriptMs: number;
    changed: number;
    engineFrame: number;
  } | null = null;

  function record(frame: NonNullable<typeof drawn>, end: number) {
    if (totals.since === 0) totals.since = frame.start;
    if (totals.firstEngineFrame < 0)
      totals.firstEngineFrame = frame.engineFrame;
    totals.frames += 1;
    totals.frameMs += end - frame.start;
    totals.scriptMs += frame.scriptMs;
    totals.changed += frame.changed;
    totals.lastEngineFrame = frame.engineFrame;
    const elapsed = end - totals.since;
    if (elapsed < statsEveryMs) return;
    onStats({
      fps: (totals.frames * 1000) / elapsed,
      engineFps:
        ((totals.lastEngineFrame - totals.firstEngineFrame) * 1000) / elapsed,
      frameMs: totals.frameMs / totals.frames,
      scriptMs: totals.scriptMs / totals.frames,
      changed: totals.changed / totals.frames,
    });
    totals = { ...emptyTotals(), since: end };
    totals.firstEngineFrame = frame.engineFrame;
  }

  function draw() {
    frameRequest = 0;
    const frame = pending;
    pending = null;
    if (!frame) return;
    const start = performance.now();
    const colors = new Int32Array(frame.buffer);
    const changed = mode === "rows" ? paintRows(colors) : paintCells(colors);
    current = colors;
    drawn = {
      start,
      scriptMs: performance.now() - start,
      changed,
      engineFrame: frame.engineFrame,
    };
    after?.port2.postMessage(null);
  }

  function paintRows(colors: Int32Array) {
    const changedRows: Record<string, string> = {};
    let changed = 0;
    for (let row = 0; row < rowKeys.length; row += 1) {
      let rowChanged = 0;
      for (let index = row * columns; index < (row + 1) * columns; index += 1) {
        if (colors[index] !== current[index]) rowChanged += 1;
      }
      if (rowChanged === 0) continue;
      changed += rowChanged;
      changedRows[rowKeys[row] ?? ""] = rowGradient(
        colors,
        row,
        columns,
        stops,
      );
    }
    controller.paintRows(colors, changedRows);
    return changed;
  }

  function paintCells(colors: Int32Array) {
    const changedIndexes: number[] = [];
    const changedKeys: Record<string, number> = {};
    for (let index = 0; index < colors.length; index += 1) {
      if (colors[index] === current[index]) continue;
      changedIndexes.push(index);
      if (mode === "cells") changedKeys[keys[index] ?? ""] = colors[index] ?? 0;
    }
    if (mode === "cells") {
      controller.paint(colors, changedKeys);
    } else {
      controller.paint(colors, noChanges);
      elements ??= [...(target?.cells() ?? [])];
      for (const index of changedIndexes) {
        const cell = elements[index];
        if (cell) cell.style.backgroundColor = hexColor(colors[index] ?? 0);
      }
    }
    return changedIndexes.length;
  }

  return {
    resize(next: number) {
      columns = next;
      current = new Int32Array(pixelCount(next)).fill(-1);
      keys = Array.from({ length: pixelCount(next) }, (_, index) =>
        pixelKey(Math.floor(index / next), index % next),
      );
      rowKeys = Array.from({ length: rowsFor(next) }, (_, row) => rowKey(row));
      stops = columnStops(next);
      elements = null;
      pending = null;
      totals = emptyTotals();
    },
    setMode(next: PaintMode) {
      if (next === mode) return;
      if (mode === "rows") {
        controller.paintRows(
          current,
          Object.fromEntries(rowKeys.map((key) => [key, ""])),
        );
      }
      mode = next;
      // The new mode starts from nothing, so its first frame paints every pixel.
      current = new Int32Array(current.length).fill(-1);
    },
    colorAt(row: number, col: number) {
      return Math.max(0, current[row * columns + col] ?? 0);
    },
    attach(next: PainterTarget) {
      target = next;
      // A message posted after painting runs once the browser has drawn it.
      const channel = new MessageChannel();
      after = channel;
      channel.port1.addEventListener("message", () => {
        if (!drawn) return;
        record(drawn, performance.now());
        drawn = null;
        next.onDrawn();
      });
      channel.port1.start();
      return () => {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        pending = null;
        drawn = null;
        channel.port1.close();
        if (after === channel) after = null;
        if (target === next) target = null;
      };
    },
    receive(frame: DoomFrame) {
      if (frame.columns !== columns) {
        target?.onDrawn();
        return;
      }
      pending = frame;
      if (frameRequest === 0) frameRequest = requestAnimationFrame(draw);
    },
  };
}

export type Painter = ReturnType<typeof createPainter>;
