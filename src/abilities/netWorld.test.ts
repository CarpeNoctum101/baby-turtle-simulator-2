import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { netThrowerSpawns } from "../mob/netThrower";
import { starterAbilityPool } from "./catalog";
import { createAbilityWorld, stepAbilityWorld, type AbilityWorld } from "./stepAbilityWorld";

const player = { ...createTurtleMotion(), z: -9, speed: 4 };
const rival = { ...player, x: 8 };
function landed() {
  const world = createAbilityWorld(50, [], netThrowerSpawns);
  world.nets.throwers[0] = { ...world.nets.throwers[0], phase: "ground", time: 0,
    target: { x: player.x, z: player.z } };
  return world;
}
function tick(world: AbilityWorld, racing = true, special: "spin" | "slam" | null = null) {
  return stepAbilityWorld(world, { dt: 1 / 60, racing, activate: false, player, rival,
    inWaveZone: false, random: () => 0, pool: starterAbilityPool, special, specialPressed: !!special });
}

describe("nets in the local ability world", () => {
  it("cuts speed, keeps controls and health, and cannot catch again in the same net", () => {
    const hit = tick(landed());
    expect(hit.cues).toContain("net-catch");
    expect(hit.player.speed).toBeCloseTo(player.speed * 0.55);
    expect(hit.world.playerHealth.current).toBe(50);
    expect(hit.world.nets.slow.player).toBe(2.6);
    expect(hit.controlsLocked).toBe(false);
    expect(tick(hit.world).cues).not.toContain("net-catch");
  });

  it("spends Shell Guard and lets Kempy's spin ignore the net", () => {
    const guarded = landed();
    guarded.loadout.effects = { ...guarded.loadout.effects, shieldCharges: 1, shieldRemaining: 3 };
    const block = tick(guarded);
    expect(block.cues).toContain("block");
    expect(block.world.nets.slow.player).toBe(0);
    expect(block.world.loadout.effects.shieldCharges).toBe(0);
    expect(block.player.speed).toBe(player.speed);
    const spin = tick(landed(), true, "spin");
    expect(spin.cues).toContain("block");
    expect(spin.world.nets.slow.player).toBe(0);
  });

  it("does not net a body-slamming turtle or fire outside a race", () => {
    expect(tick(landed(), true, "slam").world.nets.slow.player).toBe(0);
    expect(tick(landed(), false).world.nets.slow.player).toBe(0);
    expect(tick(createAbilityWorld()).world.nets.throwers).toHaveLength(0);
  });
});
