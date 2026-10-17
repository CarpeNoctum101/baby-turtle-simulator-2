import { describe, expect, it } from "vitest";
import { applyDeadZone } from "./deadZone";

describe("applyDeadZone", () => {
  it("ignores a stick resting inside the dead zone", () => {
    expect(applyDeadZone(0.1, 0.18)).toBe(0);
    expect(applyDeadZone(-0.18, 0.18)).toBe(0);
  });

  it("keeps full tilt at full strength", () => {
    expect(applyDeadZone(1, 0.18)).toBe(1);
    expect(applyDeadZone(-1, 0.18)).toBe(-1);
  });

  it("rescales the travel outside the dead zone", () => {
    expect(applyDeadZone(0.59, 0.18)).toBeCloseTo(0.5, 5);
  });

  it("treats non-numbers as no input", () => {
    expect(applyDeadZone(Number.NaN, 0.18)).toBe(0);
  });
});
