import {
  byCell,
  createController,
  createGridFocus,
  definePrimitive,
  type GridCell,
  selects,
} from "@ui-sdk/core";

export interface PixelGridController {
  paintCanvas: (colors: Int32Array, top: number, bottom: number) => void;
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

export function rowKey(row: number) {
  return `row-${row}`;
}

export const pixelGrid = definePrimitive({
  name: "pixel-grid",
  options: {
    rows: "number",
    columns: "number",
    describe: "action",
    controller: "value",
  },
  state: (_options: PixelGridOptions) => ({
    active: null as GridCell | null,
  }),
  api: (context) => {
    let canvas: HTMLCanvasElement | null = null;
    let canvasContext: CanvasRenderingContext2D | null = null;
    let image: ImageData | null = null;
    const drawing = () => {
      if (!canvas) return null;
      canvasContext ??= canvas.getContext("2d");
      return canvasContext;
    };
    const grid = createGridFocus(context, {
      key: "active",
      rows: () => context.options().rows,
      cols: () => context.options().columns,
      pageSize: () => 8,
    });
    return {
      grid,
      describe: (cell: GridCell) => context.options().describe?.(cell) ?? "",
      bindCanvas: (el: HTMLCanvasElement) => {
        const { rows, columns } = context.options();
        el.width = columns;
        el.height = rows;
        canvas = el;
        return () => {
          if (canvas !== el) return;
          canvas = null;
          canvasContext = null;
          image = null;
        };
      },
      paintCanvas: (next: Int32Array, top: number, bottom: number) => {
        const drawn = drawing();
        if (!drawn || top < 0 || bottom < top) return;
        const { rows, columns } = context.options();
        image ??= drawn.createImageData(columns, rows);
        const bytes = image.data;
        for (
          let index = top * columns;
          index < (bottom + 1) * columns;
          index += 1
        ) {
          const color = next[index] ?? 0;
          const at = index * 4;
          bytes[at] = (color >> 16) & 255;
          bytes[at + 1] = (color >> 8) & 255;
          bytes[at + 2] = color & 255;
          bytes[at + 3] = 255;
        }
        drawn.putImageData(image, 0, 0, 0, top, columns, bottom - top + 1);
      },
      focusCell: (cell: GridCell) => grid.focus(cell, { reason: "imperative" }),
    };
  },
  slots: (slot) => ({
    root: slot({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
    }),
    canvas: slot({
      selects: selects({ active: [] }),
      attrs: () => ({ "aria-hidden": "true" }),
      bind: (el, { api }) => {
        if (el instanceof HTMLCanvasElement) return api.bindCanvas(el);
      },
    }),
    row: slot<RowProps>({
      props: { id: "string", row: "number" },
      role: "row",
      selects: selects({ active: [] }),
    }),
    cell: slot<CellProps>({
      props: { id: "string", row: "number", col: "number" },
      role: "gridcell",
      focus: "roving",
      selects: selects({ active: byCell }),
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
