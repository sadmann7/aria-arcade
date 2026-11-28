import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Menu Tetris on Aria Arcade: a pink game case of menu-shaped Tetris pieces beside its title.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const png = await readFile(join(process.cwd(), "src/app/menu-tetris/og.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType },
  });
}
