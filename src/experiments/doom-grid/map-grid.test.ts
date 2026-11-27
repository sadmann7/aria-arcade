// @vitest-environment jsdom
import type { GridCell } from "@ui-sdk/core";

import { checkDirection, checkServer, mount } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vitest";

import { gridSize } from "./grid-map";
import {
  type CellMove,
  cellKey,
  mapGrid,
  type MapGridOptions,
} from "./map-grid";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

const door = { row: 2, col: 3 };

function markup() {
  const rows = Array.from({ length: gridSize }, (_, row) => {
    const cells = Array.from({ length: gridSize }, (_, col) => {
      const isDoor = row === door.row && col === door.col;
      const expanded = isDoor ? ' is-expanded="false"' : "";
      const disabled = isWall({ row, col }) ? " is-disabled" : "";
      return `<cell id="${cellKey({ row, col })}" row="${row}" col="${col}"${expanded}${disabled} aria-label="Cell ${row} ${col}"></cell>`;
    });
    return `<row>${cells.join("")}</row>`;
  });
  return `<root aria-label="Map">${rows.join("")}</root>`;
}

// The first row and the cell at 1:1 are walls.
const isWall = ({ row, col }: GridCell) =>
  row === 0 || (row === 1 && col === 1);

function setup(options: MapGridOptions = {}) {
  return mount(mapGrid, options, markup());
}

function focused() {
  return document.activeElement?.getAttribute("aria-label");
}

describe("mapGrid", () => {
  it("has one tab stop, on the first cell that isn't a wall", async () => {
    const view = setup();
    try {
      const stops = view.root.querySelectorAll('[tabindex="0"]');
      expect(stops).toHaveLength(1);
      await view.keys("Tab");
      expect(focused()).toBe("Cell 1 0");
    } finally {
      view.unmount();
    }
  });

  it("moves by arrows, skips walls, and reports each move", async () => {
    const moves: [GridCell, CellMove][] = [];
    const view = setup({
      onCellMove: (cell, move) => moves.push([cell, move]),
    });
    try {
      await view.keys("Tab", "ArrowRight");
      expect(focused()).toBe("Cell 1 2");
      await view.keys("ArrowDown", "ArrowLeft", "ArrowUp");
      expect(focused()).toBe("Cell 2 1");
      expect(moves.at(0)).toEqual([
        { row: 1, col: 2 },
        { from: null, reason: "list-navigation", shift: false },
      ]);
      await view.keys("Shift+ArrowRight");
      expect(moves.at(-1)?.[1].shift).toBe(true);
      expect(view.root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    } finally {
      view.unmount();
    }
  });

  it("activates a cell with Enter and Space", async () => {
    const onCellActivate = vi.fn();
    const view = setup({ onCellActivate });
    try {
      await view.keys("Tab", "Enter", "ArrowRight", "Space");
      expect(onCellActivate.mock.calls).toEqual([
        [{ row: 1, col: 0 }],
        [{ row: 1, col: 2 }],
      ]);
    } finally {
      view.unmount();
    }
  });

  it("hands other keys to the app, and moves focus from code", async () => {
    const onCellKey = vi.fn((event: KeyboardEvent) => event.key === "Escape");
    const view = setup({ onCellKey });
    try {
      await view.keys("Tab", "Escape", "x");
      expect(
        onCellKey.mock.calls.map(([event, cell]) => [event.key, cell]),
      ).toEqual([
        ["Escape", { row: 1, col: 0 }],
        ["x", { row: 1, col: 0 }],
      ]);
      view.api.focusCell({ row: 5, col: 6 });
      expect(focused()).toBe("Cell 5 6");
    } finally {
      view.unmount();
    }
  });

  it("marks walls disabled and a door's cell as expanded or not", () => {
    const view = setup();
    try {
      const expandable = view.root.querySelectorAll("[aria-expanded]");
      expect(expandable).toHaveLength(1);
      expect(expandable[0]?.getAttribute("aria-label")).toBe("Cell 2 3");
      expect(expandable[0]?.getAttribute("aria-expanded")).toBe("false");
      expect(view.root.querySelectorAll('[aria-disabled="true"]')).toHaveLength(
        gridSize + 1,
      );
      expect(view.root.getAttribute("role")).toBe("grid");
      expect(view.root.querySelectorAll('[role="row"]')).toHaveLength(gridSize);
    } finally {
      view.unmount();
    }
  });

  it("renders on the server and follows the reading direction", async () => {
    checkServer(mapGrid, {}, markup());
    await checkDirection(mapGrid, {}, markup());
  });
});
