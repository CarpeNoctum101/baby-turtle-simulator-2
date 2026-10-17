import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { sandRules } from "../abilities/catalog";
import { createSandCloud, isInSandSpray } from "../abilities/sandSpray";
import { createRivalMotion, rivalAnchor, stepRival } from "./stepRival";

describe("practice rival", () => {
  it("waits inside the sand-spray box behind the player", () => {
    const player = createTurtleMotion();
    const cloud = createSandCloud(1, "player", player, sandRules.slowDuration);
    expect(isInSandSpray(cloud, rivalAnchor(player))).toBe(true);
    expect(isInSandSpray(cloud, createRivalMotion(player))).toBe(true);
    const turned = { ...player, heading: Math.PI / 2 };
    const turnedCloud = createSandCloud(2, "player", turned, 1);
    expect(isInSandSpray(turnedCloud, rivalAnchor(turned))).toBe(true);
  });

  it("falls behind the anchor when a slow cuts its top speed", () => {
    const player = createTurtleMotion();
    let rival = { ...createRivalMotion(player), z: player.z - 6, speed: 0 };
    const frame = 1 / 60;
    for (let step = 0; step < 90; step += 1) {
      rival = stepRival(rival, player, frame, { maxSpeedMultiplier: 0.4, accelerationMultiplier: 0.4 });
    }
    const unslowedStart = { ...createRivalMotion(player), z: player.z - 6, speed: 0 };
    let unslowed = unslowedStart;
    for (let step = 0; step < 90; step += 1) {
      unslowed = stepRival(unslowed, player, frame);
    }
    expect(unslowed.z).toBeGreaterThan(rival.z);
  });
});
