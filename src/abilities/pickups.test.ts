import { describe, expect, it } from "vitest";
import { createLoadout, holdAbility } from "./abilityState";
import { raceAbilityPool, starterAbilityPool } from "./catalog";
import { collectTideOrbs, createTideOrbs, orbRespawnSeconds, rollAbility, stepTideOrbs, tideOrbSpots } from "./pickups";

describe("tide orbs", () => {
  it("gives the overlapping turtle one random ability and leaves the orb to respawn", () => {
    const spot = tideOrbSpots[0];
    if (!spot) {
      throw new Error("expected an orb");
    }
    const granted = collectTideOrbs(createTideOrbs(), createLoadout(), spot, () => 0, starterAbilityPool);
    expect(granted.granted).toBe("flipper-frenzy");
    expect(granted.loadout.held).toBe("flipper-frenzy");
    expect(granted.orbs[0]?.respawnIn).toBe(orbRespawnSeconds);
    expect(granted.orbs[1]?.respawnIn).toBe(0);
  });

  it("does not grant an orb the turtle missed, already holds through, or that is respawning", () => {
    const spot = tideOrbSpots[1];
    if (!spot) {
      throw new Error("expected an orb");
    }
    const missed = collectTideOrbs(createTideOrbs(), createLoadout(), { x: spot.x + 5, z: spot.z }, () => 0, starterAbilityPool);
    const holding = collectTideOrbs(
      createTideOrbs(),
      holdAbility(createLoadout(), "shell-guard"),
      spot,
      () => 0,
      starterAbilityPool,
    );
    const gone = createTideOrbs().map((orb, index) => (index === 1 ? { ...orb, respawnIn: 3 } : orb));
    const waiting = collectTideOrbs(gone, createLoadout(), spot, () => 0, starterAbilityPool);
    expect(missed.granted).toBeNull();
    expect(holding.granted).toBeNull();
    expect(holding.loadout.held).toBe("shell-guard");
    expect(waiting.granted).toBeNull();
  });

  it("rolls across the whole starter pool and brings an orb back after the timer", () => {
    expect(rollAbility(() => 0, starterAbilityPool)).toBe("flipper-frenzy");
    expect(rollAbility(() => 0.34, starterAbilityPool)).toBe("shell-guard");
    expect(rollAbility(() => 0.67, starterAbilityPool)).toBe("sand-spray");
    expect(rollAbility(() => 0.99, starterAbilityPool)).toBe("sand-spray");
    expect(raceAbilityPool).toEqual(["flipper-frenzy", "shell-guard", "sand-spray", "wave-rider", "magnetic-sense"]);
    expect(rollAbility(() => 0.6, raceAbilityPool)).toBe("wave-rider");
    expect(rollAbility(() => 0.99, raceAbilityPool)).toBe("magnetic-sense");
    const spent = createTideOrbs().map((orb) => ({ ...orb, respawnIn: 0.04 }));
    const back = stepTideOrbs(spent, 0.05);
    expect(back.every((orb) => orb.respawnIn === 0)).toBe(true);
  });

  it("starts a rematch with every orb available", () => {
    expect(createTideOrbs().every((orb) => orb.respawnIn === 0)).toBe(true);
  });
});
