import { course } from "../../movement/course";

/** Visual terrain only. Keep the entire playable lane flat for the existing movement model. */
export function beachHeight(x: number, z: number): number {
  const outsideLane = smoothstep(course.halfWidth, course.halfWidth + 6.2, Math.abs(x));
  // Fall away over the last 14 metres before the water, which is where the dunes ended on the original shore.
  const inland = 1 - smoothstep(course.water.minZ - 14, course.water.minZ, z);
  const dunes = 0.55 + 0.45 * Math.sin(x * 0.23 + z * 0.12) + 0.28 * Math.sin(z * 0.29 - x * 0.15);
  const nest = Math.exp(-(x * x + (z + 24) ** 2) * 1.8) * 0.035;
  return 0.018 + outsideLane * inland * Math.max(0, dunes) - nest;
}

export function smoothstep(min: number, max: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export function seededRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

/** A random Z from `minZ` up to `margin` metres before the water, staying on the sand. */
export function inlandZ(minZ: number, margin: number, random: () => number): number {
  return minZ + random() * (course.water.minZ - margin - minZ);
}
