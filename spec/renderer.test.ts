import { describe, expect, it } from "vitest";
import { playerUpperBodyAnchor } from "../src/renderer.ts";

// Regression test: glove/shield markers were previously drawn from raw
// full-frame camera fractions (glove.x * canvasWidth), so they could float
// away from the player robot whenever it advanced/retreated or the layout
// changed between portrait and landscape. The anchor must always track
// wherever the player sprite is actually drawn.
describe("playerUpperBodyAnchor", () => {
  it("centers on the player robot's current x position, not a fixed canvas fraction", () => {
    const retreated = playerUpperBodyAnchor(120, 480, 800, false);
    const advanced = playerUpperBodyAnchor(300, 480, 800, false);
    expect(retreated.x).toBe(120);
    expect(advanced.x).toBe(300);
  });

  it("places the anchor above the fighter's feet-line anchor, toward the shoulders", () => {
    const anchor = playerUpperBodyAnchor(200, 480, 800, false);
    expect(anchor.y).toBeLessThan(480);
  });

  it("produces a positive, stage-scaled shoulder-width unit for mapping glove offsets", () => {
    const small = playerUpperBodyAnchor(200, 480, 400, false);
    const large = playerUpperBodyAnchor(200, 480, 800, false);
    expect(small.scale).toBeGreaterThan(0);
    expect(large.scale).toBeGreaterThan(small.scale);
  });
});
