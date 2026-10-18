import { describe, expect, it } from "vitest";
import { controlSettings } from "./controlSettings";
import { stepLook, lookSource } from "./stepLook";

describe("stepLook", () => {
  it("uses the mouse as the default look source", () => {
    expect(lookSource(0, 0)).toBe("mouse");
  });

  it("switches the active look source when the right stick moves", () => {
    expect(lookSource(0.2, 0)).toBe("right-stick");
  });

  it("adds mouse and stick movement, and lets the view pitch up and down", () => {
    const looked = stepLook({ yaw: 0, pitch: 0.3 }, { yawDelta: 0.1, pitchDelta: 0.2 }, { x: 1, y: 1 }, 1);
    expect(looked.yaw).toBeGreaterThan(0.1);
    expect(looked.pitch).toBeGreaterThan(0.5);

    let pitch = { yaw: 0, pitch: 0 };
    const still = { yawDelta: 0, pitchDelta: 0 };
    for (let step = 0; step < 90; step += 1) {
      pitch = stepLook(pitch, still, { x: 0, y: 1 }, 1 / 60);
    }
    expect(pitch.pitch).toBeGreaterThan(1.2);
    expect(pitch.pitch).toBeLessThanOrEqual(controlSettings.lookPitchLimit);

    for (let step = 0; step < 180; step += 1) {
      pitch = stepLook(pitch, still, { x: 0, y: -1 }, 1 / 60);
    }
    expect(pitch.pitch).toBeLessThan(-1.2);
    expect(pitch.pitch).toBeGreaterThanOrEqual(-controlSettings.lookPitchLimit);
  });

  it("turns only when the right stick moves", () => {
    const still = stepLook({ yaw: 0, pitch: 0 }, { yawDelta: 0, pitchDelta: 0 }, { x: 0, y: 0 }, 0.05);
    const looked = stepLook({ yaw: 0, pitch: 0 }, { yawDelta: 0, pitchDelta: 0 }, { x: -1, y: 0 }, 0.05);
    expect(still.yaw).toBe(0);
    expect(looked.yaw).toBeLessThan(-0.05);
  });

  it("does not accumulate camera drift from a tiny leftover stick value", () => {
    let look = { yaw: 0, pitch: 0 };
    const still = { yawDelta: 0, pitchDelta: 0 };
    for (let step = 0; step < 300; step += 1) {
      look = stepLook(look, still, { x: 0.02, y: -0.03 }, 1 / 60);
    }
    expect(look.yaw).toBe(0);
    expect(look.pitch).toBe(0);

    const nudged = stepLook({ yaw: 0, pitch: 0 }, still, { x: 0.2, y: 0 }, 0.05);
    expect(nudged.yaw).toBeGreaterThan(0.01);
  });
});
