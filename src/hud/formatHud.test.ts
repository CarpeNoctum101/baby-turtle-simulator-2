import { describe, expect, it } from "vitest";
import { emptyGamepadReading } from "../input/readGamepad";
import { formatHud } from "./formatHud";

const base = {
  phase: "ready" as const,
  elapsed: 0,
  finishTime: null,
  surfaceLabel: "Dry sand",
  speed: 0,
  x: 0,
  z: -24,
  movementSource: "keyboard" as const,
  lookSource: "mouse" as const,
  pointerLocked: false,
  deadZone: 0.18,
  gamepad: emptyGamepadReading,
  place: 1,
  field: 1,
  abilityLine: "No ability. Collect a Tide Orb",
};

describe("formatHud", () => {
  it("names keyboard and mouse as the active controls by default", () => {
    const text = formatHud(base);
    expect(text).toContain("Ready at the nest");
    expect(text).toContain("Active movement: Keyboard (WASD)");
    expect(text).toContain("Active look: Mouse");
    expect(text).toContain("Controller: not detected");
  });

  it("explains that a non-standard pad does not get button actions", () => {
    const text = formatHud({
      ...base,
      gamepad: {
        ...emptyGamepadReading,
        connected: true,
        padCount: 1,
        id: "Mystery Pad",
        mapping: "",
        axes: [0.4, 0.2],
        pressedButtons: [{ index: 1, value: 1 }],
      },
    });
    expect(text).toContain("Mapping: not standard");
    expect(text).toContain("button 1");
    expect(text).not.toContain("B brakes");
  });

  it("names the B button only for a standard mapping", () => {
    const text = formatHud({
      ...base,
      movementSource: "gamepad",
      gamepad: {
        ...emptyGamepadReading,
        connected: true,
        padCount: 1,
        id: "Xbox Controller (STANDARD GAMEPAD)",
        mapping: "standard",
        usesStandardMapping: true,
        pressedButtons: [{ index: 1, value: 1 }],
        axes: [0, -1, 0, 0],
      },
    });
    expect(text).toContain("B brakes");
    expect(text).toContain("RT uses the held ability");
    expect(text).toContain("B (1)");
    expect(text).toContain("Active movement: Gamepad left stick");
  });
});
