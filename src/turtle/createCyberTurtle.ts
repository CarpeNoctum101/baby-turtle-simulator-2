import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { createDetailedTurtle } from "./createDetailedTurtle";
import type { PlaceholderTurtle } from "./createPlaceholderTurtle";

/** Original neon cybernetic hatchling, built on the same crawl/flipper rig. */
export function createCyberTurtle(scene: Scene, options: { id?: string; magenta?: boolean } = {}): PlaceholderTurtle {
  const turtle = createDetailedTurtle(scene);
  const skin = turtle.skin as PBRMaterial, shell = turtle.shell as PBRMaterial;
  skin.albedoColor = new Color3(0.32, 0.38, 0.44);
  skin.metallic = 0.55;
  skin.roughness = 0.4;
  shell.albedoTexture = null;
  shell.albedoColor = new Color3(0.026, 0.037, 0.055);
  shell.metallic = 0.78;
  shell.roughness = 0.3;
  const armor = material("cyberGunmetal", new Color3(0.085, 0.11, 0.15), 0.82, 0.3);
  const yellow = material("cyberYellowTrim", new Color3(1, 0.72, 0.015), 0.5, 0.34);
  const cyan = material("cyberCyanCircuits", new Color3(0.005, 0.1, 0.13), 0.25, 0.22);
  cyan.emissiveColor = new Color3(0.02, 1.5, 1.9);
  if (options.magenta) {
    cyan.albedoColor = new Color3(0.17, 0.005, 0.08);
    cyan.emissiveColor = new Color3(1.7, 0.035, 0.85);
  }
  const pink = material("cyberMagentaLights", new Color3(0.2, 0.015, 0.06), 0.2, 0.3);
  pink.emissiveColor = new Color3(1.8, 0.015, 0.45);
  const rim = turtle.visual.getChildMeshes().find(mesh => mesh.name === "hatchlingShellRim");
  if (rim) rim.material = yellow;

  const plates: Mesh[] = [], outlines: Mesh[] = [];
  const centers = [
    ...[-0.38, -0.08, 0.22, 0.46].map(z => ({ x: 0, z })),
    ...[-1, 1].flatMap(side => [-0.27, 0.035, 0.31].map(z => ({ x: side * 0.28, z }))),
  ];
  for (const [index, center] of centers.entries()) {
    const ring = Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3;
      const x = center.x + Math.cos(angle) * 0.143;
      const z = center.z + Math.sin(angle) * 0.16;
      return new Vector3(x, shellHeight(x, z) + 0.025, z);
    });
    const top = new Vector3(center.x, shellHeight(center.x, center.z) + 0.028, center.z);
    const positions = [...top.asArray(), ...ring.flatMap(p => p.asArray()),
      ...ring.flatMap(p => [p.x, p.y - 0.024, p.z])];
    const indices: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i + 1, b = (i + 1) % 6 + 1;
      indices.push(0, b, a, a, b, b + 6, a, b + 6, a + 6);
    }
    const plate = new Mesh(`cyberArmorPlate${index}`, scene), data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.positions = positions; data.indices = indices; data.normals = normals; data.applyToMesh(plate);
    plates.push(plate);
    outlines.push(MeshBuilder.CreateTube(`cyberPlateCircuit${index}`, {
      path: [...ring, ring[0]].map(p => p.add(new Vector3(0, 0.006, 0))), radius: 0.006, tessellation: 4,
    }, scene));
  }
  attach(Mesh.MergeMeshes(plates, true, false)!, armor);
  attach(Mesh.MergeMeshes(outlines, true, false)!, cyan);
  const spine = MeshBuilder.CreateTube("cyberYellowSpine", {
    path: [-0.54, -0.4, -0.2, 0, 0.2, 0.4, 0.54].map(z => new Vector3(0, shellHeight(0, z) + 0.044, z)),
    radius: 0.012, tessellation: 6,
  }, scene);
  attach(spine, yellow);
  const visor = MeshBuilder.CreateSphere("cyberVisor", { diameter: 1, segments: 16 }, scene);
  visor.scaling.set(0.3, 0.075, 0.16);
  visor.position.set(0, 0.32, 1.06);
  attach(visor, cyan);
  for (const side of [-1, 1]) {
    const temple = MeshBuilder.CreateBox(`cyberTemple${side}`, { width: 0.065, height: 0.11, depth: 0.19 }, scene);
    temple.position.set(side * 0.155, 0.285, 0.925);
    attach(temple, yellow);
    const tailLight = MeshBuilder.CreateBox(`cyberTailLight${side}`, { width: 0.16, height: 0.035, depth: 0.025 }, scene);
    tailLight.position.set(side * 0.23, 0.35, -0.65);
    tailLight.rotation.y = side * -0.25;
    attach(tailLight, pink);
  }
  for (const [index, flipper] of turtle.flippers.entries()) {
    const front = flipper.role === "front";
    const plate = MeshBuilder.CreateBox(`cyberFlipperPlate${index}`, {
      width: front ? 0.3 : 0.17, height: 0.027, depth: front ? 0.15 : 0.11,
    }, scene);
    plate.position.set(front ? 0.3 : 0.19, 0.035, -0.04);
    attach(plate, armor);
    plate.parent = flipper.mesh;
    const strip = MeshBuilder.CreateBox(`cyberFlipperLight${index}`, {
      width: front ? 0.26 : 0.14, height: 0.009, depth: 0.018,
    }, scene);
    strip.position.set(front ? 0.3 : 0.19, 0.053, -0.04);
    attach(strip, cyan);
    strip.parent = flipper.mesh;
  }
  if (options.id) {
    turtle.root.name = options.id;
    turtle.visual.name = `${options.id}Visual`;
    const materials = new Set(turtle.root.getChildMeshes().map(mesh => mesh.material));
    for (const mesh of turtle.root.getChildMeshes()) mesh.name = `${options.id}-${mesh.name}`;
    for (const mat of materials) if (mat) mat.name = `${options.id}-${mat.name}`;
  }
  return turtle;

  function attach(mesh: Mesh, mat: PBRMaterial): void {
    mesh.parent = turtle.visual;
    mesh.material = mat;
    mesh.isPickable = false;
  }
  function material(name: string, color: Color3, metallic: number, roughness: number): PBRMaterial {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = color; mat.metallic = metallic; mat.roughness = roughness;
    return mat;
  }
}

function shellHeight(x: number, z: number): number {
  return 0.36 + 0.25 * Math.sqrt(Math.max(0.015, 1 - (x / 0.55) ** 2 - ((z + 0.04) / 0.72) ** 2));
}
