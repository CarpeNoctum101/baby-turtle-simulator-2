import { controlSettings } from "./controlSettings";

export interface MouseDelta {
  yawDelta: number;
  pitchDelta: number;
}

export interface MouseLook {
  pointerLocked: boolean;
  consume: () => MouseDelta;
  dispose: () => void;
}

/**
 * Mouse look is the default camera control.
 * Clicking captures the cursor. Dragging also looks around when capture is unavailable.
 */
export function createMouseLook(canvas: HTMLCanvasElement): MouseLook {
  let pointerLocked = false;
  let pendingYaw = 0;
  let pendingPitch = 0;
  let dragging = false;

  const onClick = () => {
    canvas.focus();
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock().catch(() => {
        // Dragging still rotates the view when the browser refuses pointer lock.
      });
    }
  };

  const onLockChange = () => {
    pointerLocked = document.pointerLockElement === canvas;
    dragging = false;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button === 0 && document.pointerLockElement !== canvas) {
      dragging = true;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) {
      dragging = false;
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    const looking = document.pointerLockElement === canvas || dragging;
    if (!looking) {
      return;
    }
    pendingYaw -= event.movementX * controlSettings.mouseYawSensitivity;
    pendingPitch += event.movementY * controlSettings.mousePitchSensitivity;
  };

  canvas.addEventListener("click", onClick);
  document.addEventListener("pointerlockchange", onLockChange);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("mousemove", onMouseMove);

  return {
    get pointerLocked() {
      return pointerLocked;
    },
    consume() {
      const delta = { yawDelta: pendingYaw, pitchDelta: pendingPitch };
      pendingYaw = 0;
      pendingPitch = 0;
      return delta;
    },
    dispose() {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mousemove", onMouseMove);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    },
  };
}
