import { surfaces, type SurfaceProfile } from "./surfaces";

/**
 * A straight test course. The turtle starts at the nest, facing +Z.
 * Dry sand, wet sand, then shallow water lead to a finish gate.
 */
export const course = {
  halfWidth: 8,
  nest: { x: 0, z: -24 },
  dry: { minZ: -32, maxZ: -6 },
  wet: { minZ: -6, maxZ: 14 },
  water: { minZ: 14, maxZ: 52 },
  finish: { minZ: 36, maxZ: 44 },
};

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
