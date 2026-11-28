import {
  byCell,
  createController,
  createGridFocus,
  css,
  definePrimitive,
  type GridCell,
  live,
  selects,
} from "@ui-sdk/core";

import { hexColor } from "./resolution";

export interface PixelGridController {
  paint: (colors: Int32Array, changed: Record<string, number>) => void;
  paintRows: (colors: Int32Array, changed: Record<string, string>) => void;
  focusCell: (cell: GridCell) => boolean;
}

export interface PixelGridOptions {
  rows: number;
  columns: number;
  describe?: (cell: GridCell) => string;
  controller?: PixelGridController;
}

export function createPixelGridController() {
  return createController<PixelGridController>();
}

interface RowProps {
  id: string;
  row: number;
}

interface CellProps {
  id: string;
  row: number;
  col: number;
}

export function pixelKey(row: number, col: number) {
  return `${row}:${col}`;
}

const rowPrefix = "row-";

export function rowKey(row: number) {
  return `${rowPrefix}${row}`;
}

export const pixelGrid = definePrimitive({
  name: "pixel-grid",
  options: {
    rows: "number",
    columns: "number",
    describe: "action",
    controller: "value",
  },
  live: ["changed", "changedRows"],
  state: (_options: PixelGridOptions) => ({
    active: null as GridCell | null,
    // Each entry carries the new color, so a cell that changes on two frames
    // in a row still hears the second change.
    changed: {} as Record<string, number>,
    changedRows: {} as Record<string, string>,
  }),
  api: (context) => {
    let colors: Int32Array = new Int32Array(0);
    const gradients: string[] = [];
    const grid = createGridFocus(context, {
      key: "active",
      rows: () => context.options().rows,
      cols: () => context.options().columns,
      pageSize: () => 8,
    });
    return {
      grid,
      color: ({ row, col }: GridCell) =>
        colors[row * context.options().columns + col] ?? 0,
      describe: (cell: GridCell) => context.options().describe?.(cell) ?? "",
      gradient: (row: number) => gradients[row] ?? "",
      paint: (next: Int32Array, changed: Record<string, number>) => {
        colors = next;
        context.store.set({ changed });
      },
      paintRows: (next: Int32Array, changed: Record<string, string>) => {
        colors = next;
        for (const [key, gradient] of Object.entries(changed)) {
          gradients[Number(key.slice(rowPrefix.length))] = gradient;
        }
        context.store.set({ changedRows: changed });
      },
      focusCell: (cell: GridCell) => grid.focus(cell, { reason: "imperative" }),
    };
  },
  slots: (slot) => ({
    root: slot({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
    }),
    row: slot<RowProps>({
      props: { id: "string", row: "number" },
      role: "row",
      selects: selects({
        active: [],
        changed: [],
        changedRows: ({ key }) => [key],
      }),
      live: live((_state, { props, api }) => ({
        style: css({
          "background-image": api.gradient(props.row) || undefined,
        }),
      })),
    }),
    cell: slot<CellProps>({
      props: { id: "string", row: "number", col: "number" },
      role: "gridcell",
      focus: "roving",
      selects: selects({
        active: byCell,
        changed: ({ key }) => [key],
        changedRows: [],
      }),
      keys: [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "mod+Home",
        "mod+End",
        "PageUp",
        "PageDown",
      ],
      attrs: (state, { props, api }) => {
        const isActive = api.grid.isActive(state, props);
        return {
          tabindex: api.grid.tabIndex(state, props),
          "aria-label": isActive ? api.describe(props) : undefined,
          "data-active": isActive ? "" : undefined,
        };
      },
      live: live((_state, { props, api }) => ({
        style: css({ "background-color": hexColor(api.color(props)) }),
      })),
      on: {
        keydown: (event, { api }) => {
          api.grid.keydown(event);
        },
        pointerdown: (event, { api, props }) =>
          api.grid.focus(props, { reason: "item-press", event }),
      },
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
  agent: { actions: ["focusCell"] },
});
