import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

/**
 * Creates an empty beach: a sand-colored ground plane, a dawn sky, and two lights.
 * The turtle and camera are added by the caller so each piece can change on its own.
 */
export function createBeachScene(engine: Engine): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.58, 0.75, 0.9, 1);

  const fillLight = new HemisphericLight("skyFill", new Vector3(0, 1, 0), scene);
  fillLight.intensity = 0.55;
  fillLight.diffuse = new Color3(0.78, 0.86, 0.98);
  fillLight.groundColor = new Color3(0.55, 0.45, 0.3);

  // Rays travel toward +Z, so the side of the turtle facing the camera is lit.
  const sun = new DirectionalLight("sunrise", new Vector3(0.35, -0.85, 0.4), scene);
  sun.intensity = 1.05;
  sun.diffuse = new Color3(1, 0.9, 0.72);

  const beach = MeshBuilder.CreateGround("beach", { width: 80, height: 80 }, scene);
  const sand = new StandardMaterial("sand", scene);
  sand.diffuseColor = new Color3(0.89, 0.78, 0.55);
  sand.specularColor = new Color3(0.04, 0.04, 0.03);
  beach.material = sand;

  return scene;
}
