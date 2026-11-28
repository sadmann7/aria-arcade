import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Infinite combobox on Aria Arcade: an amber game case of stacked dropdowns beside its title.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const png = await readFile(
    join(process.cwd(), "src/app/infinite-combobox/og.png"),
  );
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType },
  });
}
