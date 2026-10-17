import { emptyGamepadReading, readGamepadSnapshot, type GamepadReading } from "./readGamepad";
import type { GamepadSnapshot } from "./types";

/** Reads connected controllers from the browser. Call this once per frame. */
export function pollGamepads(deadZone: number): GamepadReading {
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

  const active = connected[0];
  if (!active) {
    return emptyGamepadReading;
  }

  return readGamepadSnapshot(active, deadZone, connected.length);
}
