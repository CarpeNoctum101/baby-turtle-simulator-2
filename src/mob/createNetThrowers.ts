import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { beachHeight } from "../scene/beachPreview/landscape";
import { netRules, netThrowerSpawns, type NetHazards } from "./netThrower";

/** Original, locally modelled beachgoers and reusable rope meshes. No downloads. */
export function createNetThrowers(scene: Scene, player: TransformNode, rival: TransformNode, preview: boolean) {
  const material = (name: string, color: string, roughness = 0.85) => {
    const mat = new PBRMaterial(name, scene);
    mat.albedoColor = Color3.FromHexString(color); mat.roughness = roughness; mat.metallic = 0;
    return mat;
  };
  const skin = material("netterSkin", "#a96840");
  const shorts = material("netterShorts", "#263e52");
  const straw = material("netterStraw", "#d8b37a");
  const dark = material("netterDetails", "#263130");
  const rope = material("netRope", "#e6c58a");
  const shirts = [material("netterCoralShirt", "#d9684b"), material("netterTealShirt", "#338c85")];
  const warning = new StandardMaterial("netLandingWarning", scene);
  warning.diffuseColor = warning.emissiveColor = Color3.FromHexString("#ffc05e");
  warning.disableLighting = true; warning.alpha = 0.65;

  const actors = netThrowerSpawns.map((spawn, i) => {
    const root = new TransformNode(spawn.id, scene);
    root.position.set(spawn.x, preview ? beachHeight(spawn.x, spawn.z) : 0.04, spawn.z);
    root.rotation.y = -spawn.side * Math.PI / 2;
    const groups = new Map<PBRMaterial, Mesh[]>();
    const part = (name: string, at: number[], scale: number[], mat: PBRMaterial) => {
      const mesh = MeshBuilder.CreateSphere(`${spawn.id}${name}`, { diameter: 1, segments: 6 }, scene);
      mesh.position.set(at[0], at[1], at[2]); mesh.scaling.set(scale[0], scale[1], scale[2]);
      const list = groups.get(mat) ?? []; list.push(mesh); groups.set(mat, list);
      return mesh;
    };
    // Relaxed, planted stance; shoulders and face look toward the race lane.
    for (const side of [-1, 1]) {
      part("Calf", [side * 0.24, 0.6, 0], [0.27, 1.12, 0.28], skin);
      part("Foot", [side * 0.24, 0.12, 0.13], [0.31, 0.21, 0.55], dark);
      part("Shorts", [side * 0.24, 1.3, 0], [0.48, 0.78, 0.49], shorts);
    }
    part("Torso", [0, 2.04, 0], [1.04, 1.27, 0.58], shirts[i]);
    part("Collar", [0, 2.62, 0.02], [0.4, 0.16, 0.36], straw);
    part("Neck", [0, 2.73, 0], [0.3, 0.36, 0.29], skin);
    part("Head", [0, 3.02, 0.02], [0.51, 0.63, 0.49], skin);
    part("Nose", [0, 3.02, 0.28], [0.13, 0.16, 0.2], skin);
    for (const side of [-1, 1]) {
      part("Ear", [side * 0.26, 3.01, 0.02], [0.13, 0.2, 0.12], skin);
      part("Sunglasses", [side * 0.12, 3.11, 0.24], [0.2, 0.12, 0.09], dark);
    }
    part("HatBrim", [0, 3.3, 0.02], [1.01, 0.1, 0.89], straw);
    part("HatCrown", [0, 3.43, 0.02], [0.59, 0.33, 0.56], straw);
    part("HatBand", [0, 3.33, 0.02], [0.62, 0.1, 0.59], dark);
    const restingArm = part("RestingArm", [-0.58, 2.04, 0.08], [0.26, 0.95, 0.28], skin);
    restingArm.rotation.x = -0.2;
    // Merge static pieces by material: five draw calls for each static body.
    for (const [mat, pieces] of groups) {
      const mesh = Mesh.MergeMeshes(pieces, true, true)!;
      mesh.name = `${spawn.id}-${mat.name}`; mesh.material = mat; mesh.parent = root;
      mesh.isPickable = false; mesh.receiveShadows = true;
    }
    const arm = new TransformNode(`${spawn.id}ThrowingShoulder`, scene);
    arm.parent = root; arm.position.set(0.56, 2.49, 0);
    const forearm = MeshBuilder.CreateCapsule(`${spawn.id}ThrowingArm`, { height: 0.96, radius: 0.13, tessellation: 8, subdivisions: 1 }, scene);
    forearm.material = skin; forearm.parent = arm; forearm.position.y = -0.4;
    const hand = MeshBuilder.CreateSphere(`${spawn.id}Hand`, { diameter: 0.3, segments: 6 }, scene);
    hand.material = skin; hand.parent = arm; hand.position.y = -0.88;
    const sleeve = MeshBuilder.CreateSphere(`${spawn.id}Sleeve`, { diameter: 0.38, segments: 6 }, scene);
    sleeve.material = shirts[i]; sleeve.parent = arm; sleeve.position.y = -0.1;
    const coil = MeshBuilder.CreateTorus(`${spawn.id}SpareRope`, { diameter: 0.5, thickness: 0.1, tessellation: 16 }, scene);
    coil.parent = root; coil.position.set(-0.61, 1.55, 0.18); coil.rotation.x = Math.PI / 2; coil.material = rope;
    for (const mesh of root.getChildMeshes()) mesh.isPickable = false;
    return { root, arm, coil };
  });
  const shadowList = scene.getLightByName("sunrise")?.getShadowGenerator()?.getShadowMap()?.renderList;
  if (shadowList) for (const actor of actors) shadowList.push(...actor.root.getChildMeshes());

  const netTemplate = makeRopeMesh(scene, false); netTemplate.material = rope;
  const nets = actors.map((_, i) => i === 0 ? netTemplate : netTemplate.clone(`thrownNet${i}`)!);
  const markers = actors.map((_, i) => {
    const mesh = MeshBuilder.CreateTorus(`netLanding${i}`, { diameter: netRules.catchRadius * 2, thickness: 0.045, tessellation: 24 }, scene);
    mesh.material = warning; mesh.isPickable = false; mesh.setEnabled(false); return mesh;
  });
  const wrap = makeRopeMesh(scene, true); wrap.material = rope;
  const wraps = [wrap, wrap.clone("rivalCaughtNet")!];
  wraps.forEach((mesh, i) => { mesh.parent = i === 0 ? player : rival; mesh.setEnabled(false); });
  nets.forEach(mesh => mesh.setEnabled(false));
  return {
    actors, nets, wraps, markers,
    sync(state: NetHazards, time: number, visible: boolean) {
      for (let i = 0; i < actors.length; i++) {
        const actor = actors[i], net = nets[i], marker = markers[i], value = state.throwers[i];
        actor.root.setEnabled(visible && !!value);
        net.setEnabled(visible && !!value && (value.phase === "flight" || value.phase === "ground"));
        marker.setEnabled(visible && !!value && (value.phase === "aim" || value.phase === "flight"));
        if (!visible || !value) continue;
        const yaw = Math.atan2(value.target.x - value.x, value.target.z - value.z);
        if (value.phase === "aim" || value.phase === "flight") actor.root.rotation.y = yaw;
        const windup = value.phase === "aim" ? value.time / netRules.windupSeconds : 0;
        actor.arm.rotation.x = value.phase === "aim" ? 0.3 + windup * 2.45
          : value.phase === "flight" ? -1.8 * Math.max(0, 1 - value.time / 0.65) : -0.08;
        actor.arm.rotation.z = -0.15;
        actor.coil.setEnabled(value.phase !== "flight");
        marker.position.set(value.target.x, 0.075, value.target.z);
        marker.visibility = 0.65 + Math.sin(time * 9) * 0.2;
        if (value.phase === "flight") {
          const t = Math.min(1, value.time / netRules.flightSeconds);
          const startX = value.x + Math.sin(yaw) * 0.75, startZ = value.z + Math.cos(yaw) * 0.75;
          net.position.set(startX + (value.target.x - startX) * t,
            0.1 + (actor.root.position.y + 2.4) * (1 - t) + Math.sin(t * Math.PI) * 4,
            startZ + (value.target.z - startZ) * t);
          net.scaling.setAll(0.25 + t * 0.75); net.rotation.y = t * Math.PI;
        } else if (value.phase === "ground") {
          net.position.set(value.target.x, 0.1, value.target.z); net.scaling.setAll(1);
        }
      }
      wraps[0].setEnabled(visible && state.slow.player > 0);
      wraps[1].setEnabled(visible && state.slow.rival > 0);
    },
  };
}

