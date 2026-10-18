import { emptyGamepadReading, readGamepadSnapshot, type GamepadReading } from "./readGamepad";
import type { GamepadSnapshot } from "./types";

/**
 * Prefers a pad that publishes the standard layout.
 * A leftover or virtual device in the first slot can report a restless stick and turn the camera.
 */
export function selectActiveGamepad(connected: readonly GamepadSnapshot[]): GamepadSnapshot | undefined {
  return connected.find((pad) => pad.mapping === "standard") ?? connected[0];
}

/** Reads connected controllers from the browser. Call this once per frame. */
export function pollGamepads(deadZone: number, lookDeadZone = deadZone): GamepadReading {
  const gamepads = navigator.getGamepads?.() ?? [];
  const connected: GamepadSnapshot[] = [];

  for (const gamepad of gamepads) {
    if (!gamepad?.connected) {
      continue;
    }
    connected.push({
      id: gamepad.id,
      index: gamepad.index,
      mapping: gamepad.mapping,
      axes: Array.from(gamepad.axes),
      buttons: Array.from(gamepad.buttons, (button) => ({
        pressed: button.pressed,
        value: button.value,
      })),
    });
  }

  const active = selectActiveGamepad(connected);
  if (!active) {
    return emptyGamepadReading;
  }

  return readGamepadSnapshot(active, deadZone, connected.length, lookDeadZone);
}
