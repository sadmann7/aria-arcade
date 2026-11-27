import {
  byCell,
  createController,
  createGridFocus,
  definePrimitive,
  type GridCell,
  type GridFocusReason,
  selects,
} from "@ui-sdk/core";

import { gridSize } from "./grid-map";

export interface CellMove {
  from: GridCell | null;
  reason: GridFocusReason;
  shift: boolean;
}

export interface MapGridController {
  focusCell: (cell: GridCell) => boolean;
  active: () => GridCell | null;
}

export interface MapGridOptions {
  onCellMove?: (cell: GridCell, move: CellMove) => void;
  onCellActivate?: (cell: GridCell) => void;
  onCellKey?: (event: KeyboardEvent, cell: GridCell) => boolean;
  controller?: MapGridController;
}

export function createMapGridController() {
  return createController<MapGridController>();
}

interface CellProps {
  id: string;
  row: number;
  col: number;
  isDisabled?: boolean;
  isExpanded?: boolean;
}

export function gridCellKey({ row, col }: GridCell) {
  return `cell-${row}-${col}`;
}

export const mapGrid = definePrimitive({
  name: "map-grid",
  options: {
    onCellMove: "callback",
    onCellActivate: "callback",
    onCellKey: "action",
    controller: "value",
  },
  state: (_options: MapGridOptions) => ({ active: null as GridCell | null }),
  api: (context) => {
    const grid = createGridFocus(context, {
      key: "active",
      rows: () => gridSize,
      cols: () => gridSize,
      pageSize: () => 6,
      disabled: (cell) =>
        context.props<CellProps>("cell", gridCellKey(cell))?.isDisabled ??
        false,
      onMove: (cell, { from, reason, shift }) =>
        context.options().onCellMove?.(cell, { from, reason, shift }),
    });
    const api = {
      grid,
      active: () => grid.active(),
      focusCell: (cell: GridCell) => grid.focus(cell, { reason: "imperative" }),
      activate: (cell: GridCell) => context.options().onCellActivate?.(cell),
      handleKey: (event: KeyboardEvent, cell: GridCell) =>
        context.options().onCellKey?.(event, cell) ?? false,
    };
    return api;
  },
  slots: (slot) => ({
    root: slot({
      role: "grid",
      keys: { none: "Focus stays on a cell, whose keydown handles them." },
    }),
    row: slot({ role: "row" }),
    cell: slot<CellProps>({
      props: {
        id: "string",
        row: "number",
        col: "number",
        isDisabled: "boolean",
        isExpanded: "boolean",
      },
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
        "Enter",
        " ",
        "Escape",
        "t",
      ],
      attrs: (state, { props, api }) => ({
        tabindex: props.isDisabled ? "-1" : api.grid.tabIndex(state, props),
        "aria-disabled": props.isDisabled ? "true" : undefined,
        "aria-expanded":
          props.isExpanded === undefined ? undefined : String(props.isExpanded),
        "data-active": api.grid.isActive(state, props) ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, props }) => {
          const key = event;
          const cell = { row: props.row, col: props.col };
          if (key.key === "Enter" || key.key === " ") {
            key.preventDefault();
            api.activate(cell);
            return;
          }
          if (api.grid.keydown(key)) return;
          if (key.ctrlKey || key.metaKey || key.altKey) return;
          if (api.handleKey(key, cell)) key.preventDefault();
        },
        pointerdown: (event, { api, props }) =>
          api.grid.focus(props, { reason: "item-press", event }),
      },
      press: ({ api, props }) =>
        api.activate({ row: props.row, col: props.col }),
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
  agent: { actions: ["focusCell", "activate"] },
});
