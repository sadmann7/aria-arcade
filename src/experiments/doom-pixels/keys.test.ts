import { expect, it } from "vitest";

import { doomKey } from "./keys";

it("maps the keyboard to Woof's default bindings", () => {
  const press = (code: string, key = "") => doomKey({ code, key });
  expect(press("ArrowUp")).toBe(0xad);
  expect(press("ArrowLeft")).toBe(0xac);
  expect(press("KeyW", "w")).toBe("w".charCodeAt(0));
  expect(press("KeyF", "f")).toBe(press("ControlLeft"));
  expect(press("KeyE", "e")).toBe(press("Space", " "));
  expect(press("Digit3", "3")).toBe("3".charCodeAt(0));
  expect(press("KeyM", "m")).toBe(9);
  expect(press("Escape")).toBe(27);
});

it("leaves Tab and unbound keys to the page", () => {
  expect(doomKey({ code: "Tab", key: "Tab" })).toBeNull();
  expect(doomKey({ code: "Digit9", key: "9" })).toBe("9".charCodeAt(0));
  expect(doomKey({ code: "F5", key: "F5" })).toBeNull();
});
