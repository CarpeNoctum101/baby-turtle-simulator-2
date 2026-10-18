import { describe, expect, it } from "vitest";
import { createTurtleMotion, type TurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion } from "../race/stepRival";
import { beginAbility, createEffects, createLoadout, holdAbility, speedModifiers } from "./abilityState";
import { starterAbilityPool } from "./catalog";
import { debrisLayout } from "./contacts";
import { damageRules } from "./health";
import { snapRules } from "./snap";
import { createSlam, slamRules, spinRules, startSlam, stepSlam } from "./specials";
import { applyCollisionPenalty, applySandSlow } from "./abilityState";
import { createAbilityWorld, defaultMaxHealth, stepAbilityWorld, type AbilityTick, type AbilityWorld } from "./stepAbilityWorld";
import { createSeagull } from "../mob/seagull";

const frame = 1 / 60;

function tick(world: AbilityWorld, player: TurtleMotion, overrides: Partial<AbilityTick> = {}) {
  return stepAbilityWorld(world, {
    dt: frame,
    racing: true,
    activate: false,
    inWaveZone: false,
    random: () => 0,
    pool: starterAbilityPool,
    ...overrides,
    player,
    rival: overrides.rival ?? { ...createRivalMotion(player), x: 30, z: 30 },
  });
}

/** Runs frames, feeding each frame's player back in and adding the knock/slam shift like the game does. */
function run(world: AbilityWorld, player: TurtleMotion, seconds: number, overrides: Partial<AbilityTick> = {}) {
  let current = world;
  let motion = player;
  let rival: TurtleMotion | undefined = overrides.rival;
  let cues: string[] = [];
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    const result = tick(current, motion, { ...overrides, rival, specialPressed: step === 0 && overrides.specialPressed });
    current = result.world;
    motion = { ...result.player, x: result.player.x + result.playerShift.x, z: result.player.z + result.playerShift.z };
    rival = result.rival;
    cues = cues.concat(result.cues);
  }
  return { world: current, player: motion, rival, cues };
}

describe("cooldowns", () => {
  it("gives the slam a longer cooldown than the snap, and the spin the same as the snap", () => {
    expect(slamRules.cooldown).toBeGreaterThan(snapRules.cooldown);
    expect(spinRules.cooldown).toBe(snapRules.cooldown);
  });

  it("starts a slam only when it is ready and counts the cooldown down", () => {
    const started = startSlam(createSlam(), 0);
    expect(started.activeRemaining).toBe(slamRules.duration);
    expect(startSlam(started, 0)).toBe(started);
    let state = started;
    for (let t = 0; t < slamRules.cooldown + 1; t += 0.05) state = stepSlam(state, 0.05);
    expect(state.cooldownRemaining).toBe(0);
    expect(startSlam(state, 1).activeRemaining).toBe(slamRules.duration);
  });
});

describe("leatherback body slam", () => {
  const slamming = { ...createTurtleMotion(), x: 0, z: 0, heading: 0 };

  it("moves the turtle forward a decent distance and stops it afterwards", () => {
    const result = run(createAbilityWorld(150), slamming, slamRules.duration + 0.2, { special: "slam", specialPressed: true });
    expect(result.player.z).toBeGreaterThan(slamRules.speed * slamRules.duration * 0.9);
    expect(result.player.z).toBeLessThan(slamRules.speed * slamRules.duration * 1.1);
    expect(result.player.x).toBeCloseTo(0, 5);
    expect(result.cues).toContain("slam");
  });

  it("goes in the heading it started with and locks the controls while it surges", () => {
    const side = { ...slamming, heading: Math.PI / 2 };
    const first = tick(createAbilityWorld(150), side, { special: "slam", specialPressed: true });
    expect(first.controlsLocked).toBe(true);
    expect(first.playerShift.x).toBeGreaterThan(0);
    expect(Math.abs(first.playerShift.z)).toBeLessThan(1e-6);
    expect(run(first.world, side, slamRules.duration + 0.1).world.slam.activeRemaining).toBe(0);
    expect(tick(createAbilityWorld(150), slamming).controlsLocked).toBe(false);
  });

  it("stuns the rival in its path for damage, once", () => {
    const rival = { ...createTurtleMotion(), x: 0, z: 1 };
    const hit = run(createAbilityWorld(150), slamming, 0.3, { special: "slam", specialPressed: true, rival });
    expect(hit.world.rivalEffects.stunRemaining).toBeGreaterThan(0);
    expect(hit.world.rivalHealth.current).toBe(defaultMaxHealth - slamRules.damage);
    expect(hit.cues.filter((cue) => cue === "slam-hit")).toHaveLength(1);
  });

  it("holds a stunned rival still", () => {
    expect(speedModifiers({ ...createEffects(), stunRemaining: 1 }).maxSpeedMultiplier).toBe(0);
    expect(speedModifiers(createEffects()).maxSpeedMultiplier).toBe(1);
  });

  it("is stopped by the rival's Shell Guard", () => {
    const rival = { ...createTurtleMotion(), x: 0, z: 1 };
    const world = createAbilityWorld(150);
    const guard = beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout.effects;
    const hit = run({ ...world, rivalEffects: guard }, slamming, 0.3, { special: "slam", specialPressed: true, rival });
    expect(hit.world.rivalEffects.stunRemaining).toBe(0);
    expect(hit.world.rivalEffects.shieldCharges).toBe(0);
    expect(hit.world.rivalHealth.current).toBe(defaultMaxHealth);
  });

  it("stuns a low seagull in its path but not one high above", () => {
    const world = createAbilityWorld(150, []);
    const low = { ...createSeagull("low", { x: 0, z: 1 }), phase: "chase" as const, y: 1.1 };
    // Its grace timer keeps it circling up high instead of diving, so it stays above the slam.
    const high = { ...createSeagull("high", { x: 0, z: 1 }, true), grace: 10 };
    const hit = run({ ...world, seagulls: [low, high] }, slamming, 0.3, { special: "slam", specialPressed: true });
    expect(hit.world.seagulls[0]!.phase).toBe("stunned");
    expect(hit.world.seagulls[1]!.phase).not.toBe("stunned");
  });

  it("plows through debris without losing health", () => {
    const debris = debrisLayout[0];
    const start = { ...slamming, x: debris.x, z: debris.z - 3 };
    const hit = run(createAbilityWorld(150), start, 0.5, { special: "slam", specialPressed: true });
    expect(hit.world.playerHealth.current).toBe(150);
  });

  it("does nothing for a turtle without the move", () => {
    const result = run(createAbilityWorld(100), slamming, 0.3, { special: null, specialPressed: true });
    expect(result.player.z).toBe(0);
  });
});

