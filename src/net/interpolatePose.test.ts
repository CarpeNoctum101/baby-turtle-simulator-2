import { describe, expect, it } from "vitest";
import { createRemoteSample, pushRemoteSample, stepRemoteSample } from "../../shared/interpolatePose";

describe("remote crawl blending", () => {
  it("eases toward the new pose and takes the short way around a turn", () => {
    const standing = createRemoteSample({ x: 0, z: 0, heading: 3.1, speed: 0 });
    const sample = pushRemoteSample(standing.to, { x: 2, z: 4, heading: -3.1, speed: 2 });
    const halfway = stepRemoteSample(sample, 0.05);
    expect(halfway.pose.x).toBeCloseTo(1);
    expect(halfway.pose.z).toBeCloseTo(2);
    expect(Math.abs(halfway.pose.heading)).toBeGreaterThan(3);
    const arrived = stepRemoteSample(halfway.sample, 0.05);
    expect(arrived.pose.x).toBeCloseTo(2);
    expect(arrived.pose.z).toBeCloseTo(4);
    expect(arrived.pose.speed).toBe(2);
  });
});