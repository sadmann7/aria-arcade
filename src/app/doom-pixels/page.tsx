import type { Metadata } from "next";

import { DoomPixels } from "@/experiments/doom-pixels/doom-pixels";

export const metadata: Metadata = {
  title: "Doom pixels",
  description:
    "Play Freedoom drawn into a UI SDK grid, one cell per pixel, and see what each resolution costs.",
};

export default function DoomPixelsPage() {
  return <DoomPixels />;
}
