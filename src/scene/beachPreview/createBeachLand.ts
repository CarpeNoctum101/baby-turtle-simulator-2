import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { applySandUVs, createSandMaterials } from "./createSandMaterials";
import { beachHeight, seededRandom, smoothstep } from "./landscape";
import { course } from "../../movement/course";

export function createBeachLand(scene: Scene): void {
  const sand = createSandMaterials(scene);
  const backZ = -84, frontZ = course.water.minZ + 2;
  const depth = frontZ - backZ;
  const ground = MeshBuilder.CreateGround("previewNaturalBeach", { width: 120, height: depth, subdivisions: 128 }, scene);
  ground.position.z = (backZ + frontZ) / 2;
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [], detailUVs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2] + ground.position.z;
    positions[i + 1] = beachHeight(x, z);
    const wetness = smoothstep(course.wet.minZ, course.wet.minZ + 3.5, z + Math.sin(x * 0.21) * 0.5);
    const color = Color3.Lerp(sand.dryColor, sand.wetColor, wetness);
    const variation = 0.95 + Math.sin(x * 0.55 + z * 0.7) * Math.sin(z * 0.36 - x * 0.3) * 0.045;
    colors.push(color.r * variation, color.g * variation, color.b * variation, 1);
    detailUVs.push(x / 120 + 0.5, (z - backZ) / depth);
  }
  ground.setVerticesData(VertexBuffer.PositionKind, positions);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, ground.getIndices()!, normals);
  ground.setVerticesData(VertexBuffer.NormalKind, normals);
  ground.setVerticesData(VertexBuffer.ColorKind, colors);
  ground.setVerticesData(VertexBuffer.UV2Kind, detailUVs);
  ground.material = sand.transition;
  ground.receiveShadows = true;
  ground.refreshBoundingInfo();
  applySandUVs(ground);

  const roughness = new Uint8Array(128 * 128 * 3);
  for (let y = 0; y < 128; y++) {
    const z = (y + 0.5) / 128 * depth + backZ;
    const value = 0.96 - smoothstep(course.wet.minZ, course.wet.minZ + 3.5, z) * 0.42
      - smoothstep(course.water.minZ - 9, course.water.minZ, z) * 0.28;
    for (let x = 0; x < 128; x++) roughness.set([255, value * 255, 0], (y * 128 + x) * 3);
  }
  const map = RawTexture.CreateRGBTexture(roughness, 128, 128, scene, true, false);
  map.name = "originalBeachRoughness128";
  map.gammaSpace = false;
  map.coordinatesIndex = 1;
  map.wrapU = map.wrapV = Texture.CLAMP_ADDRESSMODE;
  sand.transition.metallicTexture = map;
  sand.transition.useRoughnessFromMetallicTextureAlpha = false;
  sand.transition.useRoughnessFromMetallicTextureGreen = true;
  sand.transition.roughness = 1;
  sand.transition.specularIntensity = 0.45;
  addShoreDetails(scene);
}

function addShoreDetails(scene: Scene): void {
  const random = seededRandom(681);
  const stoneMaterial = new PBRMaterial("previewWeatheredStone", scene);
  stoneMaterial.albedoColor = new Color3(0.32, 0.31, 0.26);
  stoneMaterial.metallic = 0;
  stoneMaterial.roughness = 0.85;
  const stone = MeshBuilder.CreateSphere("previewStoneSource", { diameter: 1, segments: 10 }, scene);
  const vertices = stone.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < vertices.length; i += 3) {
    const distortion = 0.91 + Math.sin(vertices[i] * 15 + vertices[i + 2] * 12) * 0.12;
    vertices[i] *= distortion;
    vertices[i + 1] *= distortion;
    vertices[i + 2] *= distortion;
  }
  stone.setVerticesData(VertexBuffer.PositionKind, vertices);
  const normals: number[] = [];
  VertexData.ComputeNormals(vertices, stone.getIndices()!, normals);
  stone.setVerticesData(VertexBuffer.NormalKind, normals);
  stone.material = stoneMaterial;
  stone.receiveShadows = true;
  stone.isVisible = false;
  for (let i = 0; i < 68; i++) {
    const rock = stone.createInstance(`previewRock${i}`);
    const side = i % 2 ? 1 : -1;
    const x = side * (course.halfWidth + 0.4 + random() * 11), z = -31 + random() * 43;
    const size = 0.12 + random() ** 2 * 1.5;
    rock.position.set(x, beachHeight(x, z) + size * 0.08, z);
    rock.scaling.set(size * 1.3, size * 0.65, size);
    rock.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3);
  }

  const wood = new PBRMaterial("previewDriftwood", scene);
  wood.albedoColor = new Color3(0.28, 0.24, 0.17);
  wood.metallic = 0;
  wood.roughness = 0.95;
  const branches: Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (course.halfWidth + 0.8 + random() * 4), z = -25 + random() * 33;
    const base = new Vector3(x, beachHeight(x, z) + 0.08, z);
    const length = 0.5 + random() * 1.4;
    const angle = random() * Math.PI * 2;
    const end = base.add(new Vector3(Math.cos(angle) * length, 0.05, Math.sin(angle) * length));
    branches.push(MeshBuilder.CreateTube(`driftwood${i}`, { path: [base, Vector3.Lerp(base,end,0.5).add(new Vector3(0,0.04,0)),end], radius: 0.035 + random() * 0.035, tessellation: 7, cap: Mesh.CAP_ALL }, scene));
    branches.push(MeshBuilder.CreateTube(`driftwoodFork${i}`, { path: [Vector3.Lerp(base,end,0.4),base.add(new Vector3(Math.cos(angle+0.5)*length*0.7,0.09,Math.sin(angle+0.5)*length*0.7))], radius: 0.023, tessellation: 6, cap: Mesh.CAP_ALL }, scene));
  }
  const logs = Mesh.MergeMeshes(branches, true, false);
  if (logs) { logs.name = "previewDriftwood"; logs.material = wood; logs.receiveShadows = true; }
}
