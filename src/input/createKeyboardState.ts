const handledKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export interface KeyboardState {
  keys: Set<string>;
  dispose: () => void;
}

/** Remembers which physical keys are held. The Set is read by the pure keyboard module. */
export function createKeyboardState(target: Window): KeyboardState {
  const keys = new Set<string>();

  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.code);
    if (handledKeys.has(event.code)) {
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.code);
  };
  const onBlur = () => {
    keys.clear();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    keys,
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      keys.clear();
    },
  };
}
