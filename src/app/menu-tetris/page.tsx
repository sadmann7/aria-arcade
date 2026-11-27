import type { Metadata } from "next";

import { MenuTetris } from "@/experiments/menu-tetris/menu-tetris";

export const metadata: Metadata = {
  title: "Menu Tetris",
  description:
    "Tetris with toolbars, menubars and tab lists for pieces. A full row only clears once you arrow through every cell in it.",
};

export default function MenuTetrisPage() {
  return <MenuTetris />;
}
