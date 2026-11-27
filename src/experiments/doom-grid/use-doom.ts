import { announce, prepareAnnouncements } from "@ui-sdk/core";
import * as React from "react";

import type { DoomRequest, DoomResponse } from "./doom-worker";

import { createThrottle, describeChanges } from "./announcer";
import { followPlayer, type Origin } from "./grid-map";
import {
  type Line,
  parseLines,
  parseSnapshot,
  type Snapshot,
} from "./snapshot";

const engineBase = "/doom-grid/engine/";
// The grid redraws this often; speech still hears every tic.
const renderEveryMs = 100;
const speakEveryMs = 150;

export interface DoomView {
  snapshot: Snapshot | null;
  lines: Line[];
  origin: Origin | null;
  error: string | null;
}

export function useDoom(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const workerRef = React.useRef<Worker | null>(null);
  const [view, setView] = React.useState<DoomView>({
    snapshot: null,
    lines: [],
    origin: null,
    error: null,
  });

  React.useEffect(() => {
    prepareAnnouncements(document);
    const worker = new Worker(new URL("./doom-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    const throttle = createThrottle({ gapMs: 900, maxWaiting: 4 });
    let image: ImageData | null = null;
    let previous: Snapshot | null = null;
    let lines: Line[] = [];
    let origin: Origin | null = null;
    let lastRender = -Infinity;

    const onMessage = (event: MessageEvent<DoomResponse>) => {
      const response = event.data;
      if (response.type === "frame") {
        const context = canvasRef.current?.getContext("2d");
        if (!context) return;
        if (image?.width !== response.width) {
          context.canvas.width = response.width;
          context.canvas.height = response.height;
          image = new ImageData(response.width, response.height);
        }
        image.data.set(new Uint8ClampedArray(response.buffer));
        context.putImageData(image, 0, 0);
        return;
      }
      if (response.type === "error") {
        setView((current) => ({ ...current, error: response.message }));
        return;
      }
      const snapshot = parseSnapshot(response.json);
      if (!snapshot) return;
      const now = performance.now();
      for (const said of describeChanges(previous, snapshot)) {
        throttle.push(said, now);
      }
      if (previous?.level !== snapshot.level) origin = null;
      if (response.lines !== null) lines = parseLines(response.lines);
      previous = snapshot;
      if (now - lastRender < renderEveryMs && response.lines === null) return;
      lastRender = now;
      origin = followPlayer(origin, snapshot.player.x, snapshot.player.y);
      setView({ snapshot, lines, origin, error: null });
    };
    worker.addEventListener("message", onMessage);
    const speaker = setInterval(() => {
      const next = throttle.take(performance.now());
      if (next) announce(next.text, { priority: next.priority });
    }, speakEveryMs);
    worker.postMessage({
      type: "start",
      engineBase: new URL(engineBase, location.href).href,
    } satisfies DoomRequest);
    return () => {
      clearInterval(speaker);
      worker.terminate();
      workerRef.current = null;
    };
  }, [canvasRef]);

  const send = React.useCallback((request: DoomRequest) => {
    workerRef.current?.postMessage(request);
  }, []);

  return { ...view, send };
}
