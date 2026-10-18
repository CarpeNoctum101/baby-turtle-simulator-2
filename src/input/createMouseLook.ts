import { controlSettings } from "./controlSettings";

export interface MouseDelta {
  yawDelta: number;
  pitchDelta: number;
}

export interface MouseLook {
  pointerLocked: boolean;
  /** True while the left mouse button is held. That button fires a bubble. */
  shooting: boolean;
  consume: () => MouseDelta;
  dispose: () => void;
}

/**
 * Drag with either mouse button, including a trackpad's normal click, to look.
 * Pointer capture keeps a drag working outside the canvas without locking the cursor.
 */
export function createMouseLook(canvas: HTMLCanvasElement): MouseLook {
  let pendingYaw = 0;
  let pendingPitch = 0;
  let activePointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let shooting = false;

  const endDrag = () => {
    const pointer = activePointer;
    activePointer = null;
    shooting = false;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) {
      canvas.releasePointerCapture(pointer);
    }
  };

  const onContextMenu = (event: Event) => {
    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    if ((event.button !== 0 && event.button !== 2) || activePointer !== null) {
      return;
    }
    event.preventDefault();
    activePointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    shooting = (event.buttons & 1) !== 0;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === activePointer) {
      endDrag();
    }
  };

  const onBlur = () => {
    endDrag();
    pendingYaw = 0;
    pendingPitch = 0;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) {
      return;
    }
    if ((event.buttons & 3) === 0) {
      endDrag();
      return;
    }
    shooting = (event.buttons & 1) !== 0;
    // Client coordinates work on trackpads and browsers that report movementX/Y as zero.
    const movementX = clamp(event.clientX - lastX, -50, 50);
    const movementY = clamp(event.clientY - lastY, -50, 50);
    lastX = event.clientX;
    lastY = event.clientY;
    pendingYaw -= movementX * controlSettings.mouseYawSensitivity;
    pendingPitch += movementY * controlSettings.mousePitchSensitivity;
  };

  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("lostpointercapture", onPointerUp);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointermove", onPointerMove);

  return {
    get pointerLocked() {
      return activePointer !== null;
    },
    get shooting() {
      return shooting;
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
      canvas.removeEventListener("lostpointercapture", onPointerUp);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onPointerMove);
      onBlur();
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
