export const screenWidth = 320;
export const screenHeight = 200;
export const columnChoices = [40, 64, 80, 106, 128, 160, 192, 320] as const;
export const defaultColumns = 80;
export const gridLinesUpTo = 160;

export function rowsFor(columns: number) {
  return Math.round((columns * screenHeight) / screenWidth);
}

export function resolutionLabel(columns: number) {
  const label = `${columns} × ${rowsFor(columns)}`;
  return columns === screenWidth ? `${label} (native)` : label;
}

export function pixelCount(columns: number) {
  return columns * rowsFor(columns);
}

// Five bits a channel, so a shift too small to see doesn't repaint a cell.
const colorMask = 0xf8;
const halfStep = 4;

function quantize(sum: number, count: number) {
  return Math.min(255, sum / count + halfStep) & colorMask;
}

export function downsample(
  rgba: Uint8Array,
  width: number,
  height: number,
  columns: number,
  rows: number,
) {
  const colors = new Int32Array(columns * rows);
  const stepX = width / columns;
  const stepY = height / rows;
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor(row * stepY);
    const y1 = Math.max(y0 + 1, Math.floor((row + 1) * stepY));
    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.floor(column * stepX);
      const x1 = Math.max(x0 + 1, Math.floor((column + 1) * stepX));
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = (y * width + x) * 4;
          red += rgba[index] ?? 0;
          green += rgba[index + 1] ?? 0;
          blue += rgba[index + 2] ?? 0;
          count += 1;
        }
      }
      colors[row * columns + column] =
        (quantize(red, count) << 16) |
        (quantize(green, count) << 8) |
        quantize(blue, count);
    }
  }
  return colors;
}

const hexes = new Map<number, string>();

export function hexColor(color: number) {
  let hex = hexes.get(color);
  if (hex === undefined) {
    hex = `#${color.toString(16).padStart(6, "0")}`;
    hexes.set(color, hex);
  }
  return hex;
}

export function columnStops(columns: number) {
  return Array.from(
    { length: columns + 1 },
    (_, column) => `${Number(((column * 100) / columns).toFixed(3))}%`,
  );
}

// One hard stop per run of equal colors, so a flat wall is one stop, not one
// per pixel.
export function rowGradient(
  colors: Int32Array,
  row: number,
  columns: number,
  stops: string[],
) {
  const start = row * columns;
  const runs: string[] = [];
  let runStart = 0;
  for (let column = 1; column <= columns; column += 1) {
    const color = colors[start + runStart] ?? 0;
    if (column < columns && colors[start + column] === color) continue;
    runs.push(`${hexColor(color)} ${stops[runStart]} ${stops[column]}`);
    runStart = column;
  }
  return `linear-gradient(90deg,${runs.join(",")})`;
}
