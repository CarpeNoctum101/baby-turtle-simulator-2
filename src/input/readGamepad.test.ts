import { describe, expect, it } from "vitest";
import { readGamepadSnapshot } from "./readGamepad";
import type { ButtonSnapshot, GamepadSnapshot } from "./types";

function buttons(pressedIndexes: number[]): ButtonSnapshot[] {
  return Array.from({ length: 16 }, (_, index) => ({
    pressed: pressedIndexes.includes(index),
    value: pressedIndexes.includes(index) ? 1 : 0,
  }));
}

function snapshot(overrides: Partial<GamepadSnapshot>): GamepadSnapshot {
  return {
    id: "Test Pad",
    index: 0,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: buttons([]),
    ...overrides,
  };
}

describe("readGamepadSnapshot", () => {
  it("treats stick up as forward on a standard mapping", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0, -1, 0, 0] }), 0.18);
    expect(reading.throttle).toBe(1);
    expect(reading.steer).toBe(0);
    expect(reading.usesStandardMapping).toBe(true);
  });

  it("uses button 1 as brake only for the standard layout", () => {
    const xbox = readGamepadSnapshot(snapshot({ id: "Xbox Controller", buttons: buttons([1]) }), 0.18);
    const sameButtonsDifferentId = readGamepadSnapshot(
      snapshot({ id: "Another Xbox-looking device", buttons: buttons([1]) }),
      0.18,
    );
    expect(xbox.brake).toBe(true);
    expect(sameButtonsDifferentId.brake).toBe(true);
  });

  it("does not treat button 1 as brake when the mapping is not standard", () => {
    const reading = readGamepadSnapshot(
      snapshot({
        id: "Xbox 360 Controller",
        mapping: "",
        axes: [0.9, 0, 0, 0],
        buttons: buttons([1]),
      }),
      0.18,
    );
    expect(reading.brake).toBe(false);
    expect(reading.usesStandardMapping).toBe(false);
    expect(reading.steer).toBeGreaterThan(0.7);
    expect(reading.pressedButtons.map((button) => button.index)).toEqual([1]);
  });

  it("does not treat the A button as brake on a standard pad", () => {
    const reading = readGamepadSnapshot(snapshot({ buttons: buttons([0]) }), 0.18);
    expect(reading.brake).toBe(false);
    expect(reading.pressedButtons[0]?.index).toBe(0);
  });

  it("returns zero when a controller has fewer axes than expected", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0.2] }), 0.18);
    expect(reading.throttle).toBe(0);
    expect(reading.lookX).toBe(0);
    expect(reading.lookY).toBe(0);
  });

  it("yaws right when the look stick is pushed right", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0, 0, 1, 0] }), 0.18);
    expect(reading.lookX).toBe(-1);
  });

  it("still looks up when the right stick matches the left stick", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0, -1, 0, -1] }), 0.18);
    expect(reading.throttle).toBe(1);
    expect(reading.lookY).toBe(1);
  });

  it("still looks down while the left stick is held forward", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0, -1, 0, 1] }), 0.18);
    expect(reading.throttle).toBe(1);
    expect(reading.lookY).toBe(-1);
  });

  it("still looks right while the left stick is held forward", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0, -1, 1, 0] }), 0.18);
    expect(reading.throttle).toBe(1);
    expect(reading.lookX).toBe(-1);
  });

  it("drops a drifted left stick inside the dead zone", () => {
    const reading = readGamepadSnapshot(snapshot({ axes: [0.12, -0.1, 0, 0] }), 0.18);
    expect(reading.steer).toBe(0);
    expect(reading.throttle).toBe(0);
  });
});
