export interface KeyboardIntent {
  throttle: number;
  steer: number;
  brake: boolean;
}

/** WASD is the default. Arrow keys do the same thing, and Space brakes. */
export function readKeyboard(pressed: ReadonlySet<string>): KeyboardIntent {
  const throttle = clamp(
    (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) -
      (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0),
    -1,
    1,
  );
  const steer = clamp(
    (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) -
      (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0),
    -1,
    1,
  );

  return {
    throttle,
    steer,
    brake: pressed.has("Space"),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
