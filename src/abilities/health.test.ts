import { describe, expect, it } from "vitest";
import { applyDamage, createHealth, exhaustedSpeedScale, exhaustionScale, healthFraction, isExhausted } from "./health";

describe("health", () => {
  it("starts full and never drops below zero", () => {
    const full = createHealth(70);
    expect(full).toEqual({ current: 70, max: 70 });
    expect(applyDamage(full, 20).current).toBe(50);
    expect(applyDamage(full, 999).current).toBe(0);
  });

  it("ignores negative and non-finite damage", () => {
    const full = createHealth(100);
    expect(applyDamage(full, -10).current).toBe(100);
    expect(applyDamage(full, Number.NaN).current).toBe(100);
  });

  it("slows a worn-out turtle but not a healthy one", () => {
    expect(isExhausted(applyDamage(createHealth(100), 100))).toBe(true);
    expect(exhaustionScale(createHealth(100))).toBe(1);
    expect(exhaustionScale(applyDamage(createHealth(100), 100))).toBe(exhaustedSpeedScale);
    expect(healthFraction(applyDamage(createHealth(150), 75))).toBe(0.5);
  });
});
