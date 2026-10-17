import { clampToBeach, clampToCourse, course, surfaceAt } from "./course";

export interface DriveInput {
  throttle: number;
  steer: number;
  brake: boolean;
}

/** Position and crawl state. This is plain data, separate from the 3D meshes. */
export interface TurtleMotion {
  x: number;
  z: number;
  /** 0 faces toward +Z, the ocean. */
  heading: number;
  speed: number;
  /** Smoothed steer, from -1 to 1. It lags behind the stick. */
  steer: number;
}

export function createTurtleMotion(): TurtleMotion {
  return {
    x: course.nest.x,
    z: course.nest.z,
    heading: 0,
    speed: 0,
    steer: 0,
  };
}

/**
 * Advances the crawl by one slice of time.
 * Speed builds and fades instead of jumping, and the heading follows the steer
 * a moment later. The surface under the turtle changes acceleration, top speed,
 * coasting, and how heavy the turn feels.
 */
export function stepTurtle(state: TurtleMotion, input: DriveInput, dt: number): TurtleMotion {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const surface = surfaceAt(state.z);
  const steerLag = Math.exp(-surface.steerResponse * safeDt);
  const steer = input.steer + (state.steer - input.steer) * steerLag;

  const speedRatio = surface.maxSpeed === 0 ? 0 : Math.min(1, Math.abs(state.speed) / surface.maxSpeed);
  const turnStrength = 0.35 + 0.65 * speedRatio;
  const heading = wrapAngle(state.heading + steer * surface.turnRate * turnStrength * safeDt);

  let speed = state.speed;
  if (input.brake) {
    speed = moveToward(speed, 0, surface.brakeDeceleration * safeDt);
  } else if (input.throttle > 0) {
    speed += input.throttle * surface.acceleration * safeDt;
  } else if (input.throttle < 0) {
    speed += input.throttle * surface.acceleration * 0.6 * safeDt;
  } else {
    speed = moveToward(speed, 0, surface.deceleration * safeDt);
  }

  speed = clamp(speed, -surface.maxReverseSpeed, surface.maxSpeed);

  return {
    x: clampToBeach(state.x + Math.sin(heading) * speed * safeDt),
    z: clampToCourse(state.z + Math.cos(heading) * speed * safeDt),
    heading,
    speed,
    steer,
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

function wrapAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  return angle - fullTurn * Math.floor((angle + Math.PI) / fullTurn);
}
