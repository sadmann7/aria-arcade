import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Doom grid on Aria Arcade: a red pixel-grid game case beside its title.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const png = await readFile(join(process.cwd(), "src/app/doom-grid/og.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType },
  });
}
