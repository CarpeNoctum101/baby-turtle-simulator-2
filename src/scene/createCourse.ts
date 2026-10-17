import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { course } from "../movement/course";

/** Draws the nest, the three surface bands, and the finish gate. */
export function createCourse(scene: Scene): void {
  addStrip(scene, "surroundingSand", 70, 110, 8, new Color3(0.84, 0.72, 0.46), 0);
  addStrip(
    scene,
    "drySand",
    course.halfWidth * 2,
    course.dry.maxZ - course.dry.minZ,
    centerOf(course.dry.minZ, course.dry.maxZ),
    new Color3(0.9, 0.78, 0.52),
    0.02,
  );
  addStrip(
    scene,
    "wetSand",
    course.halfWidth * 2,
    course.wet.maxZ - course.wet.minZ,
    centerOf(course.wet.minZ, course.wet.maxZ),
    new Color3(0.58, 0.48, 0.3),
    0.03,
  );
  addStrip(
    scene,
    "shallowWater",
    course.halfWidth * 2,
    course.water.maxZ - course.water.minZ,
    centerOf(course.water.minZ, course.water.maxZ),
    new Color3(0.22, 0.58, 0.68),
    0.04,
  );
  addStrip(
    scene,
    "finishZone",
    course.halfWidth * 2 - 0.4,
    course.finish.maxZ - course.finish.minZ,
    centerOf(course.finish.minZ, course.finish.maxZ),
    new Color3(0.65, 0.9, 0.95),
    0.05,
  );

  addBerm(scene, course.halfWidth + 0.45);
  addBerm(scene, -course.halfWidth - 0.45);
  addNest(scene);
  addFinishGate(scene);
}

function centerOf(minZ: number, maxZ: number): number {
  return (minZ + maxZ) / 2;
}

function addStrip(
  scene: Scene,
  name: string,
  width: number,
  depth: number,
  centerZ: number,
  color: Color3,
  y: number,
): void {
  const ground = MeshBuilder.CreateGround(name, { width, height: depth }, scene);
  ground.position.set(0, y, centerZ);
  const material = new StandardMaterial(`${name}Material`, scene);
  material.diffuseColor = color;
  material.specularColor = name === "shallowWater" || name === "finishZone" ? new Color3(0.2, 0.2, 0.18) : new Color3(0.04, 0.04, 0.03);
  ground.material = material;
}

function addBerm(scene: Scene, x: number): void {
  const berm = MeshBuilder.CreateBox(x > 0 ? "rightBerm" : "leftBerm", { width: 0.7, height: 0.28, depth: 86 }, scene);
  berm.position.set(x, 0.14, 10);
  const material = new StandardMaterial(`${berm.name}Material`, scene);
  material.diffuseColor = new Color3(0.72, 0.58, 0.36);
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  berm.material = material;
}

function addNest(scene: Scene): void {
  const nest = MeshBuilder.CreateCylinder("nest", { diameter: 2.4, height: 0.08, tessellation: 20 }, scene);
  nest.position.set(course.nest.x, 0.06, course.nest.z);
  const sand = new StandardMaterial("nestMaterial", scene);
  sand.diffuseColor = new Color3(0.55, 0.4, 0.24);
  sand.specularColor = new Color3(0.03, 0.03, 0.03);
  nest.material = sand;

  const pebbleMaterial = new StandardMaterial("pebbleMaterial", scene);
  pebbleMaterial.diffuseColor = new Color3(0.45, 0.42, 0.38);
  pebbleMaterial.specularColor = new Color3(0.04, 0.04, 0.04);
  const pebbleSpots = [
    { x: 1.15, z: 0.2 },
    { x: -1.05, z: 0.45 },
    { x: 0.3, z: 1.2 },
    { x: -0.4, z: -1.1 },
    { x: 0.9, z: -0.7 },
  ];
  for (const [index, spot] of pebbleSpots.entries()) {
    const pebble = MeshBuilder.CreateSphere(`pebble${index}`, { diameter: 0.28, segments: 8 }, scene);
    pebble.position.set(course.nest.x + spot.x, 0.16, course.nest.z + spot.z);
    pebble.material = pebbleMaterial;
  }
}

function addFinishGate(scene: Scene): void {
  const material = new StandardMaterial("finishMaterial", scene);
  material.diffuseColor = new Color3(0.9, 0.98, 1);
  material.emissiveColor = new Color3(0.35, 0.55, 0.6);
  material.specularColor = new Color3(0.1, 0.1, 0.1);

  const gateZ = course.finish.minZ;
  for (const x of [course.halfWidth - 0.8, -course.halfWidth + 0.8]) {
    const post = MeshBuilder.CreateBox(x > 0 ? "finishPostRight" : "finishPostLeft", {
      width: 0.28,
      height: 1.6,
      depth: 0.28,
    }, scene);
    post.position.set(x, 0.8, gateZ);
    post.material = material;
  }

  const bar = MeshBuilder.CreateBox("finishBar", { width: course.halfWidth * 2 - 1.3, height: 0.18, depth: 0.18 }, scene);
  bar.position.set(0, 1.55, gateZ);
  bar.material = material;
}
