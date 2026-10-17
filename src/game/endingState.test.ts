import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import { createEndingState, endingPlan, sampleEnding, stepEnding } from "./endingState";

describe("automatic Starship ending", () => {
  it.each([-7.3, 0, 7.3])("walks from finish x=%s to the hatch and reaches space without input", x => {
    let state = createEndingState({ ...createTurtleMotion(), x, z: 36.1, heading: 1.2 });
    const phases = new Set<string>();
    let lastAltitude = 0;
    for (let i = 0; i < 40 * 60; i++) {
      const frame = sampleEnding(state);
      phases.add(frame.phase);
      expect(Number.isFinite(frame.turtle.x + frame.turtle.y + frame.turtle.z + frame.heading)).toBe(true);
      expect(frame.altitude).toBeGreaterThanOrEqual(lastAltitude);
      if (frame.phase === "boarding") {
        expect(frame.turtle.x).toBe(0);
        expect(frame.turtle.y).toBe(endingPlan.hatch.y);
        expect(frame.turtle.z).toBeGreaterThanOrEqual(endingPlan.hatch.z);
      }
      if (frame.phase === "launch" || frame.phase === "space") expect(frame.boarded).toBe(true);
      lastAltitude = frame.altitude;
      state = stepEnding(state, 1 / 60);
    }
    expect([...phases]).toEqual(["rising", "walking", "boarding", "countdown", "launch", "space"]);
    expect(sampleEnding(state).altitude).toBe(endingPlan.orbitAltitude);
  });

  it("waits at the finish until the submerged pad and bridge have risen completely", () => {
    const state = createEndingState({ ...createTurtleMotion(), x: 7.3, z: 36.1, heading: 0.3 });
    let previousOffset = -endingPlan.submergedDepth;
    for (let elapsed = 0; elapsed < endingPlan.riseSeconds; elapsed += 1 / 60) {
      const frame = sampleEnding({ ...state, elapsed });
      expect(frame.phase).toBe("rising");
      expect(frame.turtle).toEqual(state.start);
      expect(frame.heading).toBe(state.startHeading);
      expect(frame.speed).toBe(0);
      expect(frame.boarded).toBe(false);
      expect(frame.walkProgress).toBe(0);
      expect(frame.platformOffset).toBeGreaterThanOrEqual(previousOffset);
      expect(frame.platformOffset - previousOffset).toBeLessThan(0.1);
      expect(frame.platformOffset).toBeLessThanOrEqual(0);
      previousOffset = frame.platformOffset;
    }
    const ready = sampleEnding({ ...state, elapsed: endingPlan.riseSeconds });
    expect(ready.phase).toBe("walking");
    expect(ready.platformOffset).toBe(0);
    expect(ready.riseProgress).toBe(1);
    expect(ready.turtle).toEqual(state.start);
    expect(ready.speed).toBe(endingPlan.walkingSpeed);
    expect(sampleEnding(state).platformOffset).toBe(-endingPlan.submergedDepth);
  });

  it("is repeatable on restart and guards against invalid or very large frame times", () => {
    const motion = { ...createTurtleMotion(), x: 3, z: 36.2 };
    const initial = createEndingState(motion);
    expect(stepEnding(initial, -1)).toEqual(initial);
    expect(stepEnding(initial, NaN)).toEqual(initial);
    expect(stepEnding(initial, 60).elapsed).toBe(0.1);
    expect(initial.elapsed).toBe(0);
    expect(createEndingState(motion)).toEqual(initial);
  });

  it("has a continuous ramp and liftoff transition", () => {
    const state = createEndingState({ ...createTurtleMotion(), z: 36 });
    let previous = sampleEnding(state);
    for (let elapsed = 1 / 60; elapsed < 35; elapsed += 1 / 60) {
      const frame = sampleEnding({ ...state, elapsed });
      if (!frame.boarded) expect(Math.hypot(frame.turtle.x - previous.turtle.x,
        frame.turtle.y - previous.turtle.y, frame.turtle.z - previous.turtle.z)).toBeLessThan(0.05);
      expect(Math.abs(frame.altitude - previous.altitude)).toBeLessThan(1.3);
      previous = frame;
    }
  });
});
