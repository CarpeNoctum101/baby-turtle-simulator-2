import { describeButton } from "../input/gamepadMapping";
import type { GamepadReading } from "../input/readGamepad";

export interface HudModel {
  finished: boolean;
  surfaceLabel: string;
  speed: number;
  x: number;
  z: number;
  movementSource: "keyboard" | "gamepad";
  lookSource: "mouse" | "right-stick";
  pointerLocked: boolean;
  deadZone: number;
  gamepad: GamepadReading;
}

/** Builds the on-screen text. Gamepad names are inserted as plain text by the caller. */
export function formatHud(model: HudModel): string {
  const lines = [
    model.finished
      ? "Finished. The turtle reached the sea. Press R to run it again."
      : "Drive from the nest, across the beach, to the pale gate in the water.",
    `Surface: ${model.surfaceLabel}`,
    `Speed: ${model.speed.toFixed(2)}    Position: x ${model.x.toFixed(1)}, z ${model.z.toFixed(1)}`,
    `Active movement: ${model.movementSource === "keyboard" ? "Keyboard (WASD)" : "Gamepad left stick"}`,
    `Active look: ${model.lookSource === "mouse" ? "Mouse" : "Gamepad right stick"}`,
    model.pointerLocked
      ? "Mouse captured. Press Esc to release the cursor."
      : "Click the scene to capture the mouse. Dragging also looks around.",
    "WASD moves and steers. Arrow keys do the same. Space brakes. R resets. H hides this readout.",
    `[ and ] change the stick dead zone. Current dead zone: ${model.deadZone.toFixed(2)}`,
    formatGamepad(model.gamepad),
  ];
  return lines.join("\n");
}

function formatGamepad(gamepad: GamepadReading): string {
  if (!gamepad.connected) {
    return "Controller: not detected. Plug one in, then press any button. Browsers hide a pad until a button is pressed.";
  }

  const mappingLine = gamepad.usesStandardMapping
    ? "Mapping: standard. Left stick moves, right stick looks, and B brakes. Other buttons are displayed and do not trigger actions."
    : "Mapping: not standard. Axes 0 and 1 are used as a left stick. Buttons are not assigned, because this controller did not report the usual layout.";
  const axes = gamepad.axes.length > 0 ? gamepad.axes.slice(0, 8).map((value) => value.toFixed(2)).join(", ") : "none";
  const buttons =
    gamepad.pressedButtons.length > 0
      ? gamepad.pressedButtons
          .map((button) => `${describeButton(button.index, gamepad.mapping)} value ${button.value.toFixed(2)}`)
          .join(", ")
      : "none";

  return [
    `Controller: connected (${gamepad.padCount})`,
    `Name: ${gamepad.id}`,
    mappingLine,
    `Detected axes: ${axes}`,
    `Detected buttons: ${buttons}`,
    `Stick output: steer ${gamepad.steer.toFixed(2)}, throttle ${gamepad.throttle.toFixed(2)}, look ${gamepad.lookX.toFixed(2)}, ${gamepad.lookY.toFixed(2)}`,
  ].join("\n");
}
