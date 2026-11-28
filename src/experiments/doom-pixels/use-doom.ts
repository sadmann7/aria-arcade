import * as React from "react";

import type { DoomRequest, DoomResponse } from "./doom-worker";

const engineBase = "/doom-pixels/engine/";

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

export type DoomFrame = Extract<DoomResponse, { type: "frame" }>;

export function useDoom(columns: number, onFrame: (frame: DoomFrame) => void) {
  const workerRef = React.useRef<Worker | null>(null);
  const onFrameRef = React.useRef(onFrame);
  const columnsRef = React.useRef(columns);
  const [isAudioAvailable, setIsAudioAvailable] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onFrameRef.current = onFrame;
    columnsRef.current = columns;
  });

  React.useEffect(() => {
    const worker = new Worker(new URL("./doom-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    let isDisposed = false;
    const onMessage = (event: MessageEvent<DoomResponse>) => {
      const response = event.data;
      if (response.type === "frame") onFrameRef.current(response);
      else setError(response.message);
    };
    worker.addEventListener("message", onMessage);
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
      if (isDisposed) return;
      if (!audioPort) setIsAudioAvailable(false);
      worker.postMessage(
        {
          type: "start",
          engineBase: new URL(engineBase, location.href).href,
          columns: columnsRef.current,
          sampleRate: audio?.sampleRate ?? 0,
          audioPort,
        } satisfies DoomRequest,
        audioPort ? [audioPort] : [],
      );
    });
    return () => {
      isDisposed = true;
      document.removeEventListener("pointerdown", resumeAudio, true);
      document.removeEventListener("keydown", resumeAudio, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void audio?.close();
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = React.useCallback((request: DoomRequest) => {
    workerRef.current?.postMessage(request);
  }, []);

  return { error, isAudioAvailable, send };
}
