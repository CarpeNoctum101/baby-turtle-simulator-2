import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import type { LookOffsets } from "../input/stepLook";

export interface FollowCameraRig {
  camera: ArcRotateCamera;
  radius: number;
  target: Vector3;
  dispose: () => void;
}

/** Alpha -PI/2 looks toward +Z. Adding look.yaw turns away from that. */
const restAlpha = -Math.PI / 2;
const restBeta = 1.22;
const eyeHeight = 0.45;
/** Stops just short of straight overhead and straight underneath, so the view cannot flip. */
const minBeta = 0.15;
const maxBeta = Math.PI - 0.15;

/**
 * A camera that sits behind the player's look direction.
 * Alpha and beta are set from the look offsets every frame, so the view cannot drift on its own.
 */
export function createFollowCamera(scene: Scene): FollowCameraRig {
  const target = new Vector3(0, eyeHeight, 0);
  const camera = new ArcRotateCamera("thirdPerson", restAlpha, restBeta, 6.5, target, scene);
  camera.inputs.clear();
  camera.inertia = 0;
  camera.panningSensibility = 0;
  camera.lowerRadiusLimit = 3.5;
  camera.upperRadiusLimit = 14;
  camera.lowerBetaLimit = minBeta;
  camera.upperBetaLimit = maxBeta;
  camera.lockedTarget = null;
  camera.parent = null;

  const canvas = scene.getEngine().getRenderingCanvas();
  let onWheel: (event: WheelEvent) => void = () => {};
  const rig: FollowCameraRig = {
    camera,
    radius: 6.5,
    target,
    dispose() {
      canvas?.removeEventListener("wheel", onWheel);
    },
  };
  onWheel = (event: WheelEvent) => {
    event.preventDefault();
    rig.radius = clamp(rig.radius + Math.sign(event.deltaY) * 0.45, 3.5, 14);
  };
  canvas?.addEventListener("wheel", onWheel, { passive: false });

  return rig;
}

/** Clears leftover camera motion before a race starts again. */
export function resetFollowCamera(rig: FollowCameraRig): void {
  rig.camera.alpha = restAlpha;
  rig.camera.beta = restBeta;
  rig.camera.inertialAlphaOffset = 0;
  rig.camera.inertialBetaOffset = 0;
  rig.camera.inertialRadiusOffset = 0;
  rig.camera.inertialPanningX = 0;
  rig.camera.inertialPanningY = 0;
}

/** Puts the camera behind the look direction. The turtle's heading is not used. */
export function updateFollowCamera(rig: FollowCameraRig, look: LookOffsets, x: number, z: number): void {
  rig.target.set(x, eyeHeight, z);
  rig.camera.alpha = restAlpha + look.yaw;
  rig.camera.beta = clamp(restBeta + look.pitch, minBeta, maxBeta);
  rig.camera.radius = rig.radius;
  rig.camera.inertialAlphaOffset = 0;
  rig.camera.inertialBetaOffset = 0;
  rig.camera.inertialRadiusOffset = 0;
  rig.camera.inertialPanningX = 0;
  rig.camera.inertialPanningY = 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
