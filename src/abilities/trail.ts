import { course } from "../movement/course";

export interface TrailPoint {
  x: number;
  z: number;
}

/**
 * Markers from the turtle toward the finish gate.
 * They stop short of the gate so the last one still reads as a direction, not a finish line.
 */
export function oceanTrail(fromX: number, fromZ: number, count = 8): TrailPoint[] {
  return trailToward(fromX, fromZ, 0, course.finish.minZ, count);
}

export function trailToward(fromX: number, fromZ: number, goalX: number, goalZ: number, count = 8): TrailPoint[] {
  const dx = goalX - fromX;
  const dz = goalZ - fromZ;
  const length = Math.hypot(dx, dz);
  if (length < 1.2 || count < 1) {
    return [];
  }
  const spacing = Math.min(3, length / (count + 1));
  const points: TrailPoint[] = [];
  for (let index = 1; index <= count; index += 1) {
    const distance = spacing * index;
    if (distance >= length - 0.4) {
      break;
    }
    points.push({
      x: fromX + (dx / length) * distance,
      z: fromZ + (dz / length) * distance,
    });
  }
  return points;
}
