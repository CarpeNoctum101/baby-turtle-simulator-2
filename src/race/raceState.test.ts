import { describe, expect, it } from "vitest";
import { course, playerStart, startingGrid } from "../movement/course";
import { createRaceState, formatRaceTime, startCountdown, stepRace } from "./raceState";

const frame = 1 / 60;

function advance(state: ReturnType<typeof createRaceState>, seconds: number, reachedFinish = false) {
  let current = state;
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    current = stepRace(current, frame, reachedFinish);
  }
  return current;
}

describe("race flow", () => {
  it("puts the player on the center pad, with the other pads beside the nest", () => {
    expect(playerStart).toEqual({ id: "center", x: 0, z: course.nest.z });
    expect(startingGrid.map((spot) => spot.x)).toEqual([-3.2, 0, 3.2]);
    for (const spot of startingGrid) {
      expect(Math.abs(spot.x)).toBeLessThan(course.halfWidth);
      expect(spot.z).toBe(course.nest.z);
    }
  });

  it("counts down for about three seconds, then lets the turtle race", () => {
    const early = advance(startCountdown(), 2.9);
    const started = advance(startCountdown(), 3.05);
    expect(early.phase).toBe("countdown");
    expect(early.countdown).toBeGreaterThan(0);
    expect(started.phase).toBe("racing");
    expect(started.elapsed).toBeGreaterThanOrEqual(0);
    expect(started.elapsed).toBeLessThan(0.2);
  });

  it("does not skip the whole countdown when a frame is very long", () => {
    const raced = stepRace(startCountdown(), 5, false);
    expect(raced.phase).toBe("countdown");
    expect(raced.countdown).toBeGreaterThan(2);
  });

  it("records the finish time once", () => {
    let racing = advance(startCountdown(), 3.2);
    expect(racing.phase).toBe("racing");
    racing = { ...racing, elapsed: 10 };
    const finished = stepRace(racing, frame, true);
    const later = stepRace(finished, frame, true);
    expect(finished.phase).toBe("finished");
    expect(finished.finishTime).toBeGreaterThan(10);
    expect(later.finishTime).toBe(finished.finishTime);
    expect(later.phase).toBe("finished");
  });

  it("ignores the finish line before the countdown ends", () => {
    const waiting = stepRace(startCountdown(), frame, true);
    expect(waiting.phase).toBe("countdown");
    expect(waiting.finishTime).toBeNull();
  });

  it("can be raced again from the start", () => {
    const first = stepRace({ ...advance(startCountdown(), 3.2), elapsed: 8 }, frame, true);
    const again = advance(startCountdown(first), 3.2);
    const second = stepRace(again, frame, true);
    expect(first.finishTime).toBeGreaterThan(8);
    expect(again.phase).toBe("racing");
    expect(again.finishTime).toBeNull();
    expect(second.phase).toBe("finished");
    expect(second.finishTime).toBeLessThan(1);
  });

  it("formats the timer with minutes and tenths", () => {
    expect(formatRaceTime(0)).toBe("0:00.0");
    expect(formatRaceTime(12.34)).toBe("0:12.3");
    expect(formatRaceTime(75.2)).toBe("1:15.2");
  });
});
