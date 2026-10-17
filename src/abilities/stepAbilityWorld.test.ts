import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion, rivalAnchor } from "../race/stepRival";
import { createEffects, createLoadout, isTrailVisible, speedModifiers } from "./abilityState";
import { abilityCatalog, sandRules, starterAbilityPool, waveRules } from "./catalog";
import { debrisLayout } from "./contacts";
import { tideOrbSpots } from "./pickups";
import { isInSandSpray } from "./sandSpray";
import { createAbilityWorld, stepAbilityWorld, type AbilityTick, type AbilityWorld } from "./stepAbilityWorld";

const frame = 1 / 60;

function tick(world: AbilityWorld, overrides: Partial<AbilityTick> = {}) {
  const player = overrides.player ?? createTurtleMotion();
  return stepAbilityWorld(world, {
    dt: frame,
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

function run(world: AbilityWorld, seconds: number, overrides: Partial<AbilityTick> = {}) {
  let current = world;
  let player = overrides.player ?? createTurtleMotion();
  let rival = overrides.rival ?? createRivalMotion(player);
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    const next = tick(current, { ...overrides, player, rival, activate: step === 0 && overrides.activate === true });
    current = next.world;
    player = next.player;
    rival = next.rival;
  }
  return { world: current, player, rival };
}

describe("ability world", () => {
  it("collects a tide orb only during the race and starts frenzy from X", () => {
    const spot = tideOrbSpots[0];
    if (!spot) throw new Error("expected an orb");
    const player = { ...createTurtleMotion(), x: spot.x, z: spot.z };
    const waiting = tick(createAbilityWorld(), { racing: false, player });
    const collected = tick(createAbilityWorld(), { player });
    const used = tick(collected.world, { player, activate: true });
    expect(waiting.world.loadout.held).toBeNull();
    expect(collected.world.loadout.held).toBe("flipper-frenzy");
    expect(collected.cues).toContain("pickup");
    expect(used.world.loadout.held).toBeNull();
    expect(used.world.loadout.effects.frenzyRemaining).toBeGreaterThan(3);
    expect(used.cues).toContain("frenzy");
    expect(speedModifiers(used.world.loadout.effects).maxSpeedMultiplier).toBeGreaterThan(1);
  });

  it("expires frenzy, including when the world is replaced for a rematch", () => {
    const spot = tideOrbSpots[0];
    if (!spot) throw new Error("expected an orb");
    const player = { ...createTurtleMotion(), x: spot.x, z: spot.z, speed: 3 };
    const used = tick(tick(createAbilityWorld(), { player }).world, { player, activate: true });
    const expired = run(used.world, abilityCatalog["flipper-frenzy"].duration + 0.1, {
      player: { ...player, x: 0, z: -24 },
    });
    expect(expired.world.loadout.effects.frenzyRemaining).toBe(0);
    expect(speedModifiers(expired.world.loadout.effects).maxSpeedMultiplier).toBe(1);
    const restarted = createAbilityWorld();
    expect(speedModifiers(restarted.loadout.effects).maxSpeedMultiplier).toBe(1);
    expect(restarted.loadout.effects.shieldCharges).toBe(0);
    expect(restarted.orbs.every((orb) => orb.respawnIn === 0)).toBe(true);
    expect(restarted.clouds).toEqual([]);
  });

  it("slows only the rival standing in the rear cloud", () => {
    const player = createTurtleMotion();
    const behind = { ...createRivalMotion(player), ...rivalAnchor(player), speed: 3 };
    const ahead = { ...behind, x: player.x, z: player.z + 3, speed: 3 };
    const held = tick(createAbilityWorld(), { player, random: () => 0.9 });
    expect(held.world.loadout.held).toBeNull();
    const spraying = tick(createAbilityWorld(), {
      player,
      rival: behind,
      random: () => 0.9,
    });
    const pocket = {
      ...createAbilityWorld(),
      loadout: { ...createAbilityWorld().loadout, held: "sand-spray" as const },
    };
    const hit = tick(pocket, { player, rival: behind, activate: true });
    const missed = tick(pocket, { player, rival: ahead, activate: true });
    expect(isInSandSpray({ x: player.x, z: player.z, heading: player.heading }, behind)).toBe(true);
    expect(hit.world.rivalEffects.slowRemaining).toBeGreaterThan(sandRules.slowDuration - 0.05);
    expect(hit.cues).toContain("spray");
    expect(missed.world.rivalEffects.slowRemaining).toBe(0);
    expect(hit.world.loadout.effects.slowRemaining).toBe(0);
    expect(spraying.world.loadout.held).toBeNull();
  });

  it("lets a shell stop one debris hit, then takes the next hit from that same pile", () => {
    const debris = debrisLayout[0];
    if (!debris) throw new Error("expected debris");
    const player = { ...createTurtleMotion(), x: debris.x, z: debris.z, speed: 4 };
    const rival = { ...createRivalMotion(player), x: debris.x + 6, z: debris.z, speed: 0 };
    const guarded = {
      ...createAbilityWorld(),
      loadout: {
        ...createAbilityWorld().loadout,
        effects: { ...createEffects(), shieldRemaining: 5, shieldCharges: 1 },
      },
    };
    const blocked = tick(guarded, { player, rival });
    const stillThere = tick(blocked.world, { player: blocked.player, rival: blocked.rival });
    const later = run(blocked.world, 1, { player: blocked.player, rival: blocked.rival });
    expect(blocked.cues).toContain("block");
    expect(blocked.player.speed).toBe(4);
    expect(blocked.world.loadout.effects.shieldCharges).toBe(0);
    expect(stillThere.player.speed).toBe(4);
    expect(stillThere.cues).not.toContain("bump");
    expect(later.player.speed).toBeLessThan(4);
  });

  it("boosts wave rider only when the window reaches the wave zone", () => {
    const held = {
      ...createAbilityWorld(),
      loadout: { ...createLoadout(), held: "wave-rider" as const },
    };
    const armed = tick(held, { activate: true, inWaveZone: false });
    const entered = tick(armed.world, { inWaveZone: true });
    const missed = run(held, abilityCatalog["wave-rider"].duration + 0.15, { activate: true, inWaveZone: false });
    expect(armed.cues).toContain("wave-arm");
    expect(armed.cues).not.toContain("wave-boost");
    expect(armed.world.loadout.effects.waveBoostRemaining).toBe(0);
    expect(entered.cues).toContain("wave-boost");
    expect(entered.cues).not.toContain("wave-miss");
    expect(entered.world.loadout.effects.waveBoostRemaining).toBeGreaterThan(waveRules.boostDuration - 0.05);
    expect(speedModifiers(entered.world.loadout.effects).maxSpeedMultiplier).toBe(waveRules.maxSpeedMultiplier);
    expect(missed.world.loadout.effects.waveWindowRemaining).toBe(0);
    expect(missed.world.loadout.effects.waveBoostRemaining).toBe(0);
    expect(createAbilityWorld().loadout.effects.waveBoostRemaining).toBe(0);
  });

  it("shows the ocean trail only while magnetic sense is running", () => {
    const held = {
      ...createAbilityWorld(),
      loadout: { ...createLoadout(), held: "magnetic-sense" as const },
    };
    const shown = tick(held, { activate: true });
    const faded = run(shown.world, abilityCatalog["magnetic-sense"].duration + 0.1);
    expect(shown.cues).toContain("trail");
    expect(isTrailVisible(shown.world.loadout.effects)).toBe(true);
    expect(isTrailVisible(faded.world.loadout.effects)).toBe(false);
    expect(isTrailVisible(createAbilityWorld().loadout.effects)).toBe(false);
  });
});
