import { describe, expect, it } from "vitest";
import { readKeyboard } from "./keyboard";

describe("readKeyboard", () => {
  it("maps WASD to throttle and steer", () => {
    expect(readKeyboard(new Set(["KeyW", "KeyA"]))).toEqual({ throttle: 1, steer: -1, brake: false });
    expect(readKeyboard(new Set(["KeyS", "KeyD"]))).toEqual({ throttle: -1, steer: 1, brake: false });
  });

  it("lets arrow keys stand in for WASD", () => {
    expect(readKeyboard(new Set(["ArrowUp", "ArrowLeft"]))).toEqual({ throttle: 1, steer: -1, brake: false });
  });

  it("cancels opposite keys", () => {
    expect(readKeyboard(new Set(["KeyW", "KeyS"])).throttle).toBe(0);
    expect(readKeyboard(new Set(["KeyA", "KeyD"])).steer).toBe(0);
  });

  it("uses Space as the brake", () => {
    expect(readKeyboard(new Set(["Space"])).brake).toBe(true);
  });
});
