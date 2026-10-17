export type SurfaceId = "dry-sand" | "wet-sand" | "shallow-water";

/**
 * How the ground changes the crawl.
 * Dry sand is slow and stops almost at once. Wet sand is the easiest crawl.
 * Shallow water is the fastest, with a short glide and steering that still answers.
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
    deceleration: 7.5,
    brakeDeceleration: 12,
    turnRate: 3.4,
    steerResponse: 8,
  },
  "wet-sand": {
    id: "wet-sand",
    label: "Wet sand",
    maxSpeed: 5.6,
    maxReverseSpeed: 1.6,
    acceleration: 4.4,
    deceleration: 6,
    brakeDeceleration: 10,
    turnRate: 3.8,
    steerResponse: 10,
  },
  "shallow-water": {
    id: "shallow-water",
    label: "Shallow water",
    maxSpeed: 7.2,
    maxReverseSpeed: 2.2,
    acceleration: 5.4,
    deceleration: 5,
    brakeDeceleration: 9.5,
    turnRate: 3,
    steerResponse: 7,
  },
};
