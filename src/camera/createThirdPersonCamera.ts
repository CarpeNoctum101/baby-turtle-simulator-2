import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

/**
 * Sits behind and slightly above the turtle.
 * alpha rotates around the turtle, beta raises or lowers the view, and radius is distance.
 * Dragging orbits the turtle for this prototype. Later milestones will drive the camera
 * from the turtle's heading instead of leaving orbit free.
 */
export function createThirdPersonCamera(scene: Scene, turtle: TransformNode): ArcRotateCamera {
  const aim = new TransformNode("cameraAim", scene);
  aim.parent = turtle;
  aim.position = new Vector3(0, 0.4, 0);

  const camera = new ArcRotateCamera(
    "thirdPerson",
    -Math.PI / 2,
    1.15,
    6,
    aim.position.clone(),
    scene,
  );
  camera.lockedTarget = aim;
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 16;
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = Math.PI / 2 - 0.08;
  camera.panningSensibility = 0;
  camera.wheelDeltaPercentage = 0.02;
  camera.inertia = 0.8;

  const canvas = scene.getEngine().getRenderingCanvas();
  if (canvas) {
    camera.attachControl(canvas, true);
  }

  return camera;
}
