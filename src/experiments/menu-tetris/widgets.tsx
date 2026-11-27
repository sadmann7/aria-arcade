"use client";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { createMenubarController, Menubar } from "@ui-sdk/react/menubar";
import {
  createRadioGroupController,
  Radio,
  RadioGroup,
} from "@ui-sdk/react/radio";
import {
  createSegmentedControlController,
  SegmentedControl,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import {
  createTabsController,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import {
  createToggleGroupController,
  Toggle,
  ToggleGroup,
} from "@ui-sdk/react/toggle";
import {
  createToolbarController,
  Toolbar,
  ToolbarButton,
} from "@ui-sdk/react/toolbar";
import * as React from "react";

import { type Kind, type Point, rowFromBottom } from "./game";

export interface CellView extends Point {
  id: string;
  isArmed: boolean;
  isVisited: boolean;
}

export interface PieceView {
  id: number;
  kind: Kind;
  cells: CellView[];
}

export const WIDGETS: Record<
  Kind,
  { name: string; color: string; items: [string, string][] }
> = {
  I: {
    name: "I toolbar",
    color: "oklch(0.82 0.13 210)",
    items: [
      ["Bold", "B"],
      ["Italic", "I"],
      ["Underline", "U"],
      ["Strike", "S"],
    ],
  },
  O: {
    name: "O button group",
    color: "oklch(0.88 0.15 95)",
    items: [
      ["Star", "★"],
      ["Heart", "♥"],
      ["Flag", "⚑"],
      ["Pin", "✦"],
    ],
  },
  T: {
    name: "T menubar",
    color: "oklch(0.74 0.17 305)",
    items: [
      ["File", "F"],
      ["Edit", "E"],
      ["View", "V"],
      ["Help", "H"],
    ],
  },
  S: {
    name: "S tab list",
    color: "oklch(0.8 0.17 150)",
    items: [
      ["Tab 1", "1"],
      ["Tab 2", "2"],
      ["Tab 3", "3"],
      ["Tab 4", "4"],
    ],
  },
  Z: {
    name: "Z segmented control",
    color: "oklch(0.72 0.18 25)",
    items: [
      ["Extra small", "XS"],
      ["Small", "S"],
      ["Medium", "M"],
      ["Large", "L"],
    ],
  },
  J: {
    name: "J radio group",
    color: "oklch(0.72 0.14 260)",
    items: [
      ["Yes", "Y"],
      ["No", "N"],
      ["Maybe", "?"],
      ["Ask later", "…"],
    ],
  },
  L: {
    name: "L menubar",
    color: "oklch(0.8 0.15 60)",
    items: [
      ["Undo", "↶"],
      ["Redo", "↷"],
      ["Cut", "✂"],
      ["Copy", "⧉"],
    ],
  },
};

function itemOf(kind: Kind, cellId: string) {
  const index = Number(cellId.split("-").at(-1));
  return WIDGETS[kind].items[index] ?? (["Block", "■"] as const);
}

export function cellLabel(kind: Kind, cell: CellView) {
  const [name] = itemOf(kind, cell.id);
  const where = `row ${rowFromBottom(cell.row)}, column ${cell.col + 1}`;
  const state = cell.isArmed ? (cell.isVisited ? ", visited" : ", armed") : "";
  return `${name}, ${where}${state}`;
}

function bounds(cells: Point[]) {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return {
    top: Math.min(...rows),
    left: Math.min(...cols),
    height: Math.max(...rows) - Math.min(...rows) + 1,
    width: Math.max(...cols) - Math.min(...cols) + 1,
  };
}

const rootClass =
  "pointer-events-none grid grid-cols-subgrid grid-rows-subgrid";

const itemClass =
  "pointer-events-auto relative grid min-w-0 place-items-center rounded-[5px] border border-black/40 bg-(--piece) text-[0.7rem] leading-none font-bold text-black/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.25)] outline-none select-none [-webkit-tap-highlight-color:transparent] focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-white data-armed:ring-2 data-armed:ring-white data-armed:not-data-visited:motion-safe:animate-pulse data-visited:bg-[color-mix(in_oklch,var(--piece)_30%,#16141d)] data-visited:text-(--piece)";

interface PieceWidgetProps {
  piece: PieceView;
  orientation?: "horizontal" | "vertical";
  onRegister?: (id: number, focus: (() => void) | null) => void;
}

interface Placed {
  cell: CellView;
  style: React.CSSProperties;
  props: {
    "aria-label": string;
    "data-cell": string;
    "data-armed"?: "";
    "data-visited"?: "";
    className: string;
    style: React.CSSProperties;
  };
  glyph: React.ReactNode;
}

function place(piece: PieceView, orientation: "horizontal" | "vertical") {
  const box = bounds(piece.cells);
  const sorted = [...piece.cells].sort((a, b) =>
    orientation === "horizontal"
      ? a.row - b.row || a.col - b.col
      : a.col - b.col || a.row - b.row,
  );
  const items: Placed[] = sorted.map((cell) => {
    const style = {
      gridRow: cell.row - box.top + 1,
      gridColumn: cell.col - box.left + 1,
    };
    return {
      cell,
      style,
      props: {
        "aria-label": cellLabel(piece.kind, cell),
        "data-cell": cell.id,
        "data-armed": cell.isArmed ? "" : undefined,
        "data-visited": cell.isVisited ? "" : undefined,
        className: itemClass,
        style,
      },
      glyph: (
        <span aria-hidden="true">
          {cell.isVisited ? "✓" : itemOf(piece.kind, cell.id)[1]}
        </span>
      ),
    };
  });
  const rootStyle = {
    gridRow: `${box.top + 1} / span ${box.height}`,
    gridColumn: `${box.left + 1} / span ${box.width}`,
    "--piece": WIDGETS[piece.kind].color,
  } as React.CSSProperties;
  return { items, rootStyle, box };
}

function useRegister(
  id: number,
  controller: { focus: () => void },
  onRegister: PieceWidgetProps["onRegister"],
) {
  React.useEffect(() => {
    if (!onRegister) return;
    onRegister(id, () => controller.focus());
    return () => onRegister(id, null);
  }, [id, controller, onRegister]);
}

function ToolbarPiece({ piece, orientation, onRegister }: PieceWidgetProps) {
  const [controller] = React.useState(createToolbarController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  return (
    <Toolbar
      controller={controller}
      orientation={orientation}
      aria-label={WIDGETS[piece.kind].name}
      className={rootClass}
      style={layout.rootStyle}
    >
      {layout.items.map((item) => (
        <ToolbarButton key={item.cell.id} {...item.props}>
          {item.glyph}
        </ToolbarButton>
      ))}
    </Toolbar>
  );
}

function ToggleGroupPiece({
  piece,
  orientation,
  onRegister,
}: PieceWidgetProps) {
  const [controller] = React.useState(createToggleGroupController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  const visited = piece.cells
    .filter((cell) => cell.isVisited)
    .map((cell) => cell.id);
  return (
    <ToggleGroup
      controller={controller}
      multiple
      value={visited}
      onValueChange={(_value, details) => details.cancel()}
      orientation={orientation}
      aria-label={WIDGETS[piece.kind].name}
      className={rootClass}
      style={layout.rootStyle}
    >
      {layout.items.map((item) => (
        <Toggle key={item.cell.id} value={item.cell.id} {...item.props}>
          {item.glyph}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

function MenubarPiece({ piece, orientation, onRegister }: PieceWidgetProps) {
  const [controller] = React.useState(createMenubarController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  return (
    <Menubar
      controller={controller}
      orientation={orientation}
      aria-label={WIDGETS[piece.kind].name}
      className={rootClass}
      style={layout.rootStyle}
    >
      {layout.items.map((item) => (
        <Menu key={item.cell.id}>
          <MenuTrigger {...item.props}>{item.glyph}</MenuTrigger>
          <MenuContent
            sideOffset={4}
            collisionPadding={8}
            className="grid min-w-36 gap-0.5 rounded-lg border border-border bg-card p-1 text-sm text-foreground shadow-xl shadow-black/50"
          >
            {["Admire", "Poke", "Leave alone"].map((action) => (
              <MenuItem
                key={action}
                value={action}
                className="cursor-default rounded-md px-2.5 py-1.5 outline-none data-highlighted:bg-muted"
              >
                {action}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ))}
    </Menubar>
  );
}

function TabsPiece({ piece, orientation, onRegister }: PieceWidgetProps) {
  const [controller] = React.useState(createTabsController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  return (
    <Tabs
      controller={controller}
      orientation={orientation}
      className={rootClass}
      style={layout.rootStyle}
    >
      <TabsList
        aria-label={WIDGETS[piece.kind].name}
        className="col-span-full row-span-full grid grid-cols-subgrid grid-rows-subgrid"
      >
        {layout.items.map((item) => (
          <TabsTab key={item.cell.id} value={item.cell.id} {...item.props}>
            {item.glyph}
          </TabsTab>
        ))}
      </TabsList>
      {layout.items.map((item) => (
        <TabsPanel key={item.cell.id} value={item.cell.id} className="sr-only">
          {itemOf(piece.kind, item.cell.id)[0]} panel. Nothing in here but a
          block.
        </TabsPanel>
      ))}
    </Tabs>
  );
}

function SegmentedPiece({ piece, orientation, onRegister }: PieceWidgetProps) {
  const [controller] = React.useState(createSegmentedControlController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  return (
    <SegmentedControl
      controller={controller}
      orientation={orientation}
      aria-label={WIDGETS[piece.kind].name}
      className={rootClass}
      style={layout.rootStyle}
    >
      {layout.items.map((item) => (
        <SegmentedControlItem
          key={item.cell.id}
          value={item.cell.id}
          {...item.props}
        >
          {item.glyph}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function RadioPiece({ piece, orientation, onRegister }: PieceWidgetProps) {
  const [controller] = React.useState(createRadioGroupController);
  useRegister(piece.id, controller, onRegister);
  const layout = place(piece, orientation ?? "horizontal");
  return (
    <RadioGroup
      controller={controller}
      aria-label={WIDGETS[piece.kind].name}
      aria-orientation={orientation}
      className={rootClass}
      style={layout.rootStyle}
    >
      {layout.items.map((item) => (
        <Radio key={item.cell.id} value={item.cell.id} {...item.props}>
          {item.glyph}
        </Radio>
      ))}
    </RadioGroup>
  );
}

const PIECES: Record<Kind, (props: PieceWidgetProps) => React.ReactNode> = {
  I: ToolbarPiece,
  O: ToggleGroupPiece,
  T: MenubarPiece,
  S: TabsPiece,
  Z: SegmentedPiece,
  J: RadioPiece,
  L: MenubarPiece,
};

export function orientationOf(cells: Point[]) {
  const box = bounds(cells);
  return box.width >= box.height ? "horizontal" : "vertical";
}

export const PieceWidget = React.memo(function PieceWidget({
  piece,
  onRegister,
}: Omit<PieceWidgetProps, "orientation">) {
  const Piece = PIECES[piece.kind];
  return (
    <Piece
      piece={piece}
      orientation={orientationOf(piece.cells)}
      onRegister={onRegister}
    />
  );
});