describe("kempy spin dash", () => {
  const kempy = { ...createTurtleMotion(), x: 0, z: -20 };

  it("starts the spin, boosts speed and starts the cooldown", () => {
    const result = tick(createAbilityWorld(70), kempy, { special: "spin", specialPressed: true });
    expect(result.cues).toContain("spin");
    const effects = result.world.loadout.effects;
    expect(effects.spinRemaining).toBeGreaterThan(spinRules.duration - 0.05);
    expect(speedModifiers(effects).maxSpeedMultiplier).toBeGreaterThan(1.5);
    expect(result.world.spin.cooldownRemaining).toBeCloseTo(spinRules.cooldown, 1);
    expect(result.controlsLocked).toBe(false);
  });

  it("cannot be restarted until the cooldown ends, and ends after its duration", () => {
    const first = run(createAbilityWorld(70), kempy, 0.3, { special: "spin", specialPressed: true });
    const again = tick(first.world, kempy, { special: "spin", specialPressed: true });
    expect(again.cues).not.toContain("spin");
    const over = run(createAbilityWorld(70), kempy, spinRules.duration + 0.1, { special: "spin", specialPressed: true });
    expect(over.world.loadout.effects.spinRemaining).toBe(0);
    expect(over.world.spin.cooldownRemaining).toBeGreaterThan(0);
  });

  it("shrugs off debris, rival bumps, sand and snaps while it spins, then is hurt again", () => {
    const spinning = { ...createEffects(), spinRemaining: 1 };
    const motion = { ...createTurtleMotion(), speed: 3 };
    expect(applyCollisionPenalty(motion, spinning)).toMatchObject({ blocked: true, motion });
    expect(applySandSlow(spinning)).toMatchObject({ blocked: true });
    expect(applySandSlow(spinning).effects.slowRemaining).toBe(0);
    const open = applyCollisionPenalty(motion, createEffects());
    expect(open.blocked).toBe(false);
    expect(open.motion.speed).toBeLessThan(3);
  });

  it("takes no health from debris while spinning but does once the spin ends", () => {
    const debris = debrisLayout[0];
    const there = { ...createTurtleMotion(), x: debris.x, z: debris.z };
    const world = createAbilityWorld(70);
    const spun = { ...world, loadout: { ...world.loadout, effects: { ...world.loadout.effects, spinRemaining: 1 } } };
    expect(tick(spun, there).world.playerHealth.current).toBe(70);
    expect(tick(world, there).world.playerHealth.current).toBe(70 - damageRules.debris);
  });

  it("makes a seagull bounce off without hurting, and keeps a Shell Guard charge", () => {
    const home = { x: 0, z: -20 };
    const world = createAbilityWorld(70, []);
    const gull = { ...createSeagull("g", home), phase: "chase" as const };
    const guard = beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout.effects;
    const spinning = { ...world, seagulls: [gull], loadout: { ...world.loadout, effects: { ...guard, spinRemaining: 1 } } };
    const result = tick(spinning, { ...kempy, x: 0, z: -20.5 });
    expect(result.world.playerHealth.current).toBe(70);
    expect(result.world.loadout.effects.shieldCharges).toBe(1);
    expect(result.world.seagulls[0]!.phase).toBe("recover");
  });
});
