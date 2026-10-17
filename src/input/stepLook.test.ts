import { describe, expect, it } from "vitest";
import { stepLook, lookSource } from "./stepLook";

describe("stepLook", () => {
  it("uses the mouse as the default look source", () => {
    expect(lookSource(0, 0)).toBe("mouse");
  });

  it("switches the active look source when the right stick moves", () => {
    expect(lookSource(0.2, 0)).toBe("right-stick");
  });

  it("adds mouse and stick movement, and limits how far the view can pitch", () => {
    const looked = stepLook({ yaw: 0, pitch: 0.3 }, { yawDelta: 0.1, pitchDelta: 0.2 }, { x: 1, y: 1 }, 1);
    expect(looked.yaw).toBeGreaterThan(0.1);
    expect(looked.pitch).toBeLessThanOrEqual(0.32);
  });
});
