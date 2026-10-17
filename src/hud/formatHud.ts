import { describeButton } from "../input/gamepadMapping";
import type { GamepadReading } from "../input/readGamepad";
import { formatPlace } from "./formatAbilityHud";
import { formatRaceTime, type RacePhase } from "../race/raceState";

export interface HudModel {
  phase: RacePhase;
  elapsed: number;
  finishTime: number | null;
  surfaceLabel: string;
  speed: number;
  x: number;
  z: number;
  movementSource: "keyboard" | "gamepad";
  lookSource: "mouse" | "right-stick";
  pointerLocked: boolean;
  deadZone: number;
  gamepad: GamepadReading;
  place: number;
  field: number;
  abilityLine: string;
}

/** Builds the on-screen text. Gamepad names are inserted as plain text by the caller. */
export function formatHud(model: HudModel): string {
  const lines = [
    raceHeadline(model),
    `Surface: ${model.surfaceLabel}`,
    `Speed: ${model.speed.toFixed(2)}    Position: x ${model.x.toFixed(1)}, z ${model.z.toFixed(1)}`,
    `Active movement: ${model.movementSource === "keyboard" ? "Keyboard (WASD)" : "Gamepad left stick"}`,
    `Active look: ${model.lookSource === "mouse" ? "Mouse" : "Gamepad right stick"}`,
    "Hold the right mouse button and drag to look. The view stays still while you only hold W or stick up.",
    "W or the left stick moves the way the camera looks. A, D, or the left stick move sideways. Only the right stick turns the camera. Space brakes. X uses the held ability. R restarts. H hides this readout.",
    `Ability: ${model.abilityLine}`,
    `[ and ] change the stick dead zone. Current dead zone: ${model.deadZone.toFixed(2)}`,
    formatGamepad(model.gamepad),
  ];
  return lines.join("\n");
}

function raceHeadline(model: HudModel): string {
  if (model.phase === "ready") {
    return "Ready at the nest. Start the race when you are set.";
  }
  if (model.phase === "countdown") {
    return "Hold still. The countdown is running.";
  }
  if (model.phase === "finished") {
    return `Finished in ${formatRaceTime(model.finishTime ?? model.elapsed)}. Place: ${formatPlace(model.place, model.field)}.`;
  }
  return `Time ${formatRaceTime(model.elapsed)}    Place: ${formatPlace(model.place, model.field)}`;
}

function formatGamepad(gamepad: GamepadReading): string {
  if (!gamepad.connected) {
    return "Controller: not detected. Plug one in, then press any button. Browsers hide a pad until a button is pressed.";
  }

  const mappingLine = gamepad.usesStandardMapping
    ? "Mapping: standard. Left stick moves, right stick looks, B brakes, and X uses the held ability."
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
