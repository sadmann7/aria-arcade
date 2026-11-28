import type { PixelGridController } from "./pixel-grid";
import type { DoomFrame } from "./use-doom";

import { pixelCount, rowsFor } from "./resolution";

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
  onDrawn: () => void;
}

const statsEveryMs = 1000;

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
  let current = new Int32Array(0);
  let rows = 0;
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
    const changed = paintCanvas(colors);
    current = colors;
    drawn = {
      start,
      scriptMs: performance.now() - start,
      changed,
      engineFrame: frame.engineFrame,
    };
    after?.port2.postMessage(null);
  }

  function changedIn(colors: Int32Array, row: number) {
    let changed = 0;
    for (let index = row * columns; index < (row + 1) * columns; index += 1) {
      if (colors[index] !== current[index]) changed += 1;
    }
    return changed;
  }

  function paintCanvas(colors: Int32Array) {
    let changed = 0;
    let top = -1;
    let bottom = -1;
    for (let row = 0; row < rows; row += 1) {
      const rowChanged = changedIn(colors, row);
      if (rowChanged === 0) continue;
      changed += rowChanged;
      if (top < 0) top = row;
      bottom = row;
    }
    controller.paintCanvas(colors, top, bottom);
    return changed;
  }

  return {
    resize(next: number) {
      columns = next;
      current = new Int32Array(pixelCount(next)).fill(-1);
      rows = rowsFor(next);
      pending = null;
      totals = emptyTotals();
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
