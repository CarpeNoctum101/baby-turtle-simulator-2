import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import data from "../assets/ocean-turtle/mesh.json";
import type { FlipperRig } from "./animateTurtle";
import type { PlaceholderTurtle } from "./createPlaceholderTurtle";

const colorUrl = new URL("../assets/ocean-turtle/color.jpg", import.meta.url).href;
const normalUrl = new URL("../assets/ocean-turtle/normal.png", import.meta.url).href;
const eyelidUrl = new URL("../assets/ocean-turtle/eyelid_color.jpg", import.meta.url).href;

/** User-supplied Ocean Turtle by der_On (CC BY 3.0), converted with free Blender. */
export function createOceanTurtle(scene: Scene, options: { id?: string } = {}): PlaceholderTurtle {
  const id = options.id ?? "turtle";
  const root = new TransformNode(id, scene);
  const visual = new TransformNode(`${id}Visual`, scene);
  visual.parent = root;
  const skeleton = new Skeleton(`${id}OceanRig`, `${id}OceanRig`, scene);
  const bodyBone = new Bone(`${id}BodyBone`, skeleton, null, Matrix.Identity());
  const flippers: FlipperRig[] = data.bones.map(definition => {
    const pivot = Vector3.FromArray(definition.pivot);
    const node = new TransformNode(`${id}${definition.name}Pivot`, scene);
    node.parent = visual;
    node.position.copyFrom(pivot);
    const bone = new Bone(`${id}${definition.name}`, skeleton, bodyBone, Matrix.Translation(pivot.x, pivot.y, pivot.z));
    bone.linkTransformNode(node);
    const side = definition.side as 1 | -1;
    return {
      mesh: node, side, role: definition.role as "front" | "rear",
      baseY: 0, baseZ: 0, boardingY: side * (definition.role === "front" ? 1.35 : 1.1), gait: "paddle",
    };
  });

  const skin = material(`${id}OceanSkin`, 0.78);
  const shell = material(`${id}OceanShell`, 0.62);
  shell.clearCoat.isEnabled = true;
  shell.clearCoat.intensity = 0.12;
  shell.clearCoat.roughness = 0.5;
  const eyelids = material(`${id}OceanEyelids`, 0.76);
  const eyes = material(`${id}OceanEyes`, 0.12);
  eyes.albedoColor = new Color3(0.012, 0.018, 0.01);
  // NullEngine tests inspect geometry without a browser image decoder. In the game,
  // identical URLs share Babylon's texture cache across materials and both racers.
  if (typeof Image !== "undefined") {
    const color = new Texture(colorUrl, scene);
    const normal = new Texture(normalUrl, scene);
    normal.gammaSpace = false;
    for (const surface of [skin, shell]) {
      surface.albedoTexture = color;
      surface.bumpTexture = normal;
      surface.invertNormalMapY = true;
    }
    eyelids.albedoTexture = new Texture(eyelidUrl, scene);
  }
  const materials = { skin, shell, eyes, eyelids };
  for (const part of data.parts) {
    const mesh = new Mesh(`${id}Ocean${part.name}`, scene);
    const vertices = new VertexData();
    vertices.positions = part.positions; vertices.normals = part.normals;
    vertices.uvs = part.uvs; vertices.indices = part.indices;
    vertices.matricesIndices = part.boneIndices; vertices.matricesWeights = part.boneWeights;
    vertices.applyToMesh(mesh);
    mesh.parent = visual;
    mesh.material = materials[part.name as keyof typeof materials];
    mesh.skeleton = skeleton;
    mesh.numBoneInfluencers = 2;
    mesh.isPickable = false;
    // Rest-pose bounds include the full flipper span; do not recalculate every frame.
  }
  return { root, visual, flippers, skin, shell };

  function material(name: string, roughness: number): PBRMaterial {
    const result = new PBRMaterial(name, scene);
    result.metallic = 0; result.roughness = roughness;
    return result;
  }
}
