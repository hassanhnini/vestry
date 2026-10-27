import { describe, expect, it } from "vitest";
import { analyseLocally, categoryFromText } from "@/lib/ai/local-analyze";

/** Render a polygon-ish mask via an inside() predicate into RGBA pixels. */
function raster(w: number, h: number, inside: (x: number, y: number) => boolean, rgb: [number, number, number], stripes = false) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!inside(x, y)) continue;
      const c = stripes && Math.floor(y / 4) % 2 ? [245, 245, 245] : rgb;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

describe("on-device analysis", () => {
  it("detects trousers from the leg gap and measures denim colour", () => {
    const px = raster(80, 120, (x, y) => y > 5 && y < 115 && x > 15 && x < 65 && !(y > 50 && x > 37 && x < 43), [74, 99, 131]);
    const a = analyseLocally(px, "IMG_001.jpg");
    expect(a.category).toBe("jeans");
    expect(a.colors[0]).toBe("denim");
    expect(a.colorHex[0]).toMatch(/^#/);
    expect(a.source).toBe("on-device");
    expect(a.confidence.category).toBeLessThan(0.5); // never overstated
  });
  it("detects a short-sleeved top shape", () => {
    const px = raster(120, 110, (x, y) => (y > 10 && y < 35 && x > 10 && x < 110) || (y >= 35 && y < 105 && x > 32 && x < 88), [32, 44, 74]);
    const a = analyseLocally(px);
    expect(a.category).toBe("t-shirt");
    expect(a.colors[0]).toBe("navy");
    expect(a.pattern).toBe("solid");
  });
  it("detects horizontal stripes", () => {
    const px = raster(100, 100, (x, y) => x > 10 && x < 90 && y > 10 && y < 90, [30, 42, 70], true);
    expect(analyseLocally(px).pattern).toBe("striped");
  });
  it("uses file-name hints when present", () => {
    expect(categoryFromText("black_leather_jacket.jpg")).toBe("leather-jacket");
    expect(categoryFromText("my-new-loafers.png")).toBe("loafers");
    expect(categoryFromText("IMG_2041.jpg")).toBeNull();
  });
});
