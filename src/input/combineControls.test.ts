import { describe, expect, it } from "vitest";
import { combineMovement } from "./combineControls";
import { emptyGamepadReading, type GamepadReading } from "./readGamepad";

const idleKeys = { throttle: 0, steer: 0, brake: false };
const forwardKeys = { throttle: 1, steer: 0, brake: false };

function connected(overrides: Partial<GamepadReading>): GamepadReading {
  return {
    ...emptyGamepadReading,
    connected: true,
    padCount: 1,
    id: "Pad",
    mapping: "standard",
    usesStandardMapping: true,
    ...overrides,
  };
}

describe("combineMovement", () => {
  it("keeps the keyboard as the default while a connected stick is centered", () => {
    const intent = combineMovement(forwardKeys, connected({}));
    expect(intent).toMatchObject({ throttle: 1, source: "keyboard" });
  });

  it("lets the left stick take over once it leaves the dead zone", () => {
    const intent = combineMovement(forwardKeys, connected({ steer: -0.5 }));
    expect(intent).toMatchObject({ throttle: 0, steer: -0.5, source: "gamepad" });
  });

  it("uses keyboard input when no pad is connected", () => {
    expect(combineMovement(idleKeys, emptyGamepadReading).source).toBe("keyboard");
  });
});
