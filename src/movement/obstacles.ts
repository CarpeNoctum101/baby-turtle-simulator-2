/**
 * Solid rocks and logs on the race lane.
 * Touching one does not cost health. The turtle is pushed back out, so the crawl has to go around.
 * These are separate from the small debris piles, which still only apply a collision penalty.
 */
export const obstacleLayout = [
  { id: "rock-back-left", kind: "rock" as const, x: -11, z: -30, radius: 1.25, length: 0, yaw: 0 },
  { id: "rock-back-right", kind: "rock" as const, x: 10.5, z: -28, radius: 1.15, length: 0, yaw: 0 },
  { id: "rock-left-nest", kind: "rock" as const, x: -12, z: -18, radius: 1.3, length: 0, yaw: 0 },
  { id: "rock-right-nest", kind: "rock" as const, x: 12, z: -16, radius: 1.2, length: 0, yaw: 0 },
  { id: "log-dry", kind: "log" as const, x: 1.2, z: -8, radius: 0.55, length: 4.2, yaw: 0.95 },
  { id: "rock-dry-left", kind: "rock" as const, x: -11, z: -1, radius: 1.4, length: 0, yaw: 0 },
  { id: "rock-dry-right", kind: "rock" as const, x: 12, z: 8, radius: 1.25, length: 0, yaw: 0 },
  { id: "log-mid", kind: "log" as const, x: -1, z: 14, radius: 0.5, length: 3.8, yaw: 1.25 },
  { id: "rock-wet-left", kind: "rock" as const, x: -12.5, z: 22, radius: 1.45, length: 0, yaw: 0 },
  { id: "rock-wet", kind: "rock" as const, x: 10, z: 30, radius: 1.2, length: 0, yaw: 0 },
  { id: "log-shore", kind: "log" as const, x: 1.5, z: 34, radius: 0.55, length: 4, yaw: 0.4 },
  { id: "rock-shore-left", kind: "rock" as const, x: -9, z: 44, radius: 1.35, length: 0, yaw: 0 },
  { id: "log-water", kind: "log" as const, x: 3, z: 50, radius: 0.5, length: 3.6, yaw: 1.05 },
  { id: "rock-water", kind: "rock" as const, x: 12, z: 56, radius: 1.4, length: 0, yaw: 0 },
  { id: "rock-water-left", kind: "rock" as const, x: -12, z: 60, radius: 1.25, length: 0, yaw: 0 },
  { id: "log-late", kind: "log" as const, x: -2, z: 64, radius: 0.5, length: 3.4, yaw: 0.35 },
];

export type CourseObstacle = (typeof obstacleLayout)[number];

/** Same body size the debris hits use, so a turtle cannot clip the corner of a rock. */
export const obstacleBodyRadius = 0.55;

/** True when a circle overlaps a rock or the length of a log. */
export function overlapsObstacle(x: number, z: number, radius: number): boolean {
  return obstacleLayout.some((obstacle) => overlapsFlat(obstacle, x, z, radius));
}

/**
 * Highest solid top under this circle, measured from the sand.
 * A bubble above that height flies over the rock or log. Open sand returns 0.
 */
export function obstacleTop(x: number, z: number, radius: number): number {
  let top = 0;
  for (const obstacle of obstacleLayout) {
    if (!overlapsFlat(obstacle, x, z, radius)) {
      continue;
    }
    const height = obstacle.kind === "log" ? obstacle.radius * 2 : obstacle.radius * 1.14;
    top = Math.max(top, height);
  }
  return top;
}

function overlapsFlat(obstacle: CourseObstacle, x: number, z: number, radius: number): boolean {
  const closest = closestPoint(obstacle, x, z);
  return Math.hypot(x - closest.x, z - closest.z) < obstacle.radius + radius;
}

/**
 * Slides a point out of every solid obstacle.
 * Two passes cover a turtle that is squeezed between two nearby shapes.
 */
export function pushOutOfObstacles(x: number, z: number, bodyRadius = obstacleBodyRadius): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const obstacle of obstacleLayout) {
      const closest = closestPoint(obstacle, px, pz);
      const dx = px - closest.x;
      const dz = pz - closest.z;
      const reach = obstacle.radius + bodyRadius;
      const dist = Math.hypot(dx, dz);
      if (dist >= reach) {
        continue;
      }
      if (dist < 0.0001) {
        px += reach;
        continue;
      }
      const push = (reach - dist) / dist;
      px += dx * push;
      pz += dz * push;
    }
  }
  return { x: px, z: pz };
}

function closestPoint(obstacle: CourseObstacle, x: number, z: number): { x: number; z: number } {
  if (obstacle.kind === "rock" || obstacle.length <= 0) {
    return { x: obstacle.x, z: obstacle.z };
  }
  const half = obstacle.length / 2;
  const dx = Math.sin(obstacle.yaw);
  const dz = Math.cos(obstacle.yaw);
  const ax = obstacle.x - dx * half;
  const az = obstacle.z - dz * half;
  const abx = dx * obstacle.length;
  const abz = dz * obstacle.length;
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * abx + (z - az) * abz) / len2));
  return { x: ax + abx * t, z: az + abz * t };
}
