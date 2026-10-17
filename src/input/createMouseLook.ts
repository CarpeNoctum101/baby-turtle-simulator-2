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
 * The camera turns only while the right mouse button is held.
 * A normal click does not capture the cursor, so holding W cannot spin the view.
 */
export function createMouseLook(canvas: HTMLCanvasElement): MouseLook {
  let pendingYaw = 0;
  let pendingPitch = 0;
  let looking = false;

  const onContextMenu = (event: Event) => {
    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 2) {
      return;
    }
    looking = true;
    canvas.focus();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button === 2) {
      looking = false;
    }
  };

  const onBlur = () => {
    looking = false;
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!looking) {
      return;
    }
    const movementX = clamp(event.movementX, -50, 50);
    const movementY = clamp(event.movementY, -50, 50);
    pendingYaw -= movementX * controlSettings.mouseYawSensitivity;
    pendingPitch += movementY * controlSettings.mousePitchSensitivity;
  };

  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("mousemove", onMouseMove);

  return {
    get pointerLocked() {
      return looking;
    },
    consume() {
      const delta = { yawDelta: pendingYaw, pitchDelta: pendingPitch };
      pendingYaw = 0;
      pendingPitch = 0;
      return delta;
    },
    dispose() {
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mousemove", onMouseMove);
      looking = false;
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
