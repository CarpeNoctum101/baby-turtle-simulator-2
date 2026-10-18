/**
 * Solid rocks and logs on the race lane.
 * Touching one does not cost health. The turtle is pushed back out, so the crawl has to go around.
 * These are separate from the small debris piles, which still only apply a collision penalty.
 */
export const obstacleLayout = [
  { id: "rock-left-nest", kind: "rock" as const, x: -6.8, z: -20, radius: 1.1, length: 0, yaw: 0 },
  { id: "rock-right-nest", kind: "rock" as const, x: 6.5, z: -18, radius: 1.25, length: 0, yaw: 0 },
  { id: "log-dry", kind: "log" as const, x: 0, z: -12, radius: 0.5, length: 3.4, yaw: 1.2 },
  { id: "rock-left-mid", kind: "rock" as const, x: -7.2, z: 2, radius: 1.4, length: 0, yaw: 0 },
  { id: "rock-right-mid", kind: "rock" as const, x: 7.5, z: 12, radius: 1.3, length: 0, yaw: 0 },
  { id: "rock-wet", kind: "rock" as const, x: 2.2, z: 16, radius: 1.15, length: 0, yaw: 0 },
  { id: "log-shore", kind: "log" as const, x: -7, z: 26, radius: 0.55, length: 3.2, yaw: 0.3 },
  { id: "rock-water", kind: "rock" as const, x: 6.8, z: 36, radius: 1.35, length: 0, yaw: 0 },
];

export type CourseObstacle = (typeof obstacleLayout)[number];

/** Same body size the debris hits use, so a turtle cannot clip the corner of a rock. */
export const obstacleBodyRadius = 0.55;

/** True when a circle overlaps a rock or the length of a log. */
export function overlapsObstacle(x: number, z: number, radius: number): boolean {
  return obstacleLayout.some((obstacle) => {
    const closest = closestPoint(obstacle, x, z);
    return Math.hypot(x - closest.x, z - closest.z) < obstacle.radius + radius;
  });
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
