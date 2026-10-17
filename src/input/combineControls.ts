import type { KeyboardIntent } from "./keyboard";
import type { GamepadReading } from "./readGamepad";
import type { MovementIntent } from "./types";

/**
 * Keyboard is the default. A connected pad takes over only while its stick
 * is outside the dead zone or its mapped brake button is held.
 */
export function combineMovement(keyboard: KeyboardIntent, gamepad: GamepadReading): MovementIntent {
  const gamepadDriving = gamepad.connected && (gamepad.throttle !== 0 || gamepad.steer !== 0 || gamepad.brake);
  if (gamepadDriving) {
    return {
      throttle: gamepad.throttle,
      steer: gamepad.steer,
      brake: gamepad.brake,
      source: "gamepad",
    };
  }

  return {
    throttle: keyboard.throttle,
    steer: keyboard.steer,
    brake: keyboard.brake,
    source: "keyboard",
  };
}
