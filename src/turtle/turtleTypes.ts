import type { SpecialId } from "../abilities/specials";
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
  /** How many Tide Orb abilities can be held at once. */
  itemSlots: number;
  /** The turtle's own move on E or Y, alongside its power-ups. */
  special: SpecialId | null;
}

/** Regular is the baseline. Every other type is described relative to it. */
export const turtleTypes: Record<TurtleTypeId, TurtleType> = {
  regular: {
    id: "regular",
    name: "Regular",
    summary: "Balanced. Health 50, holds 2 power-ups.",
    maxHealth: 50,
    speedScale: 1,
    bodyScale: 1,
    neckLength: 0,
    itemSlots: 2,
    special: null,
  },
  leatherback: {
    id: "leatherback",
    name: "Leatherback",
    summary: "Big and tough. Health 75, slower. Body slam stuns what it hits.",
    maxHealth: 75,
    speedScale: 0.85,
    bodyScale: 1.35,
    neckLength: 0,
    itemSlots: 1,
    special: "slam",
  },
  kempy: {
    id: "kempy",
    name: "Kempy",
    summary: "Small and quick. Health 35, faster. Spin dash makes it untouchable.",
    maxHealth: 35,
    speedScale: 1.2,
    bodyScale: 0.75,
    neckLength: 0,
    itemSlots: 1,
    special: "spin",
  },
  snappy: {
    id: "snappy",
    name: "Snappy",
    summary: "Long neck. Health 58. Snap stuns rivals and gulls.",
    maxHealth: 58,
    speedScale: 1,
    bodyScale: 1,
    neckLength: 0.55,
    itemSlots: 1,
    special: "snap",
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
