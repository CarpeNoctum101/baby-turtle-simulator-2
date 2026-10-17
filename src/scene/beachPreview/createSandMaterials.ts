import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Scene } from "@babylonjs/core/scene";

/** Original, periodic sand grain and ripple normals. Generated once, never per frame. */
export function createSandMaterials(scene: Scene) {
  const size = 512;
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 3);
  const normal = new Uint8Array(size * size * 3);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      // Integer frequencies make the large features meet at every tile edge.
      const ripple = Math.sin(v * 8 + Math.sin(u * 2) * 1.3 + Math.sin(u * 5 + v) * 0.8) * 0.65
        + Math.sin(v * 13 + u * 3) * 0.25;
      const mottling = Math.sin(u * 3 + v * 2) * Math.cos(v * 4 - u);
      const grain = pixelNoise(x, y);
      const value = 211 + ripple * 2 + mottling * 7 + (grain - 0.5) * 21;
      const i = y * size + x;
      height[i] = ripple * 0.65 + (grain - 0.5) * 0.22;
      color.set([value, value * 0.965, value * 0.88], i * 3);
    }
  }
  const sample = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (sample(x - 1, y) - sample(x + 1, y)) * 1.8;
      const ny = (sample(x, y - 1) - sample(x, y + 1)) * 1.8;
      const length = Math.hypot(nx, ny, 1);
      normal.set([128 + (nx / length) * 127, 128 + (ny / length) * 127, 128 + 127 / length], (y * size + x) * 3);
    }
  }

  const albedo = RawTexture.CreateRGBTexture(color, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  albedo.name = "originalSandGrain512";
  const bump = RawTexture.CreateRGBTexture(normal, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  bump.name = "originalSandNormal512";
  bump.gammaSpace = false;
  bump.level = 0.35;
  for (const texture of [albedo, bump]) {
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
  }

  const dryColor = new Color3(0.88, 0.75, 0.53);
  const wetColor = new Color3(0.41, 0.35, 0.25);
  const makeMaterial = (name: string, tint: Color3, roughness: number) => {
    const material = new PBRMaterial(name, scene);
    material.albedoTexture = albedo;
    material.bumpTexture = bump;
    material.albedoColor = tint;
    material.metallic = 0;
    material.roughness = roughness;
    return material;
  };
  return {
    dry: makeMaterial("previewDrySand", dryColor, 0.96),
    wet: makeMaterial("previewWetSand", wetColor, 0.42),
    transition: makeMaterial("previewSandTransition", Color3.White(), 0.72),
    dryColor,
    wetColor,
  };
}

/** Use a four-metre tile on every mesh, so neighboring pieces keep the same grain scale. */
export function applySandUVs(mesh: Mesh): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return;
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    uvs.push((positions[i] * mesh.scaling.x + mesh.position.x) / 4, (positions[i + 2] * mesh.scaling.z + mesh.position.z) / 4);
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

function pixelNoise(x: number, y: number): number {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
