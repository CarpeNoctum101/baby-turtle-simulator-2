import { describe, expect, it } from "vitest";
import { scaleCrawl, turtleTypes } from "./turtleTypes";

describe("turtle types", () => {
  const { regular, leatherback, kempy, snappy } = turtleTypes;

  it("keeps the regular turtle as the unchanged baseline", () => {
    expect(regular).toMatchObject({ maxHealth: 50, speedScale: 1, bodyScale: 1, neckLength: 0, itemSlots: 2, special: null });
  });

  it("makes the leatherback bigger, tougher, slower and give it a body slam", () => {
    expect(leatherback.bodyScale).toBeGreaterThan(regular.bodyScale);
    expect(leatherback.maxHealth).toBeGreaterThan(regular.maxHealth);
    expect(leatherback.speedScale).toBeLessThan(regular.speedScale);
    expect(leatherback.special).toBe("slam");
  });

  it("makes the kempy smaller, more fragile and faster", () => {
    expect(kempy.bodyScale).toBeLessThan(regular.bodyScale);
    expect(kempy.maxHealth).toBeLessThan(regular.maxHealth);
    expect(kempy.speedScale).toBeGreaterThan(regular.speedScale);
  });

  it("gives snappy a long neck, slightly more health and a snap", () => {
    expect(snappy.neckLength).toBeGreaterThan(0);
    expect(snappy.maxHealth).toBeGreaterThan(regular.maxHealth);
    expect(snappy.maxHealth).toBeLessThan(leatherback.maxHealth);
    expect(snappy.bodyScale).toBe(regular.bodyScale);
    expect(snappy.special).toBe("snap");
  });

  it("lets the regular turtle hold two power-ups and every other type one, each with its own move", () => {
    expect(regular.itemSlots).toBe(2);
    for (const type of [leatherback, kempy, snappy]) {
      expect(type.itemSlots).toBe(1);
      expect(type.special).not.toBeNull();
    }
    expect(kempy.special).toBe("spin");
    expect(regular.special).toBeNull();
  });

  it("scales both crawl caps and treats missing values as 1", () => {
    expect(scaleCrawl({}, 0.5)).toEqual({ maxSpeedMultiplier: 0.5, accelerationMultiplier: 0.5 });
    expect(scaleCrawl({ maxSpeedMultiplier: 2, accelerationMultiplier: 1.5 }, 0.5)).toEqual({
      maxSpeedMultiplier: 1,
      accelerationMultiplier: 0.75,
    });
  });
});
