// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { DoomRequest, DoomResponse } from "./doom-worker";

import { DoomPixels } from "./doom-pixels";
import { hexColor } from "./resolution";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    }),
  );
});

let sent: DoomRequest[] = [];
let reply: (response: DoomResponse) => void = () => {};

beforeEach(() => {
  sent = [];
  globalThis.Worker = class {
    postMessage(message: DoomRequest) {
      sent.push(message);
    }
    addEventListener(
      _type: string,
      listener: (event: MessageEvent<DoomResponse>) => void,
    ) {
      reply = (data) => listener({ data } as MessageEvent<DoomResponse>);
    }
    terminate() {}
  } as unknown as typeof Worker;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubAudio() {
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 48_000;
      state = "running";
      destination = {};
      audioWorklet = { addModule: () => Promise.resolve() };
      close() {
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { postMessage() {} };
      connect() {}
    },
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: () => "blob:",
      revokeObjectURL() {},
    }),
  );
}

function keys() {
  return sent.filter((message) => message.type === "key");
}

it("names every control and draws one grid cell per pixel", async () => {
  const agent = createAgent();
  render(<DoomPixels />);
  const components = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) {
    expect(
      entry.label,
      `${entry.component} ${entry.ref} has no name`,
    ).toBeTruthy();
  }
  const labels = components.map((entry) => entry.label);
  for (const label of ["Resolution", "Paint with", "Show grid", "Sound"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label);
  }
  const grid = screen.getByRole("grid", { name: "Doom screen, 160 × 100" });
  expect(grid.querySelectorAll('[role="row"]')).toHaveLength(100);
  expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(16_000);
  await vi.waitFor(() =>
    expect(sent).toContainEqual(
      expect.objectContaining({ type: "start", columns: 160 }),
    ),
  );
});

it("plays from the keyboard while the screen has focus, and pauses on P", () => {
  render(<DoomPixels />);
  const cell = screen.getAllByRole("gridcell")[0];
  if (!cell) throw new Error("No cells.");
  act(() => cell.focus());
  expect(sent).toContainEqual({ type: "pause", isPaused: false });
  fireEvent.keyDown(cell, { key: "ArrowRight", code: "ArrowRight" });
  fireEvent.keyDown(cell, { key: "f", code: "KeyF" });
  fireEvent.keyUp(cell, { key: "ArrowRight", code: "ArrowRight" });
  expect(keys()).toEqual([
    { type: "key", isPressed: true, key: 0xae },
    { type: "key", isPressed: true, key: 0x8d },
    { type: "key", isPressed: false, key: 0xae },
  ]);
  expect(document.activeElement).toBe(cell);

  fireEvent.keyDown(cell, { key: "p", code: "KeyP" });
  expect(sent.at(-1)).toEqual({ type: "pause", isPaused: true });
  expect(keys().at(-1)).toEqual({ type: "key", isPressed: false, key: 0x8d });
  const before = keys().length;
  fireEvent.keyDown(cell, { key: "ArrowRight", code: "ArrowRight" });
  expect(keys()).toHaveLength(before);
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "#000000, row 1, column 2",
  );
});

it("lets go of held keys and pauses when focus leaves the screen", () => {
  render(<DoomPixels />);
  const cell = screen.getAllByRole("gridcell")[0];
  if (!cell) throw new Error("No cells.");
  act(() => cell.focus());
  fireEvent.keyDown(cell, { key: "ArrowUp", code: "ArrowUp" });
  act(() => screen.getByRole("button", { name: "Pause" }).focus());
  expect(keys().at(-1)).toEqual({ type: "key", isPressed: false, key: 0xad });
  expect(sent.at(-1)).toEqual({ type: "pause", isPaused: true });
});

it("rebuilds the grid at a new resolution", async () => {
  const user = userEvent.setup();
  render(<DoomPixels />);
  await user.click(screen.getByRole("combobox", { name: "Resolution" }));
  await user.click(await screen.findByRole("option", { name: /^40 × 25/ }));
  const grid = await screen.findByRole("grid", {
    name: "Doom screen, 40 × 25",
  });
  expect(grid.querySelectorAll('[role="gridcell"]')).toHaveLength(1000);
  expect(sent).toContainEqual({ type: "resolution", columns: 40 });
});

