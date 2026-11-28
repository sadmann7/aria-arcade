import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Aria Arcade: four game cases on a video store shelf, with the line “Fun, useless things”.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const png = await readFile(join(process.cwd(), "src/app/og.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType },
  });
}
