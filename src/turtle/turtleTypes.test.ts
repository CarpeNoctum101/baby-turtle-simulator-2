import { describe, expect, it } from "vitest";
import { scaleCrawl, turtleTypes } from "./turtleTypes";

describe("turtle types", () => {
  const { regular, leatherback, kempy, snappy } = turtleTypes;

  it("keeps the regular turtle as the unchanged baseline", () => {
    expect(regular).toMatchObject({ maxHealth: 100, speedScale: 1, bodyScale: 1, neckLength: 0, itemSlots: 1, canSnap: false });
  });

  it("makes the leatherback bigger, tougher, slower and able to hold two items", () => {
    expect(leatherback.bodyScale).toBeGreaterThan(regular.bodyScale);
    expect(leatherback.maxHealth).toBeGreaterThan(regular.maxHealth);
    expect(leatherback.speedScale).toBeLessThan(regular.speedScale);
    expect(leatherback.itemSlots).toBe(2);
  });

  it("makes the kempy smaller, more fragile and faster", () => {
    expect(kempy.bodyScale).toBeLessThan(regular.bodyScale);
    expect(kempy.maxHealth).toBeLessThan(regular.maxHealth);
    expect(kempy.speedScale).toBeGreaterThan(regular.speedScale);
  });

  it("gives snappy a long neck, slightly more health, no items and a snap", () => {
    expect(snappy.neckLength).toBeGreaterThan(0);
    expect(snappy.maxHealth).toBeGreaterThan(regular.maxHealth);
    expect(snappy.maxHealth).toBeLessThan(leatherback.maxHealth);
    expect(snappy.bodyScale).toBe(regular.bodyScale);
    expect(snappy.itemSlots).toBe(0);
    expect(snappy.canSnap).toBe(true);
  });

  it("scales both crawl caps and treats missing values as 1", () => {
    expect(scaleCrawl({}, 0.5)).toEqual({ maxSpeedMultiplier: 0.5, accelerationMultiplier: 0.5 });
    expect(scaleCrawl({ maxSpeedMultiplier: 2, accelerationMultiplier: 1.5 }, 0.5)).toEqual({
      maxSpeedMultiplier: 1,
      accelerationMultiplier: 0.75,
    });
  });
});
