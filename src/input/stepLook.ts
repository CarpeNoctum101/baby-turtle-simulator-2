import { controlSettings } from "./controlSettings";

export interface LookOffsets {
  yaw: number;
  pitch: number;
}

export interface LookStick {
  x: number;
  y: number;
}

/** Adds mouse movement and right-stick movement into one camera offset. */
export function stepLook(
  look: LookOffsets,
  mouse: { yawDelta: number; pitchDelta: number },
  stick: LookStick,
  dt: number,
): LookOffsets {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  return {
    yaw: look.yaw + mouse.yawDelta + stick.x * controlSettings.stickLookYawRate * safeDt,
    pitch: clamp(
      look.pitch + mouse.pitchDelta + stick.y * controlSettings.stickLookPitchRate * safeDt,
      -controlSettings.lookPitchLimit,
      controlSettings.lookPitchLimit,
    ),
  };
}

export function lookSource(stickX: number, stickY: number): "mouse" | "right-stick" {
  return stickX !== 0 || stickY !== 0 ? "right-stick" : "mouse";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
