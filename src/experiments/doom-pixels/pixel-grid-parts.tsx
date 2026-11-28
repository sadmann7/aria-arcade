"use client";

import { createParts } from "@ui-sdk/react/primitive";

import { pixelGrid } from "./pixel-grid";

const {
  Root: PixelGridRoot,
  Row: PixelGridRow,
  Canvas: PixelGridCanvas,
  Cell: PixelGridCell,
} = createParts(pixelGrid, {
  root: "div",
  canvas: "canvas",
  row: "div",
  cell: "div",
});

export { PixelGridCanvas, PixelGridCell, PixelGridRoot, PixelGridRow };
