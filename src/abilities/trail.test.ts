import { describe, expect, it } from "vitest";
import { course } from "../movement/course";
import { oceanTrail } from "./trail";

describe("magnetic sense trail", () => {
  it("leads from the nest toward the ocean gate", () => {
    const points = oceanTrail(6, course.nest.z);
    expect(points.length).toBeGreaterThan(3);
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) {
      throw new Error("expected trail markers");
    }
    expect(first.z).toBeGreaterThan(course.nest.z);
    expect(last.z).toBeGreaterThan(first.z);
    expect(last.z).toBeLessThan(course.finish.minZ);
    expect(Math.abs(first.x)).toBeLessThan(6);
    expect(Math.abs(last.x)).toBeLessThan(Math.abs(first.x));
  });

  it("hides the trail once the turtle is already at the gate", () => {
    expect(oceanTrail(0, course.finish.minZ)).toEqual([]);
  });
});
