import { describe, expect, it } from "vitest";
import { stepLook } from "../input/stepLook";
import { course, isInFinishZone, isInWaveZone, surfaceAt } from "./course";
import { surfaces } from "./surfaces";
import { createTurtleMotion, planFromYaw, stepTurtle, type TurtleMotion } from "./stepTurtle";

const frame = 1 / 60;
const coast = { throttle: 0, steer: 0, brake: false };
const drive = { throttle: 1, steer: 0, brake: false };

function simulate(
  state: TurtleMotion,
  input: { throttle: number; steer: number; brake: boolean },
  seconds: number,
  plan?: { forwardX: number; forwardZ: number },
): TurtleMotion {
  let current = state;
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    current = stepTurtle(current, input, frame, plan);
  }
  return current;
}

describe("course surfaces", () => {
  it("starts on dry sand, then wet sand, then shallow water", () => {
    expect(surfaceAt(course.nest.z).id).toBe("dry-sand");
    expect(surfaceAt((course.wet.minZ + course.wet.maxZ) / 2).id).toBe("wet-sand");
    expect(surfaceAt((course.water.minZ + course.water.maxZ) / 2).id).toBe("shallow-water");
  });

  it("counts the pale gate as the finish and ignores the beach beside it", () => {
    const gate = (course.finish.minZ + course.finish.maxZ) / 2;
    expect(isInFinishZone(0, gate)).toBe(true);
    expect(isInFinishZone(0, course.nest.z)).toBe(false);
    expect(isInFinishZone(course.halfWidth + 1, gate)).toBe(false);
  });

  it("keeps the wave zone on the shoreline and off the nest", () => {
    expect(isInWaveZone(0, course.water.minZ)).toBe(true);
    expect(isInWaveZone(0, course.nest.z)).toBe(false);
    expect(isInWaveZone(course.halfWidth + 1, course.water.minZ)).toBe(false);
  });
});

describe("stepTurtle", () => {
  it("builds speed gradually and crawls toward the ocean", () => {
    const started = createTurtleMotion();
    const moved = simulate(started, drive, 1);
    expect(moved.speed).toBeGreaterThan(1.5);
    expect(moved.speed).toBeLessThan(surfaces["dry-sand"].maxSpeed);
    expect(moved.z).toBeGreaterThan(started.z);
  });

  it("reaches a higher speed in shallow water than on dry sand", () => {
    const dry = simulate(createTurtleMotion(), drive, 3);
    const waterStart = { ...createTurtleMotion(), z: course.water.minZ + 2 };
    const water = simulate(waterStart, drive, 3);
    expect(dry.speed).toBeLessThanOrEqual(surfaces["dry-sand"].maxSpeed + 0.001);
    expect(water.speed).toBeGreaterThan(dry.speed + 2);
  });

  it("glides briefly in water, then settles instead of sliding", () => {
    const dry = simulate({ ...createTurtleMotion(), speed: surfaces["dry-sand"].maxSpeed }, coast, 0.5);
    const water = simulate({ ...createTurtleMotion(), z: course.water.minZ + 2, speed: surfaces["shallow-water"].maxSpeed }, coast, 0.5);
    const settled = simulate({ ...createTurtleMotion(), z: course.water.minZ + 2, speed: surfaces["shallow-water"].maxSpeed }, coast, 1.6);
    expect(dry.speed).toBe(0);
    expect(water.speed).toBeGreaterThan(dry.speed);
    expect(water.speed).toBeLessThan(surfaces["shallow-water"].maxSpeed * 0.75);
    expect(settled.speed).toBeLessThan(0.5);
  });

  it("brakes harder than coasting", () => {
    const coasting = simulate({ ...createTurtleMotion(), speed: 3 }, coast, 0.3);
    const braking = simulate({ ...createTurtleMotion(), speed: 3 }, { ...coast, brake: true }, 0.3);
    expect(braking.speed).toBeLessThan(coasting.speed);
  });

  it("moves to the camera's right when the left stick is held right", () => {
    const started = createTurtleMotion();
    const moved = simulate(started, { throttle: 0, steer: 1, brake: false }, 0.6);
    expect(moved.x).toBeGreaterThan(started.x + 0.2);
    expect(moved.z).toBeCloseTo(started.z, 1);
    expect(moved.heading).toBeCloseTo(Math.PI / 2, 5);
  });

  it("keeps the camera still while the left stick moves, then follows a right-stick turn", () => {
    let look = { yaw: 0, pitch: 0 };
    let motion = createTurtleMotion();
    const noMouse = { yawDelta: 0, pitchDelta: 0 };
    for (let step = 0; step < 30; step += 1) {
      look = stepLook(look, noMouse, { x: 0, y: 0 }, frame);
      motion = stepTurtle(motion, { throttle: 1, steer: 1, brake: false }, frame, planFromYaw(look.yaw));
    }
    expect(look.yaw).toBe(0);
    expect(motion.x).toBeGreaterThan(0.15);
    expect(motion.z).toBeGreaterThan(-24);

    for (let step = 0; step < 40; step += 1) {
      look = stepLook(look, noMouse, { x: -1, y: 0 }, frame);
    }
    const turned = motion;
    expect(look.yaw).toBeLessThan(-0.8);
    for (let step = 0; step < 40; step += 1) {
      look = stepLook(look, noMouse, { x: 0, y: 0 }, frame);
      motion = stepTurtle(motion, drive, frame, planFromYaw(look.yaw));
    }
    expect(motion.x).toBeGreaterThan(turned.x + 0.2);
  });

  it("treats stick up as forward for whichever way the camera looks", () => {
    const started = createTurtleMotion();
    const moved = simulate(started, drive, 0.6, { forwardX: 1, forwardZ: 0 });
    expect(moved.x).toBeGreaterThan(started.x + 0.2);
    expect(moved.z).toBeCloseTo(started.z, 1);
    expect(moved.heading).toBeCloseTo(Math.PI / 2, 5);
  });

  it("points stick up down the beach at yaw zero, and to +X when looking right", () => {
    expect(planFromYaw(0)).toEqual({ forwardX: 0, forwardZ: 1 });
    const lookingRight = planFromYaw(-Math.PI / 2);
    expect(lookingRight.forwardX).toBeCloseTo(1);
    expect(lookingRight.forwardZ).toBeCloseTo(0);
  });

  it("does not leap forward when a frame is very long", () => {
    const moved = stepTurtle(createTurtleMotion(), drive, 5);
    expect(moved.speed).toBeLessThan(0.2);
  });

  it("gives back the extra speed on the frame the boost ends", () => {
    const boosted = stepTurtle(
      { ...createTurtleMotion(), speed: surfaces["dry-sand"].maxSpeed },
      drive,
      frame,
      undefined,
      { maxSpeedMultiplier: 1.65, accelerationMultiplier: 1.4 },
    );
    const expired = stepTurtle(boosted, drive, frame);
    expect(boosted.speed).toBeGreaterThan(surfaces["dry-sand"].maxSpeed);
    expect(expired.speed).toBeLessThanOrEqual(surfaces["dry-sand"].maxSpeed + 0.001);
  });

  it("stops at the far side of the water instead of leaving the course", () => {
    const end = simulate({ ...createTurtleMotion(), z: course.water.maxZ - 0.1, speed: 8 }, drive, 1);
    expect(end.z).toBeLessThanOrEqual(course.water.maxZ);
  });
});
