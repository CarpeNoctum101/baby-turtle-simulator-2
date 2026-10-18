import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";

/** Locally generated pores, growth rings, woven cloth and worn leather; no image downloads. */
export function createSculptedMaterials(scene: Scene, id: string, redMask: boolean) {
  const skin = textured("Skin", 256, [87, 108, 61], "skin", 0.73);
  const shell = textured("Shell", 256, [88, 64, 36], "shell", 0.7);
  const plastron = textured("Plastron", 128, [153, 123, 74], "shell", 0.76);
  if (plastron.bumpTexture) plastron.bumpTexture.level = 0.14;
  const leather = textured("Leather", 64, [50, 34, 22], "leather", 0.82);
  const cloth = textured("Mask", 64, redMask ? [123, 28, 22] : [23, 61, 109], "cloth", 0.9);
  const wraps = textured("Wraps", 64, [162, 147, 114], "cloth", 0.95);
  const metal = flat("Buckles", new Color3(0.32, 0.29, 0.21), 0.7, 0.57);
  const eye = flat("Eyes", new Color3(0.77, 0.72, 0.51), 0, 0.19);
  const dark = flat("Creases", new Color3(0.025, 0.02, 0.012), 0, 0.78);
  skin.albedoColor = redMask ? new Color3(0.86, 0.91, 0.78) : new Color3(1, 1, 0.93);
  return { skin, shell, plastron, leather, cloth, wraps, metal, eye, dark };

  function flat(name: string, color: Color3, metallic: number, roughness: number): PBRMaterial {
    const material = new PBRMaterial(`${id}Sculpted${name}`, scene);
    material.albedoColor = color;
    material.metallic = metallic;
    material.roughness = roughness;
    return material;
  }
  function textured(name: string, size: number, color: number[], kind: "skin" | "shell" | "cloth" | "leather", roughness: number) {
    const pixels = new Uint8Array(size * size * 3), heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const grain = hash - Math.floor(hash) - 0.5;
      const mottle = Math.sin(u * 3 + Math.cos(v * 2)) * Math.sin(v * 4 - Math.sin(u * 2));
      let relief: number, variation: number;
      if (kind === "skin") {
        const row = Math.floor(y / 10), px = ((x + (row % 2) * 5) % 10) / 10 - 0.5;
        const py = (y % 10) / 10 - 0.5;
        const pebble = Math.max(0, 1 - Math.hypot(px, py * 0.9) * 2);
        relief = pebble * 0.42 + grain * 0.035 + Math.sin(u * 13 + Math.sin(v * 4)) * 0.018;
        variation = pebble * 14 + mottle * 16 + grain * 10;
      } else if (kind === "shell") {
        const rings = Math.sin(Math.hypot((x - size / 2) * 0.8, y - size / 2) * 0.7 + mottle * 2);
        const scratches = Math.max(0, Math.sin(u * 31 + v * 3) - 0.95) * 20;
        relief = rings * 0.04 + mottle * 0.05 + grain * 0.03 - scratches * 0.03;
        variation = mottle * 20 + rings * 5 + grain * 8 + scratches * 5;
      } else if (kind === "cloth") {
        const weave = ((x % 4 < 2) !== (y % 4 < 2) ? 1 : -1);
        relief = weave * 0.05 + grain * 0.02;
        variation = weave * 6 + mottle * 8 + grain * 8;
      } else {
        const cracks = Math.pow(Math.abs(Math.sin(u * 17 + Math.sin(v * 7))), 20);
        relief = mottle * 0.08 - cracks * 0.045 + grain * 0.03;
        variation = mottle * 10 + grain * 11 - cracks * 8;
      }
      const i = y * size + x;
      pixels.set(color.map(channel => Math.max(0, Math.min(255, channel + variation))), i * 3);
      heights[i] = relief;
    }
    const normals = new Uint8Array(size * size * 3);
    const height = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * 1.5;
      const ny = (height(x, y - 1) - height(x, y + 1)) * 1.5;
      const length = Math.hypot(nx, ny, 1);
      normals.set([128 + nx / length * 127, 128 + ny / length * 127, 128 + 127 / length], (y * size + x) * 3);
    }
    const material = flat(name, Color3.White(), 0, roughness);
    material.albedoTexture = RawTexture.CreateRGBTexture(pixels, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    material.albedoTexture.name = `${id}Original${name}Color${size}`;
    const normal = RawTexture.CreateRGBTexture(normals, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    normal.name = `${id}Original${name}Normal${size}`;
    normal.gammaSpace = false;
    normal.level = kind === "skin" ? 0.65 : 0.4;
    material.bumpTexture = normal;
    material.specularIntensity = kind === "skin" ? 0.35 : 0.5;
    return material;
  }
}
