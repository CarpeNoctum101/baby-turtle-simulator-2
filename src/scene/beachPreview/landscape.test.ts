import { describe, expect, it } from "vitest";
import { beachHeight } from "./landscape";

describe("visual beach terrain", () => {
  it("keeps dunes out of the flat playable lane, with only a shallow nest depression", () => {
    for (let x=-7.3;x<=7.3;x+=0.5) for(let z=-32;z<=14;z+=0.5) {
      const height=beachHeight(x,z);
      expect(height).toBeLessThanOrEqual(0.018);
      expect(height).toBeGreaterThanOrEqual(-0.018);
    }
    expect(beachHeight(18,-20)).toBeGreaterThan(0.1);
  });
});
