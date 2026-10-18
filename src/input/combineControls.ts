import type { KeyboardIntent } from "./keyboard";
import { emptyGamepadReading, type GamepadReading } from "./readGamepad";
import type { MovementIntent } from "./types";

/** Which devices this browser window is allowed to obey. */
export type InputChoice = "both" | "keyboard" | "gamepad";

const idleKeyboard: KeyboardIntent = { throttle: 0, steer: 0, brake: false };

export function parseInputChoice(value: string | null): InputChoice {
  if (value === "keyboard" || value === "gamepad") {
    return value;
  }
  return "both";
}

/**
 * Drops the device this window is not using.
 * Two windows on one computer can then split the keyboard and the controller.
 */
export function limitInput(
  choice: InputChoice,
  keyboard: KeyboardIntent,
  gamepad: GamepadReading,
): { keyboard: KeyboardIntent; gamepad: GamepadReading; listenToMouse: boolean } {
  if (choice === "keyboard") {
    return { keyboard, gamepad: emptyGamepadReading, listenToMouse: true };
  }
  if (choice === "gamepad") {
    return { keyboard: idleKeyboard, gamepad, listenToMouse: false };
  }
  return { keyboard, gamepad, listenToMouse: true };
}

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
