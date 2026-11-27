import * as React from "react";

import type { DoomRequest, DoomResponse } from "./doom-worker";

import {
  type Line,
  parseLines,
  parseSnapshot,
  type Snapshot,
} from "./snapshot";

const engineBase = "/doom-grid/engine/";

interface DoomState {
  snapshot: Snapshot | null;
  lines: Line[];
  error: string | null;
}

export function useDoom(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const workerRef = React.useRef<Worker | null>(null);
  const [state, setState] = React.useState<DoomState>({
    snapshot: null,
    lines: [],
    error: null,
  });

  React.useEffect(() => {
    const worker = new Worker(new URL("./doom-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    let image: ImageData | null = null;
    worker.addEventListener("message", (event: MessageEvent<DoomResponse>) => {
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
      } else if (response.type === "snapshot") {
        const snapshot = parseSnapshot(response.json);
        const lines =
          response.lines === null ? null : parseLines(response.lines);
        if (snapshot) {
          console.log(
            `tic ${snapshot.tic}`,
            snapshot.player,
            snapshot.monsters,
          );
        }
        setState((previous) => ({
          ...previous,
          snapshot,
          lines: lines ?? previous.lines,
        }));
      } else {
        setState((previous) => ({ ...previous, error: response.message }));
      }
    });
    worker.postMessage({
      type: "start",
      engineBase: new URL(engineBase, location.href).href,
    } satisfies DoomRequest);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [canvasRef]);

  const send = React.useCallback((request: DoomRequest) => {
    workerRef.current?.postMessage(request);
  }, []);

  return { ...state, send };
}
