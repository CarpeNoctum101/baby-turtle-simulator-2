import { describe, expect, it } from "vitest";
import { beachHeight, inlandZ, seededRandom } from "./landscape";
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

  it("keeps side dunes beside the longer beach and flattens them at the water", () => {
    let peak = 0;
    for (let x = course.halfWidth + 6; x <= course.halfWidth + 18; x += 1) {
      peak = Math.max(peak, beachHeight(x, course.water.minZ - 8));
      expect(beachHeight(x, course.water.minZ + 2)).toBeLessThanOrEqual(0.02);
    }
    expect(peak).toBeGreaterThan(0.15);
  });

  it("scatters props up the beach without putting them in the water", () => {
    const random = seededRandom(681);
    const samples = Array.from({ length: 68 }, () => inlandZ(-31, 2, random));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-31);
    expect(Math.max(...samples)).toBeGreaterThan(course.wet.minZ);
    expect(Math.max(...samples)).toBeLessThan(course.water.minZ);
  });
});
