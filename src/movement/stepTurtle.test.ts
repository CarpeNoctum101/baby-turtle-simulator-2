import { describe, expect, it } from "vitest";
import { course, isInFinishZone, surfaceAt } from "./course";
import { surfaces } from "./surfaces";
import { createTurtleMotion, stepTurtle, type TurtleMotion } from "./stepTurtle";

const frame = 1 / 60;
const coast = { throttle: 0, steer: 0, brake: false };
const drive = { throttle: 1, steer: 0, brake: false };

function simulate(state: TurtleMotion, input: { throttle: number; steer: number; brake: boolean }, seconds: number): TurtleMotion {
  let current = state;
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    current = stepTurtle(current, input, frame);
  }
  return current;
}

describe("course surfaces", () => {
  it("starts on dry sand, then wet sand, then shallow water", () => {
    expect(surfaceAt(course.nest.z).id).toBe("dry-sand");
    expect(surfaceAt(0).id).toBe("wet-sand");
    expect(surfaceAt(20).id).toBe("shallow-water");
  });

  it("counts the pale gate as the finish and ignores the beach beside it", () => {
    expect(isInFinishZone(0, 40)).toBe(true);
    expect(isInFinishZone(0, 10)).toBe(false);
    expect(isInFinishZone(20, 40)).toBe(false);
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
    const waterStart = { ...createTurtleMotion(), z: 20 };
    const water = simulate(waterStart, drive, 3);
    expect(dry.speed).toBeLessThanOrEqual(surfaces["dry-sand"].maxSpeed + 0.001);
    expect(water.speed).toBeGreaterThan(dry.speed + 2);
  });

  it("coasts farther in water than on dry sand", () => {
    const dry = simulate({ ...createTurtleMotion(), speed: 3 }, coast, 0.5);
    const water = simulate({ ...createTurtleMotion(), z: 20, speed: 3 }, coast, 0.5);
    expect(water.speed).toBeGreaterThan(dry.speed + 1);
  });

  it("brakes harder than coasting", () => {
    const coasting = simulate({ ...createTurtleMotion(), speed: 3 }, coast, 0.3);
    const braking = simulate({ ...createTurtleMotion(), speed: 3 }, { ...coast, brake: true }, 0.3);
    expect(braking.speed).toBeLessThan(coasting.speed);
  });

  it("lets the steer lag behind a sudden stick flick", () => {
    const flicked = stepTurtle(createTurtleMotion(), { throttle: 0, steer: 1, brake: false }, frame);
    expect(flicked.steer).toBeGreaterThan(0);
    expect(flicked.steer).toBeLessThan(0.3);
  });

  it("turns more slowly in water than on wet sand", () => {
    const wet = stepTurtle(
      { ...createTurtleMotion(), z: 0, speed: 4 },
      { throttle: 1, steer: 1, brake: false },
      frame,
    );
    const water = stepTurtle(
      { ...createTurtleMotion(), z: 20, speed: 4 },
      { throttle: 1, steer: 1, brake: false },
      frame,
    );
    expect(wet.steer).toBeGreaterThan(water.steer);
  });

  it("does not leap forward when a frame is very long", () => {
    const moved = stepTurtle(createTurtleMotion(), drive, 5);
    expect(moved.speed).toBeLessThan(0.2);
  });

  it("stops at the far side of the water instead of leaving the course", () => {
    const end = simulate({ ...createTurtleMotion(), z: course.water.maxZ - 0.1, speed: 8 }, drive, 1);
    expect(end.z).toBeLessThanOrEqual(course.water.maxZ);
  });
});
