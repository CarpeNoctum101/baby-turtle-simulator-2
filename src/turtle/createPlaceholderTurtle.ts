import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { FlipperRig } from "./animateTurtle";

export interface TurtlePaint {
  id?: string;
  skin?: Color3;
  shell?: Color3;
}

export interface PlaceholderTurtle {
  /** Moved and turned by the crawl. The camera follows this node. */
  root: TransformNode;
  /** Bobs and rolls without moving the logical position. */
  visual: TransformNode;
  flippers: FlipperRig[];
  skin: StandardMaterial;
  shell: StandardMaterial;
}

/**
 * A stand-in hatchling built from spheres and boxes.
 * The head points toward +Z. The root is the piece the movement code positions.
 */
export function createPlaceholderTurtle(scene: Scene, paint: TurtlePaint = {}): PlaceholderTurtle {
  const id = paint.id ?? "turtle";
  const root = new TransformNode(id, scene);
  const visual = new TransformNode(`${id}Visual`, scene);
  visual.parent = root;
  const skin = createFlatMaterial(`${id}Skin`, paint.skin ?? new Color3(0.42, 0.55, 0.28), scene);
  const shell = createFlatMaterial(`${id}Shell`, paint.shell ?? new Color3(0.45, 0.28, 0.14), scene);
  const plastron = createFlatMaterial(`${id}Plastron`, new Color3(0.78, 0.68, 0.42), scene);
  const eye = createFlatMaterial(`${id}Eye`, new Color3(0.08, 0.08, 0.08), scene);

  const body = MeshBuilder.CreateSphere(`${id}Body`, { diameter: 1, segments: 16 }, scene);
  body.scaling.set(1.15, 0.42, 1.35);
  body.position.y = 0.24;
  body.material = skin;
  body.parent = visual;

  const belly = MeshBuilder.CreateSphere(`${id}PlastronMesh`, { diameter: 1, segments: 12 }, scene);
  belly.scaling.set(0.95, 0.16, 1.1);
  belly.position.y = 0.12;
  belly.material = plastron;
  belly.parent = visual;

  const carapace = MeshBuilder.CreateSphere(`${id}Carapace`, { diameter: 1, segments: 16 }, scene);
  carapace.scaling.set(1.05, 0.48, 1.2);
  carapace.position.y = 0.4;
  carapace.material = shell;
  carapace.parent = visual;

  const head = MeshBuilder.CreateSphere(`${id}Head`, { diameter: 0.38, segments: 12 }, scene);
  head.position.set(0, 0.32, 0.82);
  head.material = skin;
  head.parent = visual;

  const leftEye = MeshBuilder.CreateSphere(`${id}LeftEye`, { diameter: 0.07, segments: 8 }, scene);
  leftEye.position.set(-0.1, 0.38, 0.98);
  leftEye.material = eye;
  leftEye.parent = visual;

  const rightEye = MeshBuilder.CreateSphere(`${id}RightEye`, { diameter: 0.07, segments: 8 }, scene);
  rightEye.position.set(0.1, 0.38, 0.98);
  rightEye.material = eye;
  rightEye.parent = visual;

  const flippers = [
    addFlipper(scene, visual, skin, `${id}FrontLeft`, { x: 0.78, y: 0.16, z: 0.28 }, { y: 0.45, z: -0.4 }, {
      width: 0.62,
      height: 0.05,
      depth: 0.28,
    }),
    addFlipper(scene, visual, skin, `${id}FrontRight`, { x: -0.78, y: 0.16, z: 0.28 }, { y: -0.45, z: 0.4 }, {
      width: 0.62,
      height: 0.05,
      depth: 0.28,
    }),
    addFlipper(scene, visual, skin, `${id}RearLeft`, { x: 0.5, y: 0.12, z: -0.62 }, { y: -0.7, z: -0.55 }, {
      width: 0.36,
      height: 0.045,
      depth: 0.2,
    }),
    addFlipper(scene, visual, skin, `${id}RearRight`, { x: -0.5, y: 0.12, z: -0.62 }, { y: 0.7, z: 0.55 }, {
      width: 0.36,
      height: 0.045,
      depth: 0.2,
    }),
  ];

  return { root, visual, flippers, skin, shell };
}

function addFlipper(
  scene: Scene,
  parent: TransformNode,
  material: StandardMaterial,
  name: string,
  position: { x: number; y: number; z: number },
  rotation: { y: number; z: number },
  size: { width: number; height: number; depth: number },
): FlipperRig {
  const flipper = MeshBuilder.CreateBox(name, size, scene);
  flipper.position.set(position.x, position.y, position.z);
  flipper.rotation.y = rotation.y;
  flipper.rotation.z = rotation.z;
  flipper.material = material;
  flipper.parent = parent;
  return {
    mesh: flipper,
    baseY: rotation.y,
    baseZ: rotation.z,
    side: position.x >= 0 ? 1 : -1,
    role: name.toLowerCase().includes("front") ? "front" : "rear",
  };
}

function createFlatMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  return material;
}
