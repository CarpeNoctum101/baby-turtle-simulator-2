export type AbilityId = "flipper-frenzy" | "shell-guard" | "sand-spray" | "wave-rider" | "magnetic-sense";

export interface AbilityRules {
  id: AbilityId;
  name: string;
  /** Shown on the ability HUD when this item is ready. */
  summary: string;
  /**
   * How long the effect stays up after X is pressed.
   * Wave Rider uses this as the timing window, then a separate boost if the timing lands.
   * Another ability cannot start until this one has finished.
   */
  duration: number;
}

/**
 * Flipper Frenzy raises the crawl caps. The item is spent on use.
 * When the duration hits zero, the caps return to the sand under the turtle.
 */
export const frenzyRules = {
  maxSpeedMultiplier: 1.65,
  accelerationMultiplier: 1.4,
} as const;

/** Shell Guard holds exactly one charge. The second eligible hit gets through. */
export const shellRules = {
  charges: 1,
} as const;

/**
 * The sand cloud is a box behind the caster.
 * rearNear/rearFar are distances behind the shell. halfWidth is the side reach.
 */
export const sandRules = {
  slowDuration: 1.6,
  slowMultiplier: 0.4,
  rearNear: 0.55,
  rearFar: 3.4,
  halfWidth: 1.15,
} as const;

/** A bump or an ability hit multiplies speed by this when the shell is down. */
export const collisionSpeedScale = 0.45;

/**
 * Wave Rider arms a short window. Being in the wave zone during that window
 * starts the boost. Missing the zone spends the orb and grants nothing.
 */
export const waveRules = {
  boostDuration: 2.8,
  maxSpeedMultiplier: 1.5,
  accelerationMultiplier: 1.25,
} as const;

export const abilityCatalog: Record<AbilityId, AbilityRules> = {
  "flipper-frenzy": {
    id: "flipper-frenzy",
    name: "Flipper Frenzy",
    summary: "A short burst of extra speed.",
    duration: 3.2,
  },
  "shell-guard": {
    id: "shell-guard",
    name: "Shell Guard",
    summary: "Blocks one ability hit or collision.",
    duration: 5,
  },
  "sand-spray": {
    id: "sand-spray",
    name: "Sand Spray",
    summary: "Blows a sand cloud behind you.",
    duration: 1.35,
  },
  "wave-rider": {
    id: "wave-rider",
    name: "Wave Rider",
    summary: "Press X as you enter the shoreline waves.",
    duration: 1.35,
  },
  "magnetic-sense": {
    id: "magnetic-sense",
    name: "Magnetic Sense",
    summary: "Shows a trail toward the sea.",
    duration: 7,
  },
};

/** The first three abilities. Tests can use this pool on its own. */
export const starterAbilityPool: readonly AbilityId[] = ["flipper-frenzy", "shell-guard", "sand-spray"];

/** Every Tide Orb ability, still rolled with equal odds. */
export const raceAbilityPool: readonly AbilityId[] = [...starterAbilityPool, "wave-rider", "magnetic-sense"];
