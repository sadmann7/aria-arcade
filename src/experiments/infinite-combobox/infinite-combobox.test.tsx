// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

import { getDoors } from "./doors";
import { InfiniteCombobox } from "./infinite-combobox";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true;
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

afterEach(cleanup);

function layer(depth: number) {
  return screen.queryByRole("combobox", { name: `Layer ${depth} of 400` });
}

function firstDeeperDoor(depth: number, from: string) {
  const door = getDoors(depth, from).find((door) => door.quip === null);
  if (!door) throw new Error(`Layer ${depth} has no way down`);
  return door;
}

async function flush() {
  await act(() => settle());
}

async function openSurface() {
  const user = userEvent.setup();
  render(<InfiniteCombobox />);
  await user.click(screen.getByRole("button", { name: "Show doors" }));
  await flush();
  return user;
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  depth: number,
  label: string,
) {
  const input = layer(depth);
  if (!input) throw new Error(`Layer ${depth} is not open`);
  const list = document.getElementById(
    input.getAttribute("aria-controls") ?? "",
  );
  if (!list) throw new Error(`Layer ${depth} has no list`);
  await user.click(within(list).getByRole("option", { name: label }));
  await flush();
}

function highlighted(depth: number) {
  const input = layer(depth);
  const id = input?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : null;
}

describe("InfiniteCombobox", () => {
  test("choosing a door opens the next layer as a named combobox", async () => {
    const user = await openSurface();
    expect(layer(1)).not.toBeNull();
    expect(layer(2)).toBeNull();

    const door = firstDeeperDoor(1, "surface");
    await choose(user, 1, door.label);

    const next = layer(2);
    expect(next).not.toBeNull();
    expect(next).toHaveProperty("tagName", "INPUT");
    expect(document.activeElement).toBe(next);
    expect(
      screen.getByRole("button", { name: "Climb up to layer 1" }),
    ).not.toBeNull();
  });

  test("Escape closes exactly one layer and returns focus to its door", async () => {
    const user = await openSurface();
    const first = firstDeeperDoor(1, "surface");
    await choose(user, 1, first.label);
    const second = firstDeeperDoor(2, first.label);
    await choose(user, 2, second.label);
    const third = firstDeeperDoor(3, second.label);
    await choose(user, 3, third.label);
    expect(layer(4)).not.toBeNull();

    await user.keyboard("{Escape}");
    await flush();
    expect(layer(4)).toBeNull();
    expect(layer(3)).not.toBeNull();
    expect(document.activeElement).toBe(layer(3));
    expect(highlighted(3)).toContain(third.label);

    await user.keyboard("{Escape}");
    await flush();
    expect(layer(3)).toBeNull();
    expect(layer(2)).not.toBeNull();
    expect(document.activeElement).toBe(layer(2));
    expect(highlighted(2)).toContain(second.label);

    await user.keyboard("{Escape}");
    await flush();
    expect(layer(2)).toBeNull();
    expect(document.activeElement).toBe(layer(1));
    expect(highlighted(1)).toContain(first.label);
  });

  test("the climb button closes one layer too", async () => {
    const user = await openSurface();
    const first = firstDeeperDoor(1, "surface");
    await choose(user, 1, first.label);
    const second = firstDeeperDoor(2, first.label);
    await choose(user, 2, second.label);

    await user.click(
      screen.getByRole("button", { name: "Climb up to layer 2" }),
    );
    await flush();
    expect(layer(3)).toBeNull();
    expect(layer(2)).not.toBeNull();
  });

  test("the HUD backs out of the top layer from anywhere", async () => {
    const user = await openSurface();
    const first = firstDeeperDoor(1, "surface");
    await choose(user, 1, first.label);
    const second = firstDeeperDoor(2, first.label);
    await choose(user, 2, second.label);

    await user.click(
      screen.getByRole("button", { name: "Back out of layer 3" }),
    );
    await flush();
    expect(layer(3)).toBeNull();
    expect(document.activeElement).toBe(layer(2));
    expect(highlighted(2)).toContain(second.label);
  });

  test("a dead end says something and opens nothing", async () => {
    const user = await openSurface();
    const deadEnd = getDoors(1, "surface").find((door) => door.quip !== null);
    if (!deadEnd?.quip) throw new Error("Layer 1 has no dead end");

    await choose(user, 1, deadEnd.label);
    expect(layer(2)).toBeNull();
    expect(screen.getByText(deadEnd.quip)).not.toBeNull();
  });

  test("choosing the same door again after climbing back reopens it", async () => {
    const user = await openSurface();
    const first = firstDeeperDoor(1, "surface");
    await choose(user, 1, first.label);
    await user.keyboard("{Escape}");
    await flush();
    expect(layer(2)).toBeNull();

    await choose(user, 1, first.label);
    expect(layer(2)).not.toBeNull();
  });
});
