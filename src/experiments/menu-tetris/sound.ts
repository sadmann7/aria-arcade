import { armedRows, dropDistance, type Game, level } from "./game";

export type Effect =
  | "move"
  | "rotate"
  | "lock"
  | "drop"
  | "armed"
  | "level"
  | "over"
  | "visit"
  | "clear";

interface Tone {
  at: number;
  length: number;
  from: number;
  to?: number;
  wave: OscillatorType;
  volume: number;
}

const TONES: Record<Effect, Tone[]> = {
  move: [{ at: 0, length: 0.03, from: 520, wave: "square", volume: 0.04 }],
  rotate: [
    { at: 0, length: 0.05, from: 660, to: 880, wave: "square", volume: 0.04 },
  ],
  lock: [
    { at: 0, length: 0.08, from: 180, to: 90, wave: "triangle", volume: 0.2 },
  ],
  drop: [
    { at: 0, length: 0.14, from: 260, to: 60, wave: "triangle", volume: 0.3 },
    { at: 0, length: 0.06, from: 120, wave: "square", volume: 0.06 },
  ],
  armed: [
    { at: 0, length: 0.1, from: 660, wave: "triangle", volume: 0.14 },
    { at: 0.09, length: 0.16, from: 990, wave: "triangle", volume: 0.14 },
  ],
  level: [523, 659, 784, 1047].map((from, index) => ({
    at: index * 0.08,
    length: 0.12,
    from,
    wave: "square" as const,
    volume: 0.06,
  })),
  over: [392, 330, 262, 196].map((from, index) => ({
    at: index * 0.16,
    length: 0.22,
    from,
    wave: "triangle" as const,
    volume: 0.18,
  })),
  visit: [{ at: 0, length: 0.05, from: 440, wave: "sine", volume: 0.12 }],
  clear: [
    { at: 0, length: 0.3, from: 400, to: 1600, wave: "sawtooth", volume: 0.05 },
    { at: 0.05, length: 0.25, from: 800, to: 2400, wave: "sine", volume: 0.1 },
  ],
};

const SEMITONE = 2 ** (1 / 12);
const STORAGE_KEY = "menu-tetris:muted";

export function effectsOf(before: Game, after: Game): Effect[] {
  if (before.status === "playing" && after.status === "over") return ["over"];
  const was = before.falling;
  const now = after.falling;
  if (!was || !now) return [];
  const effects: Effect[] = [];
  if (now.id !== was.id) {
    effects.push(dropDistance(before) > 0 ? "drop" : "lock");
    const armedBefore = new Set(armedRows(before));
    if (armedRows(after).some((row) => !armedBefore.has(row))) {
      effects.push("armed");
    }
  } else if (now.rotation !== was.rotation) {
    effects.push("rotate");
  } else if (now.col !== was.col) {
    effects.push("move");
  }
  if (level(after) > level(before)) effects.push("level");
  return effects;
}

export interface Sound {
  play: (effect: Effect, step?: number) => void;
  isMuted: () => boolean;
  setMuted: (isMuted: boolean) => void;
  subscribe: (listener: () => void) => () => void;
  close: () => void;
}

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function createSound(): Sound {
  let context: AudioContext | null = null;
  let isMuted: boolean | null = null;
  const listeners = new Set<() => void>();

  function muted() {
    isMuted ??= readMuted();
    return isMuted;
  }

  function audio() {
    if (context) return context;
    if (typeof AudioContext === "undefined") return null;
    context = new AudioContext();
    return context;
  }

  return {
    play(effect, step = 0) {
      if (muted()) return;
      const output = audio();
      if (!output) return;
      if (output.state === "suspended") void output.resume();
      const start = output.currentTime;
      const shift = SEMITONE ** (step * 2);
      for (const tone of TONES[effect]) {
        const oscillator = output.createOscillator();
        const gain = output.createGain();
        const begin = start + tone.at;
        const end = begin + tone.length;
        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.from * shift, begin);
        if (tone.to) {
          oscillator.frequency.exponentialRampToValueAtTime(
            tone.to * shift,
            end,
          );
        }
        gain.gain.setValueAtTime(tone.volume, begin);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain).connect(output.destination);
        oscillator.start(begin);
        oscillator.stop(end);
      }
    },
    isMuted: muted,
    setMuted(next) {
      isMuted = next;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      void context?.close();
      context = null;
    },
  };
}
