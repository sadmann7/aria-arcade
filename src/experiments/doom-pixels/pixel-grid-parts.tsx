"use client";

import { createParts } from "@ui-sdk/react/primitive";

import { pixelGrid } from "./pixel-grid";

const {
  Root: PixelGridRoot,
  Row: PixelGridRow,
  Cell: PixelGridCell,
} = createParts(pixelGrid, { root: "div", row: "div", cell: "div" });

export { PixelGridCell, PixelGridRoot, PixelGridRow };
