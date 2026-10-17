import type { AbilityId } from "./catalog";
import { clampDt } from "./clock";
import type { AbilityLoadout } from "./abilityState";

/** Fixed spots along the beach. Each roll is random. Position does not change the odds yet. */
export const tideOrbSpots = [
  { id: "orb-nest-left", x: -5.5, z: -16 },
  { id: "orb-dry-right", x: 5.2, z: -2 },
  { id: "orb-wet-left", x: -4.6, z: 18 },
  { id: "orb-shore-right", x: 4.8, z: 28 },
  { id: "orb-water", x: -3.5, z: 38 },
] as const;

export const orbPickupRadius = 1.05;
export const orbRespawnSeconds = 9;

export interface TideOrb {
  id: string;
  x: number;
  z: number;
  /** Seconds until this orb can be collected again. 0 means it is sitting on the sand. */
  respawnIn: number;
}

export function createTideOrbs(): TideOrb[] {
  return tideOrbSpots.map((spot) => ({ id: spot.id, x: spot.x, z: spot.z, respawnIn: 0 }));
}

export function stepTideOrbs(orbs: readonly TideOrb[], dt: number): TideOrb[] {
  const step = clampDt(dt);
  return orbs.map((orb) => ({ ...orb, respawnIn: Math.max(0, orb.respawnIn - step) }));
}

/** Equal chance for each ability in the pool. `random` returns a number from 0 up to, but not past, 1. */
export function rollAbility(random: () => number, pool: readonly AbilityId[]): AbilityId {
  const fallback = pool[0];
  if (!fallback) {
    throw new Error("The Tide Orb pool is empty.");
  }
  const roll = random();
  const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  const index = Math.min(pool.length - 1, Math.floor(unit * pool.length));
  return pool[index] ?? fallback;
}

export interface PickupResult {
  orbs: TideOrb[];
  loadout: AbilityLoadout;
  granted: AbilityId | null;
}

/**
 * The turtle can hold one ability. A second orb is left on the sand until the slot is empty.
 * An orb that was just collected stays gone until its respawn timer finishes.
 */
export function collectTideOrbs(
  orbs: readonly TideOrb[],
  loadout: AbilityLoadout,
  racer: { x: number; z: number },
  random: () => number,
  pool: readonly AbilityId[],
): PickupResult {
  if (loadout.held !== null) {
    return { orbs: orbs.map((orb) => ({ ...orb })), loadout, granted: null };
  }

  const index = orbs.findIndex(
    (orb) => orb.respawnIn <= 0 && Math.hypot(orb.x - racer.x, orb.z - racer.z) <= orbPickupRadius,
  );
  if (index < 0) {
    return { orbs: orbs.map((orb) => ({ ...orb })), loadout, granted: null };
  }

  const granted = rollAbility(random, pool);
  return {
    granted,
    loadout: { ...loadout, held: granted },
    orbs: orbs.map((orb, orbIndex) => (orbIndex === index ? { ...orb, respawnIn: orbRespawnSeconds } : { ...orb })),
  };
}
