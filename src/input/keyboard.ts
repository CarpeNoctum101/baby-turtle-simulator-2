export interface KeyboardIntent {
  throttle: number;
  steer: number;
  brake: boolean;
}

/** WASD is the default. Arrow keys do the same thing, and Space brakes. */

/**
 * True when the key is meant for a text field, such as the room code or the name.
 * Those fields must receive W, A, S and D as letters.
 */
export function isTypingTarget(target: unknown): boolean {
  if (target === null || typeof target !== "object") {
    return false;
  }
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof element.tagName === "string" ? element.tagName : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true;
}
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
