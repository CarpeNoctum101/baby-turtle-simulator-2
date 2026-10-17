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
  const move = shapeStick(
    axis(snapshot.axes, stickMapping.steerAxis),
    axis(snapshot.axes, stickMapping.throttleAxis),
    deadZone,
    false,
    stickMapping.invertThrottle,
  );
  const look = shapeStick(
    axis(snapshot.axes, stickMapping.lookXAxis),
    axis(snapshot.axes, stickMapping.lookYAxis),
    deadZone,
    stickMapping.invertLookX,
    stickMapping.invertLookY,
  );

  return {
    connected: true,
    padCount,
    id: snapshot.id,
    mapping: snapshot.mapping,
    usesStandardMapping: snapshot.mapping === "standard",
    throttle: move.y,
    steer: move.x,
    lookX: look.x,
    lookY: look.y,
    brake,
    pressedButtons: snapshot.buttons
      .map((button, index) => ({ index, value: button.value, pressed: button.pressed }))
      .filter((button) => button.pressed || button.value > 0.15)
      .map((button) => ({ index: button.index, value: button.value })),
    axes: [...snapshot.axes],
  };
}

function axis(axes: readonly number[], index: number): number {
  const raw = axes[index] ?? 0;
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Reads one stick as a single direction.
 * The dead zone is circular, so a diagonal push is not thrown away one axis at a time.
 */
function shapeStick(
  x: number,
  y: number,
  deadZone: number,
  invertX: boolean,
  invertY: boolean,
): { x: number; y: number } {
  const zone = Math.min(0.95, Math.max(0, Number.isFinite(deadZone) ? deadZone : 0));
  const rawX = Math.min(1, Math.max(-1, Number.isFinite(x) ? x : 0));
  const rawY = Math.min(1, Math.max(-1, Number.isFinite(y) ? y : 0));
  const magnitude = Math.hypot(rawX, rawY);
  if (magnitude === 0 || magnitude <= zone) {
    return { x: 0, y: 0 };
  }
  const scaled = (Math.min(1, magnitude) - zone) / (1 - zone) / magnitude;
  const shapedX = rawX * Math.min(1, scaled);
  const shapedY = rawY * Math.min(1, scaled);
  const nextX = (invertX ? -shapedX : shapedX) || 0;
  const nextY = (invertY ? -shapedY : shapedY) || 0;
  return { x: nextX, y: nextY };
}
