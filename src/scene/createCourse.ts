import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { course, startingGrid } from "../movement/course";
import { obstacleLayout } from "../movement/obstacles";

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
  addStartingGrid(scene);
  addRoute(scene);
  addObstacles(scene);
  addFinishGate(scene);
}

/** Rocks and washed-up logs. The crawl is pushed out of these in the movement step. */
function addObstacles(scene: Scene): void {
  const rockMaterial = new StandardMaterial("obstacleRock", scene);
  rockMaterial.diffuseColor = new Color3(0.48, 0.46, 0.42);
  rockMaterial.specularColor = new Color3(0.04, 0.04, 0.04);
  const pebbleMaterial = new StandardMaterial("obstaclePebble", scene);
  pebbleMaterial.diffuseColor = new Color3(0.62, 0.58, 0.5);
  pebbleMaterial.specularColor = new Color3(0.03, 0.03, 0.03);
  const woodMaterial = new StandardMaterial("obstacleLog", scene);
  woodMaterial.diffuseColor = new Color3(0.4, 0.28, 0.16);
  woodMaterial.specularColor = new Color3(0.04, 0.03, 0.02);

  for (const obstacle of obstacleLayout) {
    if (obstacle.kind === "log") {
      const log = MeshBuilder.CreateCylinder(obstacle.id, {
        height: obstacle.length,
        diameter: obstacle.radius * 2,
        tessellation: 10,
      }, scene);
      log.position.set(obstacle.x, obstacle.radius, obstacle.z);
      const along = new Vector3(Math.sin(obstacle.yaw), 0, Math.cos(obstacle.yaw));
      const rotation = new Quaternion();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), along, rotation);
      log.rotationQuaternion = rotation;
      log.material = woodMaterial;
      continue;
    }

    const rock = MeshBuilder.CreateSphere(obstacle.id, { diameter: obstacle.radius * 2, segments: 10 }, scene);
    rock.position.set(obstacle.x, obstacle.radius * 0.42, obstacle.z);
    rock.scaling.y = 0.72;
    rock.material = rockMaterial;
    const pebble = MeshBuilder.CreateSphere(`${obstacle.id}-pebble`, { diameter: obstacle.radius * 0.7, segments: 8 }, scene);
    pebble.position.set(obstacle.x + obstacle.radius * 0.45, obstacle.radius * 0.28, obstacle.z + obstacle.radius * 0.2);
    pebble.material = pebbleMaterial;
  }
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

const sandSurfaceY = 0.02;
const nestHeight = 0.1;
const nestTop = sandSurfaceY + 0.03 + nestHeight;

function addNest(scene: Scene): void {
  const nest = MeshBuilder.CreateCylinder("nest", { diameter: 2.4, height: nestHeight, tessellation: 20 }, scene);
  nest.position.set(course.nest.x, nestTop - nestHeight / 2, course.nest.z);
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
    pebble.position.set(course.nest.x + spot.x, nestTop + 0.14, course.nest.z + spot.z);
    pebble.material = pebbleMaterial;
  }
}

function addStartingGrid(scene: Scene): void {
  const lineMaterial = new StandardMaterial("startLineMaterial", scene);
  lineMaterial.diffuseColor = new Color3(0.95, 0.95, 0.92);
  lineMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
  const line = MeshBuilder.CreateBox("startLine", { width: course.halfWidth * 2, height: 0.04, depth: 0.2 }, scene);
  line.position.set(0, 0.08, course.nest.z - 1.7);
  line.material = lineMaterial;

  for (const spot of startingGrid) {
    const onNest = spot.id === "center";
    const height = onNest ? 0.045 : 0.07;
    const base = onNest ? nestTop : sandSurfaceY;
    const pad = MeshBuilder.CreateCylinder(
      `startPad-${spot.id}`,
      { diameter: onNest ? 1.7 : 1.45, height, tessellation: 20 },
      scene,
    );
    pad.position.set(spot.x, base + 0.02 + height / 2, spot.z);
    const material = new StandardMaterial(`startPadMaterial-${spot.id}`, scene);
    material.diffuseColor = spot.id === "center" ? new Color3(0.93, 0.78, 0.38) : new Color3(0.62, 0.5, 0.32);
    material.specularColor = new Color3(0.04, 0.04, 0.03);
    pad.material = material;
  }
}

/** A dashed center line and edge posts from the nest to the finish gate. */
function addRoute(scene: Scene): void {
  const dashMaterial = new StandardMaterial("routeDashMaterial", scene);
  dashMaterial.diffuseColor = new Color3(0.96, 0.94, 0.84);
  dashMaterial.specularColor = new Color3(0.04, 0.04, 0.03);
  const postMaterial = new StandardMaterial("routePostMaterial", scene);
  postMaterial.diffuseColor = new Color3(0.32, 0.42, 0.28);
  postMaterial.specularColor = new Color3(0.03, 0.03, 0.03);

  let dashIndex = 0;
  for (let z = course.nest.z + 3; z < course.finish.minZ; z += 3) {
    const dash = MeshBuilder.CreateBox(`routeDash${dashIndex}`, { width: 0.26, height: 0.035, depth: 0.85 }, scene);
    dash.position.set(0, 0.09, z);
    dash.material = dashMaterial;
    dashIndex += 1;
  }

  let postIndex = 0;
  for (let z = course.nest.z; z <= course.finish.minZ; z += 6) {
    for (const x of [-(course.halfWidth - 1.15), course.halfWidth - 1.15]) {
      const post = MeshBuilder.CreateCylinder(`routePost${postIndex}`, { diameter: 0.16, height: 0.42, tessellation: 8 }, scene);
      post.position.set(x, 0.26, z);
      post.material = postMaterial;
      postIndex += 1;
    }
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