it("mutes the game from the sound switch", async () => {
  stubAudio();
  render(<DoomPixels />);
  const toggle = screen.getByRole("switch", { name: "Sound" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  toggle.click();
  await screen.findByRole("switch", { name: "Sound", checked: false });
  expect(sent).toContainEqual({ type: "sound", isMuted: true });
});

it("turns the sound switch off and says why when audio is unavailable", async () => {
  render(<DoomPixels />);
  const toggle = await screen.findByRole("switch", {
    name: "Sound",
    checked: false,
  });
  expect(toggle.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Needs HTTPS or localhost")).toBeTruthy();
});

it("pauses the game while the tab is hidden", () => {
  render(<DoomPixels />);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  delete (document as { hidden?: boolean }).hidden;
  expect(sent).toContainEqual({ type: "hidden", isHidden: true });
});

it("says how to build the engine when it's missing", () => {
  render(<DoomPixels />);
  const message =
    "The Doom engine isn't built in this checkout. Run pnpm setup:engine, then reload.";
  act(() => reply({ type: "error", message }));
  expect(screen.getByText(message).closest('[role="alert"]')).toBeTruthy();
  expect(screen.queryByRole("grid")).toBeNull();
});

async function sendFrame(color: number, frame: number) {
  const colors = new Int32Array(16_000).fill(color);
  act(() =>
    reply({
      type: "frame",
      buffer: colors.buffer,
      columns: 160,
      rows: 100,
      engineFrame: frame,
    }),
  );
  await vi.waitFor(() =>
    expect(sent.filter((message) => message.type === "drawn")).toHaveLength(
      frame,
    ),
  );
}

function cellColor() {
  return screen.getAllByRole("gridcell")[0]?.style.backgroundColor;
}

function rowStyle() {
  return screen.getAllByRole("row")[0]?.getAttribute("style") ?? "";
}

it.each(["Live cells", "Style writes"])(
  "repaints a pixel that changes on frames in a row with %s",
  async (mode) => {
    const user = userEvent.setup();
    render(<DoomPixels />);
    await user.click(screen.getByRole("radio", { name: mode }));
    for (const [index, color] of [0x080808, 0x101010, 0x181818].entries()) {
      await sendFrame(color, index + 1);
      expect(cellColor()).toBe(hexToRgb(hexColor(color)));
    }
  },
);

it("paints whole scanlines as gradients with Live rows", async () => {
  const user = userEvent.setup();
  render(<DoomPixels />);
  expect(
    screen
      .getByRole("radio", { name: "Live rows" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  await user.click(screen.getByRole("switch", { name: "Show grid" }));
  await screen.findByRole("switch", { name: "Show grid", checked: true });
  for (const [index, color] of [0x080808, 0x101010].entries()) {
    await sendFrame(color, index + 1);
    expect(rowStyle()).toContain(hexToRgb(hexColor(color)));
  }
  expect(cellColor()).not.toBe(hexToRgb("#101010"));

  await user.click(screen.getByRole("radio", { name: "Live cells" }));
  await sendFrame(0x101010, 3);
  expect(cellColor()).toBe(hexToRgb("#101010"));
  expect(rowStyle()).not.toContain("gradient");
});

it("starts a new resolution with no gradients from the old one", async () => {
  const user = userEvent.setup();
  render(<DoomPixels />);
  await sendFrame(0x080808, 1);
  expect(rowStyle()).toContain("gradient");
  await user.click(screen.getByRole("combobox", { name: "Resolution" }));
  await user.click(await screen.findByRole("option", { name: /^40 × 25/ }));
  await screen.findByRole("grid", { name: "Doom screen, 40 × 25" });
  for (const row of screen.getAllByRole("row")) {
    expect(row.getAttribute("style") ?? "").not.toContain("gradient");
  }
  await user.click(screen.getByRole("radio", { name: "Live cells" }));
  await user.click(screen.getByRole("combobox", { name: "Resolution" }));
  await user.click(await screen.findByRole("option", { name: /^80 × 50/ }));
  await screen.findByRole("grid", { name: "Doom screen, 80 × 50" });
  for (const row of screen.getAllByRole("row")) {
    expect(row.getAttribute("style") ?? "").not.toContain("gradient");
  }
});

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
}
