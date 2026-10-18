import { describe, expect, it } from "vitest";
import { combineMovement, limitInput } from "./combineControls";
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

describe("limitInput", () => {
  it("ignores the controller when this window is keyboard only", () => {
    const limited = limitInput("keyboard", forwardKeys, connected({ steer: -0.5, lookX: 1, ability: true, brake: true }));
    expect(combineMovement(limited.keyboard, limited.gamepad)).toMatchObject({ throttle: 1, source: "keyboard" });
    expect(limited.gamepad.lookX).toBe(0);
    expect(limited.gamepad.ability).toBe(false);
    expect(limited.listenToMouse).toBe(true);
  });

  it("ignores the keyboard when this window is controller only", () => {
    const limited = limitInput("gamepad", forwardKeys, connected({ throttle: 0.4, lookX: 0.2 }));
    expect(combineMovement(limited.keyboard, limited.gamepad)).toMatchObject({ throttle: 0.4, source: "gamepad" });
    expect(limited.keyboard).toEqual(idleKeys);
    expect(limited.listenToMouse).toBe(false);
  });

  it("keeps both devices when the window has not chosen one", () => {
    const pad = connected({ steer: 0.3 });
    const limited = limitInput("both", forwardKeys, pad);
    expect(limited.keyboard).toBe(forwardKeys);
    expect(limited.gamepad).toBe(pad);
    expect(limited.listenToMouse).toBe(true);
  });
});
