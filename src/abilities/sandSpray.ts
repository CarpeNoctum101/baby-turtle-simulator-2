import { applySandSlow, type RacerEffects } from "./abilityState";
import { sandRules } from "./catalog";
import { clampDt } from "./clock";

/** A cloud left where the turtle was when X was pressed. It does not follow the caster. */
export interface SandCloud {
  id: number;
  ownerId: string;
  x: number;
  z: number;
  heading: number;
  remaining: number;
  duration: number;
  hitIds: readonly string[];
}

export interface SprayTarget {
  id: string;
  x: number;
  z: number;
  effects: RacerEffects;
}

export interface SprayHit {
  targetId: string;
  blocked: boolean;
}

export function createSandCloud(
  id: number,
  ownerId: string,
  origin: { x: number; z: number; heading: number },
  duration: number,
): SandCloud {
  return {
    id,
    ownerId,
    x: origin.x,
    z: origin.z,
    heading: origin.heading,
    remaining: duration,
    duration,
    hitIds: [],
  };
}

/**
 * True when `point` sits in the box behind the cloud's facing.
 * Heading 0 faces +Z, so behind that cloud is toward -Z.
 */
export function isInSandSpray(
  cloud: { x: number; z: number; heading: number },
  point: { x: number; z: number },
): boolean {
  const dx = point.x - cloud.x;
  const dz = point.z - cloud.z;
  const forwardX = Math.sin(cloud.heading);
  const forwardZ = Math.cos(cloud.heading);
  const rightX = Math.cos(cloud.heading);
  const rightZ = -Math.sin(cloud.heading);
  const behind = -(dx * forwardX + dz * forwardZ);
  const side = dx * rightX + dz * rightZ;
  return behind >= sandRules.rearNear && behind <= sandRules.rearFar && Math.abs(side) <= sandRules.halfWidth;
}

/** Where the visible puff should sit: the middle of the rear box. */
export function sandCloudAnchor(cloud: { x: number; z: number; heading: number }): { x: number; z: number } {
  const mid = (sandRules.rearNear + sandRules.rearFar) / 2;
  return {
    x: cloud.x - Math.sin(cloud.heading) * mid,
    z: cloud.z - Math.cos(cloud.heading) * mid,
  };
}

/**
 * Each cloud checks every target once.
 * The owner is never hit, even if they back into their own sand.
 */
export function resolveSandClouds(
  clouds: readonly SandCloud[],
  targets: readonly SprayTarget[],
): { clouds: SandCloud[]; targets: SprayTarget[]; hits: SprayHit[] } {
  const nextTargets = targets.map((target) => ({ ...target, effects: { ...target.effects } }));
  const hits: SprayHit[] = [];
  const nextClouds = clouds.map((cloud) => {
    const hitIds = [...cloud.hitIds];
    for (const target of nextTargets) {
      if (target.id === cloud.ownerId || hitIds.includes(target.id)) {
        continue;
      }
      if (!isInSandSpray(cloud, target)) {
        continue;
      }
      hitIds.push(target.id);
      const applied = applySandSlow(target.effects);
      target.effects = applied.effects;
      hits.push({ targetId: target.id, blocked: applied.blocked });
    }
    return { ...cloud, hitIds };
  });
  return { clouds: nextClouds, targets: nextTargets, hits };
}

export function stepSandClouds(clouds: readonly SandCloud[], dt: number): SandCloud[] {
  const step = clampDt(dt);
  return clouds
    .map((cloud) => ({ ...cloud, remaining: cloud.remaining - step }))
    .filter((cloud) => cloud.remaining > 0);
}

export function ownCloudRemaining(clouds: readonly SandCloud[], ownerId: string): number {
  return clouds.reduce((longest, cloud) => (cloud.ownerId === ownerId ? Math.max(longest, cloud.remaining) : longest), 0);
}
