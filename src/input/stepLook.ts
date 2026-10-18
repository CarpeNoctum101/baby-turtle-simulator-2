import { controlSettings } from "./controlSettings";

export interface LookOffsets {
  yaw: number;
  pitch: number;
}

export interface LookStick {
  x: number;
  y: number;
}

/**
 * Adds mouse movement and right-stick look into one camera offset.
 * The left stick does not come through here, so it cannot turn the view.
 */
export function stepLook(
  look: LookOffsets,
  mouse: { yawDelta: number; pitchDelta: number },
  stick: LookStick,
  dt: number,
): LookOffsets {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  // Values this small are leftover bias after the dead zone, not a deliberate look.
  const yawStick = Math.abs(stick.x) < 0.04 ? 0 : stick.x;
  const pitchStick = Math.abs(stick.y) < 0.04 ? 0 : stick.y;
  return {
    yaw: look.yaw + mouse.yawDelta + yawStick * controlSettings.stickLookYawRate * safeDt,
    pitch: clamp(
      look.pitch + mouse.pitchDelta + pitchStick * controlSettings.stickLookPitchRate * safeDt,
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
