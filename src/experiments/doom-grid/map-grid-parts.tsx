"use client";

import { createParts } from "@ui-sdk/react/primitive";

import { mapGrid } from "./map-grid";

const {
  Root: MapGridRoot,
  Row: MapGridRow,
  Cell: MapGridCell,
} = createParts(mapGrid, { root: "div", row: "div", cell: "div" });

export { MapGridCell, MapGridRoot, MapGridRow };
