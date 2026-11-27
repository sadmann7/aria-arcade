import type { Metadata } from "next";

import { DoomGrid } from "@/experiments/doom-grid/doom-grid";

export const metadata: Metadata = {
  title: "Doom grid",
  description:
    "Play Freedoom through an accessible grid that mirrors the live game.",
};

export default function DoomGridPage() {
  return <DoomGrid />;
}