/** Thin ropes use actual geometry, merged once and cloned with shared buffers. */
function makeRopeMesh(scene: Scene, draped: boolean): Mesh {
  const pieces: Mesh[] = [], radius = draped ? 1.05 : netRules.catchRadius;
  const rope = (path: Vector3[]) => pieces.push(MeshBuilder.CreateTube("netStrand", {
    path, radius: draped ? 0.014 : 0.016, tessellation: 4,
  }, scene));
  const height = (x: number, z: number) => draped ? 0.13 + 0.62 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (radius * radius))) : 0;
  for (const swapped of [false, true]) {
    for (let row = -4; row <= 4; row++) {
      const a = row * radius / 5, extent = Math.sqrt(radius * radius - a * a);
      const samples = draped ? 9 : 2;
      const path = Array.from({ length: samples }, (_, i) => {
        const b = -extent + i / (samples - 1) * extent * 2;
        const x = swapped ? b : a, z = swapped ? a : b;
        return new Vector3(x, height(x, z), z * (draped ? 1.35 : 1));
      });
      rope(path);
    }
  }
  rope(Array.from({ length: 41 }, (_, i) => {
    const angle = i / 40 * Math.PI * 2, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    return new Vector3(x, height(x, z), z * (draped ? 1.35 : 1));
  }));
  const mesh = Mesh.MergeMeshes(pieces, true, true)!;
  mesh.name = draped ? "playerCaughtNet" : "thrownNet0"; mesh.isPickable = false;
  return mesh;
}
