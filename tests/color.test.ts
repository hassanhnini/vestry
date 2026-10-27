import { describe, expect, it } from "vitest";
import { dominantColors, namedPalette, nearestNamedColor } from "@/lib/color";

describe("colour analysis", () => {
  it("maps measured colours to fashion names", () => {
    expect(nearestNamedColor([20, 22, 25]).color.id).toBe("black");
    expect(nearestNamedColor([250, 250, 248]).color.id).toBe("white");
    expect(nearestNamedColor([30, 42, 70]).color.id).toBe("navy");
    expect(nearestNamedColor([185, 138, 88]).color.id).toBe("camel");
    expect(nearestNamedColor([190, 40, 45]).color.id).toBe("red");
  });
  it("finds dominant and secondary colours by weight", () => {
    const px: [number, number, number][] = [];
    for (let i = 0; i < 700; i++) px.push([30 + (i % 5), 42, 70]);
    for (let i = 0; i < 300; i++) px.push([248, 248, 246]);
    const named = namedPalette(dominantColors(px, 3));
    expect(named[0].id).toBe("navy");
    expect(named[0].weight).toBeCloseTo(0.7, 1);
    expect(named[1].id).toBe("white");
  });
});

describe("metallic names", () => {
  it("prefers white/grey over silver for pale greys", () => {
    expect(["white", "grey"]).toContain(nearestNamedColor([225, 226, 228]).color.id);
  });
});
