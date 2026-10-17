import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

/** A Y-up, metre-scale palm, with its pivot on the sand. Entirely original geometry. */
export function createPalm(scene: Scene, position: Vector3): TransformNode {
  const root = new TransformNode("previewPalm", scene);
  root.position.copyFrom(position);
  const bark = new PBRMaterial("palmBark", scene);
  bark.albedoColor = new Color3(0.78, 0.69, 0.54);
  bark.metallic = 0;
  bark.roughness = 0.88;
  bark.albedoTexture = createBarkTexture(scene);

  const trunkPath = Array.from({ length: 129 }, (_, i) => {
    const t = i / 128;
    return new Vector3(1.15 * t * t, 5.6 * t, 0.32 * Math.sin(t * Math.PI * 0.8));
  });
  const trunk = MeshBuilder.CreateTube("palmCurvedTrunk", {
    path: trunkPath,
    tessellation: 16,
    radiusFunction: (i) => {
      const t = i / 128;
      return 0.29 - t * 0.14 + 0.016 * Math.cos(t * Math.PI * 2 * 29) + 0.08 * Math.exp(-t * 22);
    },
    cap: Mesh.CAP_ALL,
  }, scene);
  trunk.material = bark;
  trunk.parent = root;

  const leaves = new PBRMaterial("palmLeafBlades", scene);
  leaves.albedoColor = new Color3(0.32, 0.48, 0.12);
  leaves.metallic = 0;
  leaves.roughness = 0.64;
  leaves.subSurface.isTranslucencyEnabled = true;
  leaves.subSurface.translucencyIntensity = 0.42;
  leaves.subSurface.useAlbedoToTintTranslucency = true;
  leaves.subSurface.translucencyColor = new Color3(0.48, 0.66, 0.17);
  // Geometric leaflets have no alpha texture, avoiding transparency sorting and overdraw.
  leaves.backFaceCulling = false;
  leaves.twoSidedLighting = true;
  const ribMaterial = new PBRMaterial("palmRibs", scene);
  ribMaterial.albedoColor = new Color3(0.37, 0.43, 0.13);
  ribMaterial.metallic = 0;
  ribMaterial.roughness = 0.8;

  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const ribs: Mesh[] = [];
  const crown = trunkPath[trunkPath.length - 1];

  for (let frond = 0; frond < 13; frond++) {
    const angle = frond * 2.399963;
    const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const upper = frond >= 9;
    const length = upper ? 2.45 : 3.15 + Math.sin(frond * 2.7) * 0.3;
    const origin = crown.add(new Vector3(0, upper ? 0.22 : -0.05, 0));
    const along = (t: number) => origin.add(forward.scale(length * t)).add(new Vector3(0,
      Math.sin(t * Math.PI) * (upper ? 1.05 : 0.65) - t * t * (upper ? 0.3 : 1.55), 0));
    const path = Array.from({ length: 19 }, (_, i) => along(i / 18));
    ribs.push(MeshBuilder.CreateTube(`palmRib${frond}`, {
      path, tessellation: 5, radiusFunction: (i) => 0.035 * (1 - i / 20) + 0.004,
    }, scene));

    for (let pair = 0; pair < 22; pair++) {
      const t = 0.1 + (pair / 22) * 0.86;
      const span = Math.sin(Math.PI * t) * (upper ? 0.66 : 0.88) * (1 - t * 0.38);
      for (const sign of [-1, 1]) {
        const start = along(t);
        const tip = start.add(side.scale(sign * span)).add(forward.scale(0.12 + t * 0.3));
        tip.y -= 0.12 + span * 0.28;
        const middle = Vector3.Lerp(start, tip, 0.48);
        middle.y += 0.08;
        const width = 0.045 + span * 0.035;
        const left = middle.add(forward.scale(width));
        const right = middle.subtract(forward.scale(width));
        left.y -= 0.035;
        right.y -= 0.035;
        const offset = positions.length / 3;
        for (const point of [start, left, middle, right, tip]) positions.push(point.x, point.y, point.z);
        indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3,
          offset + 1, offset + 4, offset + 2, offset + 2, offset + 4, offset + 3);
        const shade = 0.7 + 0.25 * (0.5 + 0.5 * Math.sin(frond * 4 + pair * 1.7));
        for (let vertex = 0; vertex < 5; vertex++) {
          colors.push(shade, shade, shade * (upper ? 0.88 : 0.73), 1);
        }
      }
    }
  }
  const foliage = new Mesh("palmLayeredFronds", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(foliage);
  foliage.material = leaves;
  foliage.parent = root;

  const mergedRibs = Mesh.MergeMeshes(ribs, true, false);
  if (mergedRibs) {
    mergedRibs.name = "palmMergedRibs";
    mergedRibs.material = ribMaterial;
    mergedRibs.parent = root;
  }
  const crownShaft = MeshBuilder.CreateSphere("palmCrownShaft", { diameter: 0.6, segments: 12 }, scene);
  crownShaft.scaling.set(0.65, 1.35, 0.65);
  crownShaft.position.copyFrom(crown);
  crownShaft.material = ribMaterial;
  crownShaft.parent = root;

  const coconuts: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const coconut = MeshBuilder.CreateSphere(`coconut${i}`, { diameter: 0.26, segments: 8 }, scene);
    coconut.position.copyFrom(crown.add(new Vector3(Math.cos(i * 2.1) * 0.25, -0.28, Math.sin(i * 2.1) * 0.25)));
    coconut.scaling.y = 1.2;
    coconuts.push(coconut);
  }
  const cluster = Mesh.MergeMeshes(coconuts, true, false);
  if (cluster) {
    cluster.name = "palmCoconuts";
    cluster.material = bark;
    cluster.parent = root;
  }
  return root;
}

function createBarkTexture(scene: Scene): RawTexture {
  const size = 256;
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const scar = Math.pow(0.5 + 0.5 * Math.cos((y / size) * Math.PI * 2 * 29 + Math.sin(x / size * Math.PI * 8) * 0.5), 14);
      const fiber = Math.sin(x * 1.1 + Math.sin(y * 0.14)) * 7;
      const value = 190 - scar * 65 + fiber;
      pixels.set([value, value * 0.86, value * 0.66], (y * size + x) * 3);
    }
  }
  const texture = RawTexture.CreateRGBTexture(pixels, size, size, scene, true, false);
  texture.name = "originalPalmBark256";
  return texture;
}
