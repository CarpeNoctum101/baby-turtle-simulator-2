import { describe, expect, it } from "vitest";
import { beachHeight } from "./landscape";
import { course } from "../../movement/course";

describe("visual beach terrain", () => {
  it("keeps dunes out of the flat playable lane, with only a shallow nest depression", () => {
    for (let x=-course.halfWidth;x<=course.halfWidth;x+=0.5) for(let z=course.dry.minZ;z<=course.wet.maxZ;z+=0.5) {
      const height=beachHeight(x,z);
      expect(height).toBeLessThanOrEqual(0.018);
      expect(height).toBeGreaterThanOrEqual(-0.018);
    }
    expect(beachHeight(course.halfWidth+10,-20)).toBeGreaterThan(0.1);
  });
});
