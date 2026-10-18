import { Engine } from "@babylonjs/core/Engines/engine";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Scene } from "@babylonjs/core/scene";
import { createPalm } from "./createPalm";
import { createAtmosphere } from "./createAtmosphere";
import { createOcean } from "./createOcean";
import { createBeachLand } from "./createBeachLand";
import { beachHeight, seededRandom } from "./landscape";
import { course } from "../../movement/course";
import { createCoconuts } from "./createCoconuts";

/** A visual study isolated from the unchanged race prototype and movement rules. */
export function createBeachPreview(scene: Scene, sun: DirectionalLight, fill: HemisphericLight): void {
  scene.clearColor = new Color4(0.79, 0.77, 0.66, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.79, 0.77, 0.66);
  scene.fogDensity = 0.0045;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1.04;
  fill.intensity = 0.62;
  fill.diffuse = new Color3(0.70, 0.82, 0.98);
  fill.groundColor = new Color3(0.29, 0.24, 0.17);
  const sunDirection = new Vector3(-0.22, 0.24, 0.95).normalize();
  sun.direction = sunDirection.negate();
  sun.position = sunDirection.scale(80);
  sun.diffuse = new Color3(1, 0.82, 0.58);
  sun.intensity = 2.1;
  sun.autoCalcShadowZBounds = true;
  createAtmosphere(scene, sunDirection);

  // Replace only the preview's visual blocks. Logical surface/finish coordinates stay intact.
  for (const name of ["surroundingSand", "drySand", "wetSand", "shallowWater", "finishZone", "rightBerm", "leftBerm", "nest",
    "startPad-left", "startPad-center", "startPad-right"]) {
    scene.getMeshByName(name)?.setEnabled(false);
  }
  for (const mesh of scene.meshes) if (mesh.name.startsWith("pebble")) mesh.setEnabled(false);
  createBeachLand(scene);
  createOcean(scene, sunDirection);

  const palmX = -course.halfWidth - 1.4;
  const palm = createPalm(scene, new Vector3(palmX, beachHeight(palmX, -10), -10));
  const palmSpots = [
    { x: palmX, z: -10, scale: 1, yaw: 0 },
    { x: course.halfWidth+4.8, z: -6, scale: 1.12, yaw: 1.5 },
    { x: -course.halfWidth-7, z: 3, scale: 0.92, yaw: -0.7 },
    { x: -course.halfWidth-10, z: -24, scale: 1.18, yaw: 0.8 },
    { x: course.halfWidth+9, z: 9, scale: 0.9, yaw: 2.7 },
  ];
  for (const [i, spot] of palmSpots.slice(1).entries()) {
    const root = new TransformNode(`previewPalmInstance${i}`, scene);
    root.position.set(spot.x, beachHeight(spot.x, spot.z), spot.z);
    root.scaling.setAll(spot.scale);
    root.rotation.y = spot.yaw;
    for (const source of palm.getChildMeshes()) {
      const instance = (source as Mesh).createInstance(`${source.name}Instance${i}`);
      instance.parent = root;
    }
  }
  createCoconuts(scene, palmSpots);
  createGrass(scene);

  const shadows = new ShadowGenerator(Math.min(2048, scene.getEngine().getCaps().maxTextureSize), sun);
  const engine = scene.getEngine();
  if (engine instanceof Engine && engine.webGLVersion > 1) {
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  } else {
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 16;
  }
  shadows.bias = 0.0007;
  shadows.normalBias = 0.035;
  shadows.setDarkness(0.12);
  // Wait for the caller's turtle to exist. Instances share source geometry/materials.
  scene.onBeforeRenderObservable.addOnce(() => {
    const racers = [scene.getTransformNodeByName("turtle"), scene.getTransformNodeByName("rival")];
    for (const mesh of scene.meshes) {
      const isTurtle = racers.some(racer => !!racer && mesh.isDescendantOf(racer));
      if (mesh.isEnabled() && (isTurtle || /^(palm|previewRock|previewDriftwood|previewGrass|previewCoconut)/.test(mesh.name))) {
        shadows.addShadowCaster(mesh, false);
        if (mesh instanceof InstancedMesh) mesh.sourceMesh.receiveShadows = true;
        else mesh.receiveShadows = !isTurtle;
      }
    }
  });
  for (const mesh of scene.meshes) {
    if (mesh.infiniteDistance) continue;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
  }
}

function createGrass(scene: Scene): void {
  const material = new PBRMaterial("previewDuneGrass", scene);
  material.albedoColor = new Color3(0.23, 0.31, 0.10);
  material.metallic = 0;
  material.roughness = 0.85;
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
  const blades: Mesh[] = [];
  for (let i = 0; i < 23; i++) {
    const angle = i * 2.399963;
    const base = new Vector3(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
    const height = 0.35 + (Math.sin(i * 4.7) + 1) * 0.16;
    const middle = base.add(new Vector3(Math.cos(angle) * 0.18, height * 0.7, Math.sin(angle) * 0.18));
    const tip = base.add(new Vector3(Math.cos(angle) * 0.4, height, Math.sin(angle) * 0.4));
    blades.push(MeshBuilder.CreateRibbon(`grassBlade${i}`, { pathArray: [
      [base, middle, tip], [base.add(new Vector3(0.025,0,0.01)), middle.add(new Vector3(0.018,0,0)), tip],
    ] }, scene));
  }
  const grass = Mesh.MergeMeshes(blades, true, false);
  if (!grass) return;
  grass.name = "previewGrassSource";
  grass.material = material;
  const grassX = -course.halfWidth - 1.8;
  grass.position.set(grassX, beachHeight(grassX,-10.3), -10.3);
  const random = seededRandom(912);
  for (let i = 0; i < 50; i++) {
    const x = (i % 2 ? -1 : 1) * (course.halfWidth + 0.5 + random() * 12), z = -36 + random() * 45;
    const tuft = grass.createInstance(`previewGrass${i}`);
    tuft.position.set(x, beachHeight(x,z), z);
    tuft.scaling.setAll(0.7 + random() * 1.4);
    tuft.rotation.y = random() * Math.PI * 2;
  }
}
