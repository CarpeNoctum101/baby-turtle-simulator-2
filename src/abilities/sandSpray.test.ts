import { describe, expect, it } from "vitest";
import { createEffects } from "./abilityState";
import { sandRules } from "./catalog";
import { createSandCloud, isInSandSpray, resolveSandClouds, sandCloudAnchor, stepSandClouds } from "./sandSpray";

function cloudAt(x: number, z: number, heading: number) {
  return createSandCloud(1, "player", { x, z, heading }, sandRules.slowDuration);
}

describe("sand spray area", () => {
  it("hits a rival behind the turtle and misses everyone else", () => {
    const cloud = cloudAt(0, 0, 0);
    expect(isInSandSpray(cloud, { x: 0, z: -2 })).toBe(true);
    expect(isInSandSpray(cloud, { x: 0.5, z: -2 })).toBe(true);
    expect(isInSandSpray(cloud, { x: 0, z: 2 })).toBe(false);
    expect(isInSandSpray(cloud, { x: 2, z: -2 })).toBe(false);
    expect(isInSandSpray(cloud, { x: 0, z: -0.2 })).toBe(false);
    expect(isInSandSpray(cloud, { x: 0, z: -5 })).toBe(false);
    expect(isInSandSpray(cloud, { x: 0, z: 0 })).toBe(false);
  });

  it("follows the turtle's facing when that facing is not toward the ocean", () => {
    const cloud = cloudAt(3, 4, Math.PI / 2);
    expect(isInSandSpray(cloud, { x: 1, z: 4 })).toBe(true);
    expect(isInSandSpray(cloud, { x: 5, z: 4 })).toBe(false);
  });

  it("places the visible puff in the middle of that rear box", () => {
    const cloud = cloudAt(0, 0, 0);
    const anchor = sandCloudAnchor(cloud);
    expect(anchor.z).toBeLessThan(0);
    expect(isInSandSpray(cloud, anchor)).toBe(true);
  });
});

describe("sand spray hits", () => {
  it("slows a rival in the cloud once and never slows the caster", () => {
    const cloud = cloudAt(0, 0, 0);
    const targets = [
      { id: "player", x: 0, z: -2, effects: createEffects() },
      { id: "rival", x: 0, z: -2, effects: createEffects() },
    ];
    const first = resolveSandClouds([cloud], targets);
    const second = resolveSandClouds(first.clouds, first.targets);
    const rival = second.targets.find((target) => target.id === "rival");
    const player = second.targets.find((target) => target.id === "player");
    expect(first.hits).toEqual([{ targetId: "rival", blocked: false }]);
    expect(rival?.effects.slowRemaining).toBe(sandRules.slowDuration);
    expect(player?.effects.slowRemaining).toBe(0);
    expect(second.hits).toEqual([]);
  });

  it("spends a shell on the first rival in the cloud and slows a rival who has no shell", () => {
    const cloud = cloudAt(0, 0, 0);
    const shielded = resolveSandClouds([cloud], [
      { id: "rival", x: 0, z: -2, effects: { ...createEffects(), shieldRemaining: 5, shieldCharges: 1 } },
    ]);
    const open = resolveSandClouds([cloud], [{ id: "rival", x: 0, z: -2, effects: createEffects() }]);
    expect(shielded.hits[0]?.blocked).toBe(true);
    expect(shielded.targets[0]?.effects.shieldCharges).toBe(0);
    expect(shielded.targets[0]?.effects.slowRemaining).toBe(0);
    expect(open.targets[0]?.effects.slowRemaining).toBe(sandRules.slowDuration);
  });

  it("stays where it was sprayed after the caster moves, then disappears", () => {
    const cloud = cloudAt(0, 0, 0);
    const movedCaster = resolveSandClouds([cloud], [{ id: "rival", x: 0, z: 2, effects: createEffects() }]);
    expect(movedCaster.hits).toEqual([]);
    const stillBehind = resolveSandClouds([cloud], [{ id: "rival", x: 0, z: -2, effects: createEffects() }]);
    expect(stillBehind.hits).toHaveLength(1);
    const faded = stepSandClouds([{ ...cloud, remaining: 0.02 }], 0.05);
    expect(faded).toEqual([]);
  });
});
