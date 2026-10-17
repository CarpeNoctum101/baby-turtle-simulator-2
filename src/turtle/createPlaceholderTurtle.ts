import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

/**
 * A stand-in hatchling built from spheres and boxes.
 * Everything is parented to one node so later movement can move a single object.
 * The head points toward +Z, which is the direction the camera sits behind.
 */
export function createPlaceholderTurtle(scene: Scene): TransformNode {
  const turtle = new TransformNode("turtle", scene);
  const skin = createFlatMaterial("turtleSkin", new Color3(0.42, 0.55, 0.28), scene);
  const shell = createFlatMaterial("turtleShell", new Color3(0.45, 0.28, 0.14), scene);
  const plastron = createFlatMaterial("turtlePlastron", new Color3(0.78, 0.68, 0.42), scene);
  const eye = createFlatMaterial("turtleEye", new Color3(0.08, 0.08, 0.08), scene);

  const body = MeshBuilder.CreateSphere("body", { diameter: 1, segments: 16 }, scene);
  body.scaling.set(1.15, 0.42, 1.35);
  body.position.y = 0.24;
  body.material = skin;
  body.parent = turtle;

  const belly = MeshBuilder.CreateSphere("plastron", { diameter: 1, segments: 12 }, scene);
  belly.scaling.set(0.95, 0.16, 1.1);
  belly.position.y = 0.12;
  belly.material = plastron;
  belly.parent = turtle;

  const carapace = MeshBuilder.CreateSphere("shell", { diameter: 1, segments: 16 }, scene);
  carapace.scaling.set(1.05, 0.48, 1.2);
  carapace.position.y = 0.4;
  carapace.material = shell;
  carapace.parent = turtle;

  const head = MeshBuilder.CreateSphere("head", { diameter: 0.38, segments: 12 }, scene);
  head.position.set(0, 0.32, 0.82);
  head.material = skin;
  head.parent = turtle;

  const leftEye = MeshBuilder.CreateSphere("leftEye", { diameter: 0.07, segments: 8 }, scene);
  leftEye.position.set(-0.1, 0.38, 0.98);
  leftEye.material = eye;
  leftEye.parent = turtle;

  const rightEye = MeshBuilder.CreateSphere("rightEye", { diameter: 0.07, segments: 8 }, scene);
  rightEye.position.set(0.1, 0.38, 0.98);
  rightEye.material = eye;
  rightEye.parent = turtle;

  addFlipper(scene, turtle, skin, "frontLeft", { x: 0.78, y: 0.16, z: 0.28 }, { y: 0.45, z: -0.4 }, {
    width: 0.62,
    height: 0.05,
    depth: 0.28,
  });
  addFlipper(scene, turtle, skin, "frontRight", { x: -0.78, y: 0.16, z: 0.28 }, { y: -0.45, z: 0.4 }, {
    width: 0.62,
    height: 0.05,
    depth: 0.28,
  });
  addFlipper(scene, turtle, skin, "rearLeft", { x: 0.5, y: 0.12, z: -0.62 }, { y: -0.7, z: -0.55 }, {
    width: 0.36,
    height: 0.045,
    depth: 0.2,
  });
  addFlipper(scene, turtle, skin, "rearRight", { x: -0.5, y: 0.12, z: -0.62 }, { y: 0.7, z: 0.55 }, {
    width: 0.36,
    height: 0.045,
    depth: 0.2,
  });

  return turtle;
}

function addFlipper(
  scene: Scene,
  parent: TransformNode,
  material: StandardMaterial,
  name: string,
  position: { x: number; y: number; z: number },
  rotation: { y: number; z: number },
  size: { width: number; height: number; depth: number },
): void {
  const flipper = MeshBuilder.CreateBox(name, size, scene);
  flipper.position.set(position.x, position.y, position.z);
  flipper.rotation.y = rotation.y;
  flipper.rotation.z = rotation.z;
  flipper.material = material;
  flipper.parent = parent;
}

function createFlatMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  return material;
}
