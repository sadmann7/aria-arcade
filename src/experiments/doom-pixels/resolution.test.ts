import { describe, expect, it } from "vitest";

import {
  columnChoices,
  downsample,
  hexColor,
  pixelCount,
  resolutionLabel,
  rowsFor,
} from "./resolution";

describe("resolution", () => {
  it("keeps Doom's 16:10 shape at every choice", () => {
    expect(columnChoices.map((columns) => rowsFor(columns))).toEqual([
      25, 40, 50, 66, 80, 100, 120, 200, 400,
    ]);
    expect(pixelCount(320)).toBe(64_000);
    expect(resolutionLabel(320)).toBe("320 × 200 (native)");
    expect(resolutionLabel(80)).toBe("80 × 50");
    expect(resolutionLabel(640)).toBe("640 × 400 (high)");
  });

  it("averages each block of screen pixels into one cell", () => {
    const red = [255, 0, 0, 255];
    const blue = [0, 0, 255, 255];
    const green = [0, 255, 0, 255];
    const rgba = new Uint8Array(
      [red, red, blue, blue, red, red, blue, green].flat(),
    );
    const colors = downsample(rgba, 4, 2, 2, 1);
    expect([...colors].map(hexColor)).toEqual(["#f80000", "#0040c0"]);
  });

  it("writes colors as six digit hex", () => {
    expect(hexColor(0)).toBe("#000000");
    expect(hexColor(0xf8f8f8)).toBe("#f8f8f8");
  });
});
