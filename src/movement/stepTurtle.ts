import { clampToBeach, clampToCourse, playerStart, surfaceAt } from "./course";

export interface DriveInput {
  /** Positive moves the way the camera looks. Negative moves the opposite way. */
  throttle: number;
  /** Positive moves to the camera's right. */
  steer: number;
  brake: boolean;
}

/** Flat direction the camera is facing. Stick up follows this. */
export interface CameraPlan {
  forwardX: number;
  forwardZ: number;
}

export const oceanPlan: CameraPlan = { forwardX: 0, forwardZ: 1 };

/** Yaw 0 looks toward the ocean. Negative yaw looks to the turtle's right. */
export function planFromYaw(yaw: number): CameraPlan {
  return {
    forwardX: -Math.sin(yaw) || 0,
    forwardZ: Math.cos(yaw) || 0,
  };
}

/** Temporary ability caps. 1 is a normal crawl. The sand's own numbers are multiplied by these. */
export interface CrawlModifiers {
  maxSpeedMultiplier?: number;
  accelerationMultiplier?: number;
}

/** Position and crawl state. This is plain data, separate from the 3D meshes. */
export interface TurtleMotion {
  x: number;
  z: number;
  /** 0 faces toward +Z, the ocean. */
  heading: number;
  speed: number;
  /** Latest sideways input, from -1 to 1. */
  steer: number;
}

export function createTurtleMotion(): TurtleMotion {
  return {
    x: playerStart.x,
    z: playerStart.z,
    heading: 0,
    speed: 0,
    steer: 0,
  };
}

/**
 * Advances the crawl by one slice of time.
 * Stick up, or W, moves along the camera's ground direction.
 * Stick left and right move sideways relative to that same camera. They do not turn it.
 * The surface changes acceleration, top speed, and coasting.
 */
export function stepTurtle(
  state: TurtleMotion,
  input: DriveInput,
  dt: number,
  plan: CameraPlan = oceanPlan,
  modifiers: CrawlModifiers = {},
): TurtleMotion {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const surface = surfaceAt(state.z);
  const wish = wishDirection(input.throttle, input.steer, plan);
  const acceleration = surface.acceleration * scaleOf(modifiers.accelerationMultiplier);
  const maxSpeed = surface.maxSpeed * scaleOf(modifiers.maxSpeedMultiplier);

  let heading = state.heading;
  let speed = state.speed;
  if (input.brake) {
    speed = moveToward(speed, 0, surface.brakeDeceleration * safeDt);
  } else if (wish) {
    heading = wish.heading;
    speed += wish.amount * acceleration * safeDt;
  } else {
    speed = moveToward(speed, 0, surface.deceleration * safeDt);
  }

  speed = clamp(speed, 0, maxSpeed);

  return {
    x: clampToBeach(state.x + Math.sin(heading) * speed * safeDt),
    z: clampToCourse(state.z + Math.cos(heading) * speed * safeDt),
    heading,
    speed,
    steer: input.steer,
  };
}

function wishDirection(
  throttle: number,
  steer: number,
  plan: CameraPlan,
): { heading: number; amount: number } | null {
  const rightX = plan.forwardZ;
  const rightZ = -plan.forwardX;
  const wishX = plan.forwardX * throttle + rightX * steer;
  const wishZ = plan.forwardZ * throttle + rightZ * steer;
  const amount = Math.hypot(wishX, wishZ);
  if (amount < 0.001) {
    return null;
  }
  return {
    heading: Math.atan2(wishX, wishZ),
    amount: Math.min(1, amount),
  };
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(target, current + maxDelta);
  }
  return Math.max(target, current - maxDelta);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scaleOf(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, value);
}
