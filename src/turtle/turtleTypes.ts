import type { CrawlModifiers } from "../movement/stepTurtle";

export type TurtleTypeId = "regular" | "leatherback" | "kempy" | "snappy";

export interface TurtleType {
  id: TurtleTypeId;
  name: string;
  /** One line shown on the picker. */
  summary: string;
  maxHealth: number;
  /** Multiplies top speed and acceleration. 1 is the regular turtle. */
  speedScale: number;
  /** Multiplies the whole model. 1 is the regular turtle. */
  bodyScale: number;
  /** Extra head distance in metres, in the model's own units. 0 keeps the regular head. */
  neckLength: number;
  /** How many Tide Orb abilities can be held at once. 0 means orbs do nothing. */
  itemSlots: number;
  /** True when this turtle has the cooldown snap. */
  canSnap: boolean;
}

/** Regular is the baseline. Every other type is described relative to it. */
export const turtleTypes: Record<TurtleTypeId, TurtleType> = {
  regular: {
    id: "regular",
    name: "Regular",
    summary: "Balanced. Health 100.",
    maxHealth: 100,
    speedScale: 1,
    bodyScale: 1,
    neckLength: 0,
    itemSlots: 1,
    canSnap: false,
  },
  leatherback: {
    id: "leatherback",
    name: "Leatherback",
    summary: "Big and tough. Health 150, slower, holds 2 power-ups.",
    maxHealth: 150,
    speedScale: 0.85,
    bodyScale: 1.35,
    neckLength: 0,
    itemSlots: 2,
    canSnap: false,
  },
  kempy: {
    id: "kempy",
    name: "Kempy",
    summary: "Small and quick. Health 70, faster.",
    maxHealth: 70,
    speedScale: 1.2,
    bodyScale: 0.75,
    neckLength: 0,
    itemSlots: 1,
    canSnap: false,
  },
  snappy: {
    id: "snappy",
    name: "Snappy",
    summary: "Long neck. Health 115, no power-ups, but it can snap.",
    maxHealth: 115,
    speedScale: 1,
    bodyScale: 1,
    neckLength: 0.55,
    itemSlots: 0,
    canSnap: true,
  },
};

export const turtleTypeList: readonly TurtleType[] = [
  turtleTypes.regular,
  turtleTypes.leatherback,
  turtleTypes.kempy,
  turtleTypes.snappy,
];

export const defaultTurtleType: TurtleTypeId = "regular";

/** Multiplies the crawl caps by one more factor, such as a turtle's speed or tiredness. */
export function scaleCrawl(modifiers: CrawlModifiers, factor: number): CrawlModifiers {
  return {
    maxSpeedMultiplier: (modifiers.maxSpeedMultiplier ?? 1) * factor,
    accelerationMultiplier: (modifiers.accelerationMultiplier ?? 1) * factor,
  };
}
