// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { DoomRequest, DoomResponse } from "./doom-worker";

import { DoomGrid } from "./doom-grid";
import { testSnapshot } from "./test-snapshot";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

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
  HTMLCanvasElement.prototype.getContext = () => null;
});

afterEach(cleanup);

it("names every control, and an agent can slow the game down", async () => {
  const agent = createAgent();
  render(<DoomGrid />);
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
  for (const label of ["Show 3D view", "Slow", "Pause on select", "Map"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label);
  }
  expect(screen.getByRole("grid", { name: "Map" })).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(24);

  const result = await agent.act({
    steps: [{ ref: "Slow", action: "toggle" }],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(sent).toContainEqual({ type: "speed", percent: 40 });
});

it("keeps the game running with the 3D view hidden", async () => {
  render(<DoomGrid />);
  const toggle = screen.getByRole("switch", { name: "Show 3D view" });
  expect(document.querySelector("canvas")).not.toBeNull();
  toggle.click();
  await screen.findByRole("switch", { name: "Show 3D view", checked: false });
  expect(document.querySelector("canvas")).toBeNull();
  expect(screen.getByRole("grid", { name: "Map" })).toBeTruthy();
  expect(sent.filter((message) => message.type === "start")).toHaveLength(1);
});

it("says how to build the engine in place of the 3D view when it's missing", () => {
  render(<DoomGrid />);
  expect(document.querySelector("canvas")).not.toBeNull();
  const message =
    "The Doom engine isn't built in this checkout. Run pnpm setup:engine, then reload.";
  act(() => reply({ type: "error", message }));
  expect(screen.getByText(message).getAttribute("role")).toBe("alert");
  expect(document.querySelector("canvas")).toBeNull();
  expect(screen.getByText("Freedoom didn't load.")).toBeTruthy();
});

it("switches to an owned weapon from its number key on the map", async () => {
  render(<DoomGrid />);
  act(() =>
    reply({
      type: "snapshot",
      json: JSON.stringify({
        ...testSnapshot(),
        player: { ...testSnapshot().player, dead: 0 },
        walk: [0, 0],
        firing: 0,
        message: [0, ""],
      }),
      lines: "[]",
    }),
  );
  const you = await screen.findByRole("gridcell", { name: /^You/ });
  act(() => you.focus());
  fireEvent.keyDown(you, { key: "2" });
  fireEvent.keyDown(you, { key: "5" });
  expect(sent.filter((message) => message.type === "weapon")).toEqual([
    { type: "weapon", key: "2" },
  ]);
});
