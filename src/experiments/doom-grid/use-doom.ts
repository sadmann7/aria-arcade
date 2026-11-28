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

const audioWorklet = `
class DoomAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.played = 0;
    this.calls = 0;
    this.link = null;
    this.port.onmessage = (event) => {
      this.link = event.data;
      this.link.onmessage = (message) => this.queue.push(message.data);
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    const length = out[0].length;
    let written = 0;
    while (written < length && this.queue.length > 0) {
      const chunk = this.queue[0];
      const size = chunk[0].length;
      const take = Math.min(length - written, size - this.offset);
      for (let channel = 0; channel < out.length; channel += 1) {
        const source = chunk[channel] ?? chunk[0];
        out[channel].set(source.subarray(this.offset, this.offset + take), written);
      }
      written += take;
      this.offset += take;
      this.played += take;
      if (this.offset >= size) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    this.calls += 1;
    if (this.link && this.calls % 4 === 0) this.link.postMessage(this.played);
    return true;
  }
}
registerProcessor("doom-audio", DoomAudio);
`;

async function connectAudio(audio: AudioContext) {
  const url = URL.createObjectURL(
    new Blob([audioWorklet], { type: "text/javascript" }),
  );
  try {
    await audio.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const node = new AudioWorkletNode(audio, "doom-audio", {
    numberOfInputs: 0,
    outputChannelCount: [2],
  });
  node.connect(audio.destination);
  // The worklet and worker talk directly, so a busy page can't delay audio.
  const channel = new MessageChannel();
  node.port.postMessage(channel.port1, [channel.port1]);
  return channel.port2;
}

export interface DoomView {
  snapshot: Snapshot | null;
  lines: Line[];
  origin: Origin | null;
  isIntermission: boolean;
  error: string | null;
}

export function useDoom(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const workerRef = React.useRef<Worker | null>(null);
  const [isAudioAvailable, setIsAudioAvailable] = React.useState(true);
  const [view, setView] = React.useState<DoomView>({
    snapshot: null,
    lines: [],
    origin: null,
    isIntermission: false,
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
        if (
          context.canvas.width !== response.width ||
          image?.width !== response.width
        ) {
          context.canvas.width = response.width;
          context.canvas.height = response.height;
          image = new ImageData(response.width, response.height);
        }
        image.data.set(new Uint8ClampedArray(response.buffer));
        context.putImageData(image, 0, 0);
        return;
      }
      if (response.type === "intermission") {
        throttle.push(
          {
            key: "level",
            text: "Map complete. Press Enter on the map to continue.",
            priority: "assertive",
            cooldownMs: 0,
          },
          performance.now(),
        );
        setView((current) => ({ ...current, isIntermission: true }));
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
      setView({ snapshot, lines, origin, isIntermission: false, error: null });
    };
    worker.addEventListener("message", onMessage);
    const speaker = setInterval(() => {
      const next = throttle.take(performance.now());
      if (next) announce(next.text, { priority: next.priority });
    }, speakEveryMs);
    // AudioWorklet only exists on HTTPS and localhost; the game runs without it.
    const audio =
      typeof AudioContext === "undefined" ? null : new AudioContext();
    const resumeAudio = () => {
      if (audio?.state === "suspended") void audio.resume();
    };
    const onVisibilityChange = () => {
      worker.postMessage({
        type: "hidden",
        isHidden: document.hidden,
      } satisfies DoomRequest);
    };
    document.addEventListener("pointerdown", resumeAudio, true);
    document.addEventListener("keydown", resumeAudio, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    const connecting = audio
      ? connectAudio(audio).catch(() => null)
      : Promise.resolve(null);
    void connecting.then((audioPort) => {
      if (!audioPort) setIsAudioAvailable(false);
      worker.postMessage(
        {
          type: "start",
          engineBase: new URL(engineBase, location.href).href,
          sampleRate: audio?.sampleRate ?? 0,
          audioPort,
        } satisfies DoomRequest,
        audioPort ? [audioPort] : [],
      );
    });
    return () => {
      clearInterval(speaker);
      document.removeEventListener("pointerdown", resumeAudio, true);
      document.removeEventListener("keydown", resumeAudio, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void audio?.close();
      worker.terminate();
      workerRef.current = null;
    };
  }, [canvasRef]);

  const send = React.useCallback((request: DoomRequest) => {
    workerRef.current?.postMessage(request);
  }, []);

  return { ...view, isAudioAvailable, send };
}
