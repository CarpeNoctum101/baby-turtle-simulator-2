import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { FlipperRig } from "./animateTurtle";
import type { PlaceholderTurtle } from "./createPlaceholderTurtle";
import { createSculptedMaterials } from "./createSculptedMaterials";
import { createHeadRig } from "./headRig";

/** Original crouching mutant turtle, using sculptural anatomy and weathered practical gear. */
export function createSculptedTurtle(scene: Scene, options: { id?: string; redMask?: boolean } = {}): PlaceholderTurtle {
  const id = options.id ?? "turtle";
  const root = new TransformNode(id, scene), visual = new TransformNode(`${id}Visual`, scene);
  visual.parent = root;
  const mat = createSculptedMaterials(scene, id, options.redMask ?? false);
  const flippers: FlipperRig[] = [];
  const staticParts = new Map<PBRMaterial, Mesh[]>();
  const headParts = new Map<PBRMaterial, Mesh[]>();
  const headRig = createHeadRig(scene, visual, mat.skin, id, { baseZ: 0.1, y: 1.045, diameter: 0.19 });
  const part = (mesh: Mesh, material: PBRMaterial, group = staticParts) => {
    const meshes = group.get(material) ?? [];
    meshes.push(mesh); group.set(material, meshes);
    return mesh;
  };
  const sphere = (name: string, position: Vector3, scale: Vector3, material: PBRMaterial, group = staticParts, segments = 6) => {
    const mesh = MeshBuilder.CreateSphere(`${id}${name}`, { diameter: 1, segments }, scene);
    mesh.position.copyFrom(position); mesh.scaling.copyFrom(scale);
    return part(mesh, material, group);
  };
  const tube = (name: string, path: Vector3[], radius: number, material: PBRMaterial, group = staticParts) =>
    part(MeshBuilder.CreateTube(`${id}${name}`, { path, radius, tessellation: 6, cap: Mesh.CAP_ALL }, scene), material, group);
  const muscle = (name: string, a: Vector3, b: Vector3, width: number, material: PBRMaterial, group: Map<PBRMaterial, Mesh[]>) => {
    const mesh = sphere(name, Vector3.Center(a, b), new Vector3(width, Vector3.Distance(a, b) + width * 0.4, width), material, group);
    const direction = b.subtract(a).normalize();
    const axis = Vector3.Cross(Vector3.Up(), direction);
    mesh.rotationQuaternion = axis.lengthSquared() > 0.000001
      ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y))))
      : Quaternion.RotationAxis(new Vector3(1, 0, 0), direction.y < 0 ? Math.PI : 0);
    return mesh;
  };

  sphere("Torso", new Vector3(0, 0.79, 0), new Vector3(0.67, 0.58, 0.38), mat.skin, staticParts, 16);
  sphere("Hips", new Vector3(0, 0.49, -0.05), new Vector3(0.54, 0.28, 0.36), mat.skin);
  sphere("Neck", new Vector3(0, 1.045, 0.095), new Vector3(0.28, 0.22, 0.27), mat.skin);
  sphere("Head", new Vector3(0, 1.18, 0.16), new Vector3(0.43, 0.39, 0.39), mat.skin, headParts, 24);
  sphere("Muzzle", new Vector3(0, 1.108, 0.325), new Vector3(0.37, 0.17, 0.25), mat.skin, headParts, 20);
  sphere("Jaw", new Vector3(0, 1.055, 0.27), new Vector3(0.31, 0.11, 0.25), mat.skin, headParts);
  sphere("ShellCore", new Vector3(0, 0.79, -0.17), new Vector3(0.82, 0.8, 0.35), mat.shell, staticParts, 24);

  // Chest plates are convex and separated by deep seams rather than a flat yellow slab.
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
    const plate = MeshBuilder.CreateCylinder(`${id}ChestPlate`, {
      height: 0.07, diameterTop: 0.9, diameterBottom: 1, tessellation: 6,
    }, scene);
    plate.scaling.set(row === 2 ? 0.255 : 0.29, 1, 0.19);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(side * 0.143, 0.96 - row * 0.16, 0.179 + (row === 1 ? 0.016 : 0));
    part(plate, mat.plastron);
  }
  const shellCenters = [
    ...[0.52, 0.76, 1.0].map(y => ({ x: 0, y })),
    ...[-1, 1].flatMap(side => [0.63, 0.89].map(y => ({ x: side * 0.23, y }))),
  ];
  for (const center of shellCenters) {
    const ring = Array.from({ length: 6 }, (_, i) => {
      const a = i * Math.PI / 3, x = center.x + Math.cos(a) * 0.15, y = center.y + Math.sin(a) * 0.143;
      return new Vector3(x, y, backOfShell(x, y) - 0.012);
    });
    const positions = [center.x, center.y, backOfShell(center.x, center.y) - 0.02, ...ring.flatMap(p => p.asArray())];
    const indices: number[] = [], uvs = [0.5, 0.5];
    for (let i = 0; i < 6; i++) {
      indices.push(0, (i + 1) % 6 + 1, i + 1);
      uvs.push(0.5 + Math.cos(i * Math.PI / 3) * 0.48, 0.5 + Math.sin(i * Math.PI / 3) * 0.48);
    }
    const data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.positions = positions; data.normals = normals; data.indices = indices; data.uvs = uvs;
    const scute = new Mesh(`${id}ShellScute`, scene); data.applyToMesh(scute); part(scute, mat.shell);
    const seam = MeshBuilder.CreateTube(`${id}ShellSeam`, {
      path: [...ring, ring[0]].map(p => p.add(new Vector3(0, 0, -0.004))),
      radius: 0.0035, tessellation: 4,
    }, scene);
    part(seam, mat.dark);
  }
  const rim = Array.from({ length: 49 }, (_, i) => {
    const a = i / 48 * Math.PI * 2;
    return new Vector3(Math.cos(a) * 0.40, 0.79 + Math.sin(a) * 0.39, -0.18);
  });
  tube("ShellRim", rim, 0.024, mat.shell);

  for (const side of [-1, 1] as const) {
    const armParts = new Map<PBRMaterial, Mesh[]>();
    const shoulder = new Vector3(side * 0.355, 0.89, 0.015);
    const elbow = new Vector3(side * 0.15, -0.23, 0.055);
    const wrist = new Vector3(side * 0.23, -0.48, 0.24);
    sphere("Deltoid", Vector3.Zero(), new Vector3(0.275, 0.27, 0.29), mat.skin, armParts, 12);
    muscle("Biceps", new Vector3(side * 0.015, -0.04, 0.015), elbow, 0.22, mat.skin, armParts);
    sphere("Elbow", elbow, new Vector3(0.19, 0.18, 0.19), mat.skin, armParts);
    muscle("Forearm", elbow, wrist, 0.18, mat.skin, armParts);
    sphere("Palm", wrist.add(new Vector3(side * 0.012, -0.032, 0.037)), new Vector3(0.19, 0.105, 0.2), mat.skin, armParts);
    for (let finger = 0; finger < 3; finger++) {
      const start = wrist.add(new Vector3((finger - 1) * 0.063, -0.038, 0.075));
      const joint = start.add(new Vector3(0, -0.014, 0.08));
      const tip = joint.add(new Vector3(0, -0.025, 0.06));
      muscle("Finger", start, joint, 0.055, mat.skin, armParts);
      muscle("FingerTip", joint, tip, 0.046, mat.skin, armParts);
    }
    sphere("Thumb", wrist.add(new Vector3(-side * 0.093, -0.016, 0.065)), new Vector3(0.07, 0.08, 0.13), mat.skin, armParts);
    sphere("ElbowPad", elbow.add(new Vector3(side * 0.065, 0, -0.005)), new Vector3(0.16, 0.19, 0.18), mat.leather, armParts);
    for (let wrap = 0; wrap < 4; wrap++) {
      const p = Vector3.Lerp(elbow, wrist, 0.56 + wrap * 0.105);
      const band = MeshBuilder.CreateTorus(`${id}WristWrap`, { diameter: 0.155, thickness: 0.022, tessellation: 10 }, scene);
      band.position.copyFrom(p); band.rotation.x = -0.6;
      part(band, mat.wraps, armParts);
    }
    const arm = merge(armParts, `${id}Arm${side}`, visual, mat.skin);
    arm.position.copyFrom(shoulder);
    flippers.push({ mesh: arm, side, role: "front", baseY: 0, baseZ: 0, boardingY: -side * 1.2, gait: "stride" });

    const legParts = new Map<PBRMaterial, Mesh[]>();
    const hip = new Vector3(side * 0.19, 0.51, -0.055);
    const knee = new Vector3(side * 0.13, -0.19, 0.09), ankle = new Vector3(side * 0.09, -0.38, 0.015);
    muscle("Thigh", Vector3.Zero(), knee, 0.265, mat.skin, legParts);
    sphere("Knee", knee, new Vector3(0.23, 0.21, 0.23), mat.skin, legParts);
    muscle("Calf", knee, ankle, 0.2, mat.skin, legParts);
    sphere("Foot", ankle.add(new Vector3(0, -0.026, 0.09)), new Vector3(0.225, 0.13, 0.29), mat.skin, legParts);
    for (const toe of [-1, 1]) {
      sphere("Toe", ankle.add(new Vector3(toe * 0.063, -0.037, 0.235)), new Vector3(0.10, 0.085, 0.17), mat.skin, legParts);
    }
    sphere("KneePad", knee.add(new Vector3(0, 0, 0.097)), new Vector3(0.19, 0.19, 0.075), mat.leather, legParts);
    for (let wrap = 0; wrap < 4; wrap++) {
      const p = Vector3.Lerp(knee, ankle, 0.56 + wrap * 0.1);
      const band = MeshBuilder.CreateTorus(`${id}AnkleWrap`, { diameter: 0.18, thickness: 0.021, tessellation: 10 }, scene);
      band.position.copyFrom(p); band.rotation.x = 0.32;
      part(band, mat.wraps, legParts);
    }
    const leg = merge(legParts, `${id}Leg${side}`, visual, mat.skin);
    leg.position.copyFrom(hip);
    flippers.push({ mesh: leg, side, role: "rear", baseY: 0, baseZ: 0, boardingY: 0, gait: "stride" });
  }

  // Worn harness, waist belt and shoulder buckles are separate from the natural shell.
  for (const path of [
    [new Vector3(-0.26, 1.03, 0.13), new Vector3(-0.12, 0.82, 0.26), new Vector3(0.21, 0.55, 0.19)],
    [new Vector3(-0.26, 1.03, -0.26), new Vector3(0, 0.79, -0.365), new Vector3(0.24, 0.57, -0.27)],
  ]) {
    const edges = [-1, 1].map(side => path.map(p => p.add(new Vector3(side * 0.028, side * 0.022, 0))));
    part(MeshBuilder.CreateRibbon(`${id}Harness`, { pathArray: edges, sideOrientation: Mesh.DOUBLESIDE }, scene), mat.leather);
    for (const edge of edges) tube("HarnessStitch", edge, 0.002, mat.wraps);
  }
  const belt = MeshBuilder.CreateRibbon(`${id}Belt`, { pathArray: [0.51, 0.567].map(y =>
    Array.from({ length: 33 }, (_, i) => {
      const a = i / 32 * Math.PI * 2;
      return new Vector3(Math.sin(a) * 0.285, y, Math.cos(a) * 0.205 - 0.025);
    })), sideOrientation: Mesh.DOUBLESIDE }, scene);
  part(belt, mat.leather);
  const buckle = MeshBuilder.CreateBox(`${id}Buckle`, { width: 0.09, height: 0.065, depth: 0.035 }, scene);
  buckle.position.set(0, 0.535, 0.199); part(buckle, mat.metal);

  for (const side of [-1, 1]) {
    sphere("EyeSocket", new Vector3(side * 0.108, 1.239, 0.35), new Vector3(0.113, 0.032, 0.05), mat.dark, headParts);
    const eye = sphere("Eye", new Vector3(side * 0.108, 1.238, 0.365), new Vector3(0.092, 0.023, 0.03), mat.eye, headParts, 12);
    eye.rotation.z = side * 0.12;
    sphere("Pupil", new Vector3(side * 0.105, 1.238, 0.382), new Vector3(0.024, 0.023, 0.012), mat.dark, headParts, 10);
    const brow = sphere("Brow", new Vector3(side * 0.106, 1.275, 0.319), new Vector3(0.19, 0.065, 0.1), mat.skin, headParts);
    brow.rotation.z = side * 0.12;
    sphere("Nostril", new Vector3(side * 0.061, 1.16, 0.443), new Vector3(0.023, 0.015, 0.014), mat.dark, headParts, 8);
  }
  tube("Mouth", [new Vector3(-0.14, 1.082, 0.36), new Vector3(-0.07, 1.075, 0.43),
    new Vector3(0.07, 1.075, 0.43), new Vector3(0.14, 1.087, 0.36)], 0.006, mat.dark, headParts);
  tube("CheekScar", [new Vector3(-0.16, 1.155, 0.37), new Vector3(-0.12, 1.135, 0.42), new Vector3(-0.09, 1.113, 0.437)], 0.0035, mat.plastron, headParts);

  // The mask has an open eye line, with fabric across the brow, cheeks and temples.
  for (const [low, high] of [[1.25, 1.295], [1.202, 1.225]]) {
    const mask = MeshBuilder.CreateRibbon(`${id}MaskFront`, { pathArray: [low, high].map(y =>
      Array.from({ length: 17 }, (_, i) => {
        const a = -1.2 + i / 16 * 2.4;
        const slant = y >= 1.25 && y < 1.28 ? Math.abs(Math.sin(a)) * 0.014 : 0;
        return new Vector3(Math.sin(a) * 0.225, y + slant, 0.16 + Math.cos(a) * 0.242);
      })), sideOrientation: Mesh.DOUBLESIDE }, scene);
    part(mask, mat.cloth, headParts);
  }
  const maskBack = MeshBuilder.CreateRibbon(`${id}MaskBack`, { pathArray: [1.201, 1.296].map(y =>
    Array.from({ length: 25 }, (_, i) => {
      const a = 1.13 + i / 24 * (Math.PI * 2 - 2.26);
      return new Vector3(Math.sin(a) * 0.222, y, 0.16 + Math.cos(a) * 0.21);
    })), sideOrientation: Mesh.DOUBLESIDE }, scene);
  part(maskBack, mat.cloth, headParts);
  const bridge = MeshBuilder.CreateBox(`${id}MaskBridge`, { width: 0.045, height: 0.09, depth: 0.025 }, scene);
  bridge.position.set(0, 1.25, 0.37); part(bridge, mat.cloth, headParts);
  sphere("MaskKnot", new Vector3(0.045, 1.247, -0.055), new Vector3(0.09, 0.07, 0.07), mat.cloth, headParts, 12);
  for (const side of [-1, 1]) {
    const tail = MeshBuilder.CreateRibbon(`${id}MaskTail`, { pathArray: [-0.021, 0.021].map(width => [
      new Vector3(0.04 + width, 1.246, -0.065), new Vector3(side * 0.1 + width, 1.15, -0.19),
      new Vector3(side * 0.12 + width, 1.0, -0.23), new Vector3(side * 0.17 + width * 0.3, 0.94, -0.19),
    ]), sideOrientation: Mesh.DOUBLESIDE }, scene);
    part(tail, mat.cloth, headParts);
  }
  merge(staticParts, `${id}Body`, visual, mat.skin);
  merge(headParts, `${id}Head`, headRig.head, mat.skin);
  return { root, visual, flippers, skin: mat.skin, shell: mat.shell, setHeadReach: headRig.setReach };

  function merge(groups: Map<PBRMaterial, Mesh[]>, name: string, parent: TransformNode, primary: PBRMaterial): Mesh {
    const primaryParts = groups.get(primary)!;
    const base = Mesh.MergeMeshes(primaryParts, true, false)!;
    base.name = name; base.material = primary; base.parent = parent; base.isPickable = false;
    for (const [material, meshes] of groups) {
      if (material === primary) continue;
      const merged = Mesh.MergeMeshes(meshes, true, false)!;
      merged.name = `${name}${material.name}`; merged.material = material;
      merged.parent = base; merged.isPickable = false;
    }
    return base;
  }
}

function backOfShell(x: number, y: number): number {
  return -0.17 - 0.175 * Math.sqrt(Math.max(0.02, 1 - (x / 0.41) ** 2 - ((y - 0.79) / 0.4) ** 2));
}
