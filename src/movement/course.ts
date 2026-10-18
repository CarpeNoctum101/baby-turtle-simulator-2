import { surfaces, type SurfaceProfile } from "./surfaces";

/**
 * A straight test course. The turtle starts at the nest, facing +Z.
 * Dry sand, wet sand, then shallow water lead to a finish gate.
 */
export const course = {
  halfWidth: 16,
  nest: { x: 0, z: -24 },
  dry: { minZ: -36, maxZ: 18 },
  wet: { minZ: 18, maxZ: 40 },
  water: { minZ: 40, maxZ: 66 },
  finish: { minZ: 66, maxZ: 76 },
};

/** Three pads at the nest. The player uses the center pad. */
export const startingGrid = [
  { id: "left", x: -4.6, z: course.nest.z },
  { id: "center", x: course.nest.x, z: course.nest.z },
  { id: "right", x: 4.6, z: course.nest.z },
] as const;

export const playerStart = startingGrid[1];

export function surfaceAt(z: number): SurfaceProfile {
  if (z >= course.water.minZ) {
    return surfaces["shallow-water"];
  }
  if (z >= course.wet.minZ) {
    return surfaces["wet-sand"];
  }
  return surfaces["dry-sand"];
}

export function isInFinishZone(x: number, z: number): boolean {
  return Math.abs(x) <= course.halfWidth && z >= course.finish.minZ && z <= course.finish.maxZ;
}

/** Keeps the crawl on the beach instead of letting the turtle leave the course. */
export function clampToBeach(x: number): number {
  const limit = course.halfWidth - 0.7;
  return Math.min(limit, Math.max(-limit, x));
}

/** Stops the turtle at the back of the nest beach and the far side of the water. */
export function clampToCourse(z: number): number {
  return Math.min(course.water.maxZ, Math.max(course.dry.minZ, z));
}

/**
 * The band where Wave Rider can catch a boost.
 * It sits on the shoreline, a little before the water and a little into it.
 */
export const waveZone = {
  minZ: course.water.minZ - 3,
  maxZ: course.water.minZ + 3,
};

export function isInWaveZone(x: number, z: number): boolean {
  return Math.abs(x) <= course.halfWidth && z >= waveZone.minZ && z <= waveZone.maxZ;
}
