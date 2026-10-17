import { applyDeadZone } from "./deadZone";
import { mappingForGamepad } from "./gamepadMapping";
import type { GamepadSnapshot } from "./types";

export interface PressedButton {
  index: number;
  value: number;
}

/** What one controller is asking the turtle and camera to do. */
export interface GamepadReading {
  connected: boolean;
  padCount: number;
  id: string;
  mapping: string;
  usesStandardMapping: boolean;
  throttle: number;
  steer: number;
  lookX: number;
  lookY: number;
  brake: boolean;
  pressedButtons: PressedButton[];
  axes: number[];
}

export const emptyGamepadReading: GamepadReading = {
  connected: false,
  padCount: 0,
  id: "",
  mapping: "",
  usesStandardMapping: false,
  throttle: 0,
  steer: 0,
  lookX: 0,
  lookY: 0,
  brake: false,
  pressedButtons: [],
  axes: [],
};

export function readGamepadSnapshot(snapshot: GamepadSnapshot, deadZone: number, padCount = 1): GamepadReading {
  const stickMapping = mappingForGamepad(snapshot.mapping);
  const brakeButton = stickMapping.brakeButton;
  const brake = brakeButton !== null && snapshot.buttons[brakeButton]?.pressed === true;

  return {
    connected: true,
    padCount,
    id: snapshot.id,
    mapping: snapshot.mapping,
    usesStandardMapping: snapshot.mapping === "standard",
    throttle: readAxis(snapshot.axes, stickMapping.throttleAxis, stickMapping.invertThrottle, deadZone),
    steer: readAxis(snapshot.axes, stickMapping.steerAxis, false, deadZone),
    lookX: readAxis(snapshot.axes, stickMapping.lookXAxis, stickMapping.invertLookX, deadZone),
    lookY: readAxis(snapshot.axes, stickMapping.lookYAxis, stickMapping.invertLookY, deadZone),
    brake,
    pressedButtons: snapshot.buttons
      .map((button, index) => ({ index, value: button.value, pressed: button.pressed }))
      .filter((button) => button.pressed || button.value > 0.15)
      .map((button) => ({ index: button.index, value: button.value })),
    axes: [...snapshot.axes],
  };
}

function readAxis(axes: readonly number[], index: number, invert: boolean, deadZone: number): number {
  const raw = axes[index] ?? 0;
  const shaped = applyDeadZone(raw, deadZone);
  if (shaped === 0) {
    return 0;
  }
  return invert ? -shaped : shaped;
}
