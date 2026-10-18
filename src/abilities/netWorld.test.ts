import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { netRules, netThrowerSpawns } from "../mob/netThrower";
import { holdAbility } from "./abilityState";
import { starterAbilityPool } from "./catalog";
import { createAbilityWorld, stepAbilityWorld, type AbilityTick, type AbilityWorld } from "./stepAbilityWorld";

const player = { ...createTurtleMotion(), z: -9, speed: 4 };
const rival = { ...player, x: 8 };
function landed() {
  const world = createAbilityWorld(50, [], netThrowerSpawns);
  world.nets.throwers[0] = { ...world.nets.throwers[0], phase: "ground", time: 0,
    target: { x: player.x, z: player.z } };
  return world;
}
function tick(world: AbilityWorld, racing = true, special: "spin" | "slam" | null = null, extra: Partial<AbilityTick> = {}) {
  return stepAbilityWorld(world, { dt: 1 / 60, racing, activate: false, player, rival,
    inWaveZone: false, random: () => 0, pool: starterAbilityPool, special, specialPressed: !!special, ...extra });
}

describe("nets in the local ability world", () => {
  it("cuts speed, keeps controls and health, and cannot catch again in the same net", () => {
    const hit = tick(landed());
    expect(hit.cues).toContain("net-catch");
    expect(hit.player.speed).toBeCloseTo(player.speed * netRules.slowMultiplier);
    expect(hit.world.playerHealth.current).toBe(50);
    expect(hit.world.nets.slow.player).toBe(netRules.slowSeconds);
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

  it("locks abilities while netted and lets trigger mashes shorten the slow", () => {
    const caught = tick(landed()).world;
    caught.loadout = holdAbility(caught.loadout, "flipper-frenzy");
    const locked = tick(caught, true, "spin", { activate: true, shoot: true, specialPressed: true });
    expect(locked.world.loadout.held).toBe("flipper-frenzy");
    expect(locked.world.loadout.effects.frenzyRemaining).toBe(0);
    expect(locked.world.loadout.effects.spinRemaining).toBe(0);
    expect(locked.cues).not.toContain("bubble");
    const waited = tick(caught);
    const struggled = tick(caught, true, null, { struggle: true });
    expect(struggled.world.nets.slow.player).toBeCloseTo(waited.world.nets.slow.player - netRules.struggleSeconds);
  });

  it("does not net a body-slamming turtle or fire outside a race", () => {
    expect(tick(landed(), true, "slam").world.nets.slow.player).toBe(0);
    expect(tick(landed(), false).world.nets.slow.player).toBe(0);
    expect(tick(createAbilityWorld()).world.nets.throwers).toHaveLength(0);
  });
});
