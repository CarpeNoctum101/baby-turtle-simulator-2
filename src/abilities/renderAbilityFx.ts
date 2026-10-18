import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { RacerEffects } from "./abilityState";
import type { BubbleShot } from "./bubble";
import { debrisLayout } from "./contacts";
import type { TideOrb } from "./pickups";
import { createItemBoxes } from "./createItemBoxes";
import { sandCloudAnchor, type SandCloud } from "./sandSpray";
import { oceanTrail } from "./trail";
import { course, waveZone } from "../movement/course";
import type { PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";

export interface AbilityFxFrame {
  time: number;
  orbs: readonly TideOrb[];
  clouds: readonly SandCloud[];
  playerEffects: RacerEffects;
  rivalEffects: RacerEffects;
  blockFlash: number;
  playerX: number;
  playerZ: number;
  trail: boolean;
  waveArmed: boolean;
  waveBoost: boolean;
  playerSkin: PlaceholderTurtle["skin"];
  playerShell: PlaceholderTurtle["shell"];
  rivalSkin: PlaceholderTurtle["skin"];
  rivalShell: PlaceholderTurtle["shell"];
  bubbles: readonly BubbleShot[];
  /** Bubbles closed around a trapped turtle or seagull. */
  traps: readonly { x: number; y: number; z: number }[];
}

export interface AbilityFx {
  sync: (frame: AbilityFxFrame) => void;
}

const black = new Color3(0, 0, 0);

/** Item boxes, debris, the shell bubble, sand puff, wave band and trail, created once. */
export function createAbilityFx(scene: Scene, playerVisual: TransformNode): AbilityFx {
  const orbs = createItemBoxes(scene);
  const clouds = Array.from({ length: 8 }, (_, index) => createCloud(scene, index));
  const shield = createShield(scene, playerVisual);
  const wave = createWaveBand(scene);
  const trail = createTrail(scene);
  const bubbleShots = createBubbleMeshes(scene, "bubbleShot", 4, 0.55);
  const bubbleTraps = createBubbleMeshes(scene, "bubbleTrap", 5, 1.7);
  createDebris(scene);

  return {
    sync(frame) {
      for (const [index, orb] of orbs.entries()) {
        const state = frame.orbs[index];
        const ready = (state?.respawnIn ?? 1) <= 0;
        orb.isVisible = ready;
        if (ready) {
          orb.position.y = 0.95 + Math.sin(frame.time * 2.4 + index) * 0.12;
          orb.rotation.set(0.12 + Math.sin(frame.time * 1.2 + index) * 0.08,
            frame.time * 0.9 + index * 0.65, 0.15);
        }
      }

      for (const [index, cloud] of clouds.entries()) {
        const state = frame.clouds[index];
        cloud.root.setEnabled(state !== undefined);
        if (!state) {
          continue;
        }
        const anchor = sandCloudAnchor(state);
        cloud.root.position.set(anchor.x, 0.28, anchor.z);
        cloud.root.rotation.y = state.heading;
        const life = state.duration > 0 ? Math.max(0.15, state.remaining / state.duration) : 0.15;
        cloud.root.scaling.set(life, life, life);
      }

      const shellUp = frame.playerEffects.shieldCharges > 0 && frame.playerEffects.shieldRemaining > 0;
      shield.isVisible = shellUp || frame.blockFlash > 0;
      const pop = shellUp ? 1 : 1.15 + frame.blockFlash;
      shield.scaling.set(pop, pop, pop);

      paintTurtle(frame.playerSkin, frame.playerShell, frame.playerEffects.frenzyRemaining > 0, shellUp, frame.time, false);
      paintTurtle(
        frame.rivalSkin,
        frame.rivalShell,
        false,
        false,
        frame.time,
        frame.rivalEffects.slowRemaining > 0 || frame.rivalEffects.stunRemaining > 0 || frame.rivalEffects.bubbleRemaining > 0,
      );
      placeBubbles(bubbleShots, frame.bubbles, 0.55, frame.time);
      placeBubbles(bubbleTraps, frame.traps, 0, frame.time);

      const pulse = frame.waveArmed ? 0.35 + Math.sin(frame.time * 8) * 0.2 : 0.12;
      wave.emissiveColor.set(frame.waveBoost ? 0.35 : 0.05, frame.waveBoost ? 0.55 : 0.25 + pulse, frame.waveBoost ? 0.7 : 0.4);

      const markers = frame.trail ? oceanTrail(frame.playerX, frame.playerZ, trail.length) : [];
      for (const [index, marker] of trail.entries()) {
        const point = markers[index];
        marker.isVisible = point !== undefined;
        if (point) {
          marker.position.set(point.x, 0.38 + Math.sin(frame.time * 4 + index) * 0.05, point.z);
        }
      }
    },
  };
}

function createCloud(scene: Scene, index: number): { root: TransformNode } {
  const root = new TransformNode(`sandCloud${index}`, scene);
  const material = new StandardMaterial(`sandCloudMaterial${index}`, scene);
  material.diffuseColor = new Color3(0.86, 0.74, 0.48);
  material.emissiveColor = new Color3(0.28, 0.22, 0.1);
  material.specularColor = new Color3(0.02, 0.02, 0.02);
  material.alpha = 0.72;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  const puffs = [
    { x: 0, y: 0.18, z: 0, diameter: 0.7 },
    { x: 0.38, y: 0.12, z: 0.15, diameter: 0.48 },
    { x: -0.36, y: 0.1, z: -0.1, diameter: 0.5 },
    { x: 0.05, y: 0.08, z: -0.42, diameter: 0.42 },
  ];
  for (const [puffIndex, puff] of puffs.entries()) {
    const mesh = MeshBuilder.CreateSphere(`sandPuff${index}-${puffIndex}`, { diameter: puff.diameter, segments: 8 }, scene);
    mesh.position.set(puff.x, puff.y, puff.z);
    mesh.material = material;
    mesh.parent = root;
  }
  root.setEnabled(false);
  return { root };
}

function createShield(scene: Scene, parent: TransformNode): Mesh {
  const shield = MeshBuilder.CreateSphere("shellGuard", { diameter: 1.7, segments: 16 }, scene);
  shield.position.y = 0.32;
  shield.parent = parent;
  const material = new StandardMaterial("shellGuardMaterial", scene);
  material.diffuseColor = new Color3(0.45, 0.85, 0.78);
  material.emissiveColor = new Color3(0.2, 0.65, 0.58);
  material.specularColor = new Color3(0.3, 0.35, 0.35);
  material.alpha = 0.28;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.backFaceCulling = false;
  shield.material = material;
  shield.isVisible = false;
  return shield;
}

function createWaveBand(scene: Scene): StandardMaterial {
  const depth = waveZone.maxZ - waveZone.minZ;
  const band = MeshBuilder.CreateGround(
    "waveZone",
    { width: course.halfWidth * 2 - 0.4, height: depth },
    scene,
  );
  band.position.set(0, 0.065, (waveZone.minZ + waveZone.maxZ) / 2);
  const material = new StandardMaterial("waveZoneMaterial", scene);
  material.diffuseColor = new Color3(0.35, 0.7, 0.82);
  material.emissiveColor = new Color3(0.05, 0.28, 0.4);
  material.specularColor = new Color3(0.15, 0.2, 0.22);
  material.alpha = 0.42;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  band.material = material;
  return material;
}

function createTrail(scene: Scene): Mesh[] {
  const material = new StandardMaterial("trailMaterial", scene);
  material.diffuseColor = new Color3(0.72, 0.62, 0.95);
  material.emissiveColor = new Color3(0.45, 0.32, 0.75);
  material.specularColor = new Color3(0.1, 0.1, 0.12);
  return Array.from({ length: 8 }, (_, index) => {
    const marker = MeshBuilder.CreateSphere(`trail${index}`, { diameter: 0.22, segments: 8 }, scene);
    marker.material = material;
    marker.isVisible = false;
    return marker;
  });
}

function createBubbleMeshes(scene: Scene, name: string, count: number, diameter: number): Mesh[] {
  const material = new StandardMaterial(`${name}Material`, scene);
  material.diffuseColor = new Color3(0.62, 0.86, 0.95);
  material.emissiveColor = new Color3(0.25, 0.55, 0.7);
  material.specularColor = new Color3(0.4, 0.45, 0.5);
  material.alpha = 0.38;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.backFaceCulling = false;
  return Array.from({ length: count }, (_, index) => {
    const mesh = MeshBuilder.CreateSphere(`${name}${index}`, { diameter, segments: 12 }, scene);
    mesh.material = material;
    mesh.isVisible = false;
    return mesh;
  });
}

function placeBubbles(
  meshes: readonly Mesh[],
  spots: readonly { x: number; y?: number; z: number }[],
  fallbackY: number,
  time: number,
): void {
  for (const [index, mesh] of meshes.entries()) {
    const spot = spots[index];
    mesh.isVisible = spot !== undefined;
    if (!spot) {
      continue;
    }
    const bob = 1 + Math.sin(time * 7 + index) * 0.04;
    mesh.position.set(spot.x, spot.y ?? fallbackY, spot.z);
    mesh.scaling.setAll(bob);
  }
}

function createDebris(scene: Scene): void {
  const wood = new StandardMaterial("debrisWood", scene);
  wood.diffuseColor = new Color3(0.42, 0.3, 0.16);
  wood.specularColor = new Color3(0.03, 0.03, 0.03);
  const shell = new StandardMaterial("debrisShell", scene);
  shell.diffuseColor = new Color3(0.78, 0.76, 0.7);
  shell.specularColor = new Color3(0.05, 0.05, 0.05);
  const kelp = new StandardMaterial("debrisKelp", scene);
  kelp.diffuseColor = new Color3(0.24, 0.4, 0.22);
  kelp.specularColor = new Color3(0.02, 0.02, 0.02);

  for (const debris of debrisLayout) {
    const mesh =
      debris.id === "kelp"
        ? MeshBuilder.CreateCylinder(debris.id, { diameter: 0.7, height: 0.16, tessellation: 8 }, scene)
        : MeshBuilder.CreateBox(debris.id, { width: debris.radius * 2.1, height: 0.18, depth: debris.radius * 1.6 }, scene);
    mesh.position.set(debris.x, 0.12, debris.z);
    mesh.material = debris.id === "kelp" ? kelp : debris.id === "shell-cluster" ? shell : wood;
  }
}

function paintTurtle(
  skin: PlaceholderTurtle["skin"],
  shell: PlaceholderTurtle["shell"],
  frenzy: boolean,
  shield: boolean,
  time: number,
  slowed: boolean,
): void {
  if (frenzy) {
    const pulse = 0.28 + Math.sin(time * 22) * 0.16;
    skin.emissiveColor.set(pulse, pulse * 0.45, 0.05);
  } else if (slowed) {
    skin.emissiveColor.set(0.22, 0.16, 0.05);
  } else {
    skin.emissiveColor.copyFrom(black);
  }
  if (shield) {
    shell.emissiveColor.set(0.12, 0.42, 0.36);
  } else {
    shell.emissiveColor.copyFrom(black);
  }
}
