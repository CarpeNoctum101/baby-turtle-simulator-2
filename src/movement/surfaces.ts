export type SurfaceId = "dry-sand" | "wet-sand" | "shallow-water";

/**
 * How the ground changes the crawl.
 * Dry sand is slow and stops quickly. Wet sand is the easiest crawl.
 * Shallow water is fastest and keeps gliding, with heavier steering.
 */
export interface SurfaceProfile {
  id: SurfaceId;
  label: string;
  maxSpeed: number;
  maxReverseSpeed: number;
  acceleration: number;
  deceleration: number;
  brakeDeceleration: number;
  /** Radians per second at full steer while moving. */
  turnRate: number;
  /** How quickly the current steer catches the stick. Higher is snappier. */
  steerResponse: number;
}

export const surfaces: Record<SurfaceId, SurfaceProfile> = {
  "dry-sand": {
    id: "dry-sand",
    label: "Dry sand",
    maxSpeed: 3.2,
    maxReverseSpeed: 1.1,
    acceleration: 2.1,
    deceleration: 4.8,
    brakeDeceleration: 8,
    turnRate: 1.6,
    steerResponse: 4,
  },
  "wet-sand": {
    id: "wet-sand",
    label: "Wet sand",
    maxSpeed: 5.6,
    maxReverseSpeed: 1.6,
    acceleration: 4.4,
    deceleration: 3,
    brakeDeceleration: 7,
    turnRate: 2.15,
    steerResponse: 8,
  },
  "shallow-water": {
    id: "shallow-water",
    label: "Shallow water",
    maxSpeed: 8.4,
    maxReverseSpeed: 2.2,
    acceleration: 5.8,
    deceleration: 1.25,
    brakeDeceleration: 4.5,
    turnRate: 1.35,
    steerResponse: 2.8,
  },
};
