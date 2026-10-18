import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { course } from "../../movement/course";
import { beachHeight, seededRandom } from "./landscape";

/** Original fallen coconuts. Every instance shares one mesh and a small procedural husk texture. */
export function createCoconuts(scene: Scene, palms: readonly { x: number; z: number }[]): TransformNode {
  const root = new TransformNode("previewCoconuts", scene);
  if (palms.length === 0) return root;
  const random = seededRandom(409);
  const textureSize = 64, pixels = new Uint8Array(textureSize * textureSize * 3);
  for (let y = 0; y < textureSize; y++) for (let x = 0; x < textureSize; x++) {
    const fiber = Math.sin(x / textureSize * Math.PI * 46 + Math.sin(y * 0.24) * 0.8);
    const value = 92 + fiber * 15 + random() * 18;
    pixels.set([value, value * 0.61, value * 0.3], (y * textureSize + x) * 3);
  }
  const husk = new PBRMaterial("previewCoconutHusk", scene);
  husk.albedoTexture = RawTexture.CreateRGBTexture(pixels, textureSize, textureSize, scene, true, false);
  husk.albedoTexture.name = "originalCoconutFibers64";
  husk.roughness = 0.98;
  husk.metallic = 0;
  const pore = new PBRMaterial("previewCoconutPores", scene);
  pore.albedoColor = new Color3(0.07, 0.035, 0.012);
  pore.roughness = 1;
  pore.metallic = 0;
  const body = MeshBuilder.CreateSphere("coconutHusk", { diameter: 1, segments: 10 }, scene);
  body.scaling.set(1, 0.85, 1.1);
  body.material = husk;
  const parts = [body];
  for (const [x, y] of [[-0.1, 0.06], [0.1, 0.06], [0, -0.1]]) {
    const eye = MeshBuilder.CreateSphere("coconutPore", { diameter: 0.085, segments: 6 }, scene);
    eye.scaling.z = 0.35;
    eye.position.set(x, y, -0.545);
    eye.material = pore;
    parts.push(eye);
  }
  const source = Mesh.MergeMeshes(parts, true, false, undefined, false, true)!;
  source.name = "previewCoconutSource";
  let index = 0;
  for (const palm of palms) for (let i = 0; i < 4; i++) {
    const size = 0.48 + random() * 0.15;
    const side = Math.sign(palm.x) || 1;
    const angle = i * 2.4 + random() * 0.5;
    const radius = 0.65 + random() * 0.6;
    // Include the whole coconut's radius, not just its center, in the track clearance.
    const x = side * Math.max(course.halfWidth + 0.8 + size * 0.6,
      Math.abs(palm.x + Math.cos(angle) * radius));
    const z = palm.z + Math.sin(angle) * radius;
    const coconut = index === 0 ? source : source.createInstance(`previewCoconut${index}`);
    coconut.parent = root;
    coconut.position.set(x, beachHeight(x, z) + size * 0.43 - 0.02, z);
    coconut.scaling.setAll(size);
    coconut.rotation.set(0, -side * Math.PI / 2 + (random() - 0.5) * 0.9, (random() - 0.5) * 0.24);
    coconut.isPickable = false;
    coconut.receiveShadows = true;
    index++;
  }
  return root;
}
