import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { LookOffsets } from "../input/stepLook";

export interface FollowCameraRig {
  camera: ArcRotateCamera;
  radius: number;
  dispose: () => void;
}

/**
 * A low camera behind the turtle. It eases toward the turtle's heading
 * instead of snapping, and mouse or right-stick look is added on top.
 */
export function createFollowCamera(scene: Scene, turtle: TransformNode): FollowCameraRig {
  const aim = new TransformNode("cameraAim", scene);
  aim.parent = turtle;
  aim.position = new Vector3(0, 0.45, 0);

  const camera = new ArcRotateCamera("thirdPerson", -Math.PI / 2, 1.22, 6.5, aim.position.clone(), scene);
  camera.lockedTarget = aim;
  camera.lowerBetaLimit = 0.85;
  camera.upperBetaLimit = 1.48;
  camera.inertia = 0;
  camera.panningSensibility = 0;

  const canvas = scene.getEngine().getRenderingCanvas();
  let onWheel: (event: WheelEvent) => void = () => {};
  const rig: FollowCameraRig = {
    camera,
    radius: 6.5,
    dispose() {
      canvas?.removeEventListener("wheel", onWheel);
    },
  };
  onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    rig.radius = clamp(rig.radius + direction * 0.45, 3.5, 14);
  };
  canvas?.addEventListener("wheel", onWheel, { passive: false });

  return rig;
}

export function updateFollowCamera(rig: FollowCameraRig, heading: number, look: LookOffsets, dt: number): void {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const blend = 1 - Math.exp(-6 * safeDt);
  const desiredAlpha = -Math.PI / 2 - heading + look.yaw;
  const desiredBeta = clamp(1.22 + look.pitch, rig.camera.lowerBetaLimit ?? 0.85, rig.camera.upperBetaLimit ?? 1.48);

  rig.camera.alpha = lerpAngle(rig.camera.alpha, desiredAlpha, blend);
  rig.camera.beta = lerp(rig.camera.beta, desiredBeta, blend);
  rig.camera.radius = lerp(rig.camera.radius, rig.radius, blend);
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * amount;
}

function lerpAngle(current: number, target: number, amount: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
