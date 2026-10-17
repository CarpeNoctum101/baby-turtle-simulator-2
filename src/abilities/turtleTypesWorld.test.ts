import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion } from "../race/stepRival";
import { holdAbility, beginAbility, createLoadout } from "./abilityState";
import { debrisLayout } from "./contacts";
import { damageRules } from "./health";
import { collectTideOrbs, createTideOrbs, tideOrbSpots } from "./pickups";
import { raceAbilityPool, starterAbilityPool } from "./catalog";
import { createAbilityWorld, stepAbilityWorld, type AbilityTick } from "./stepAbilityWorld";

const spot = tideOrbSpots[0]!;
const onOrb = { x: spot.x, z: spot.z };

function tick(world: ReturnType<typeof createAbilityWorld>, overrides: Partial<AbilityTick> = {}) {
  const player = overrides.player ?? createTurtleMotion();
  return stepAbilityWorld(world, {
    dt: 1 / 60,
    racing: true,
    activate: false,
    player,
    rival: overrides.rival ?? createRivalMotion(player),
    inWaveZone: false,
    random: () => 0,
    pool: starterAbilityPool,
    ...overrides,
  });
}

describe("item slots", () => {
  it("lets a two-slot turtle hold a second ability and promotes it after use", () => {
    const first = collectTideOrbs(createTideOrbs(), createLoadout(), onOrb, () => 0, raceAbilityPool, 2);
    const second = collectTideOrbs(first.orbs.map((o) => ({ ...o, respawnIn: 0 })), first.loadout, onOrb, () => 0.5, raceAbilityPool, 2);
    expect(second.loadout.held).toBe(first.granted);
    expect(second.loadout.spare).toBe(second.granted);
    const third = collectTideOrbs(second.orbs.map((o) => ({ ...o, respawnIn: 0 })), second.loadout, onOrb, () => 0, raceAbilityPool, 2);
    expect(third.granted).toBeNull();

    const spent = beginAbility(second.loadout, second.loadout.held!);
    expect(spent.loadout.held).toBe(second.loadout.spare);
    expect(spent.loadout.spare).toBeNull();
  });

  it("keeps a one-slot turtle at one ability", () => {
    const first = collectTideOrbs(createTideOrbs(), createLoadout(), onOrb, () => 0, raceAbilityPool, 1);
    const again = collectTideOrbs(first.orbs.map((o) => ({ ...o, respawnIn: 0 })), first.loadout, onOrb, () => 0, raceAbilityPool, 1);
    expect(again.granted).toBeNull();
    expect(again.loadout.spare).toBeNull();
  });

  it("gives a no-slot turtle nothing and leaves the orb on the sand", () => {
    const result = collectTideOrbs(createTideOrbs(), createLoadout(), onOrb, () => 0, raceAbilityPool, 0);
    expect(result.granted).toBeNull();
    expect(result.loadout.held).toBeNull();
    expect(result.orbs.every((orb) => orb.respawnIn === 0)).toBe(true);
  });

  it("does not let a spare slot start a second ability while one is running", () => {
    const loaded = { ...holdAbility(createLoadout(), "flipper-frenzy"), spare: "shell-guard" as const };
    const running = beginAbility(loaded, "flipper-frenzy").loadout;
    expect(running.held).toBe("shell-guard");
    expect(beginAbility(running, "shell-guard").started).toBe(false);
  });
});

describe("health in the world", () => {
  it("starts at the turtle's max health", () => {
    expect(createAbilityWorld(150).playerHealth).toEqual({ current: 150, max: 150 });
  });

  it("costs debris damage on a hit", () => {
    const debris = debrisLayout[0];
    const player = { ...createTurtleMotion(), x: debris.x, z: debris.z };
    const hit = tick(createAbilityWorld(), { player, rival: { ...createTurtleMotion(), x: 20, z: 20 } });
    expect(hit.world.playerHealth.current).toBe(100 - damageRules.debris);
  });

  it("costs nothing when Shell Guard stops the hit", () => {
    const debris = debrisLayout[0];
    const world = createAbilityWorld();
    const guarded = { ...world, loadout: beginAbility(holdAbility(world.loadout, "shell-guard"), "shell-guard").loadout };
    const player = { ...createTurtleMotion(), x: debris.x, z: debris.z };
    const hit = tick(guarded, { player, rival: { ...createTurtleMotion(), x: 20, z: 20 } });
    expect(hit.world.playerHealth.current).toBe(100);
  });

  it("lets only a snap-capable turtle snap, and damages the rival", () => {
    const player = createTurtleMotion();
    const plain = tick(createAbilityWorld(), { player, snapPressed: true, canSnap: false });
    expect(plain.world.rivalHealth.current).toBe(100);
    const snapped = tick(createAbilityWorld(115), { player, snapPressed: true, canSnap: true });
    expect(snapped.world.rivalHealth.current).toBe(100 - damageRules.snap);
    expect(snapped.cues).toContain("snap-hit");
    const again = tick(snapped.world, { player, snapPressed: true, canSnap: true });
    expect(again.world.rivalHealth.current).toBe(100 - damageRules.snap);
  });

  it("collects no orb for a no-slot turtle", () => {
    const result = tick(createAbilityWorld(), { player: { ...createTurtleMotion(), ...onOrb }, itemSlots: 0 });
    expect(result.world.loadout.held).toBeNull();
  });
});
