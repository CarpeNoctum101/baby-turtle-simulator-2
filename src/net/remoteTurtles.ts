import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { AbilityId } from "../abilities/catalog";
import { oceanTrail } from "../abilities/trail";
import { createRemoteSample, pushRemoteSample, stepRemoteSample, type RemoteSample, type SamplePose } from "../../shared/interpolatePose";
import type { PoseMessage, PublicPlayer } from "../../shared/protocol";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
import type { PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createOceanTurtle } from "../turtle/createOceanTurtle";

const slotColors = [
  { skin: new Color3(0.42, 0.55, 0.28), shell: new Color3(0.45, 0.28, 0.14) },
  { skin: new Color3(0.62, 0.58, 0.4), shell: new Color3(0.25, 0.4, 0.48) },
  { skin: new Color3(0.55, 0.4, 0.32), shell: new Color3(0.36, 0.24, 0.18) },
  { skin: new Color3(0.4, 0.52, 0.36), shell: new Color3(0.22, 0.36, 0.28) },
  { skin: new Color3(0.58, 0.42, 0.48), shell: new Color3(0.32, 0.22, 0.34) },
  { skin: new Color3(0.4, 0.46, 0.58), shell: new Color3(0.2, 0.28, 0.4) },
  { skin: new Color3(0.62, 0.5, 0.32), shell: new Color3(0.42, 0.3, 0.16) },
  { skin: new Color3(0.38, 0.5, 0.48), shell: new Color3(0.18, 0.32, 0.3) },
] as const;

interface RemoteLook {
  frenzyUntil: number;
  shieldUntil: number;
  trailUntil: number;
  waveUntil: number;
  slowUntil: number;
}

/** Local clock times live on the turtle. Each effect stays up until its deadline, then the paint clears. */
interface RemoteTurtle extends RemoteLook {
  body: PlaceholderTurtle;
  animation: TurtleAnimation;
  sample: RemoteSample;
  rendered: SamplePose;
  shield: Mesh;
  trap: Mesh;
  net: Mesh;
  lift: number;
  trail: Mesh[];
  trailMaterial: StandardMaterial;
}

/**
 * Draws the other browsers' hatchlings.
 * Each one eases toward the latest pose instead of jumping on every message.
 */
export function createRemoteTurtles(scene: Scene) {
  const turtles = new Map<string, RemoteTurtle>();
  const pending = new Map<string, RemoteLook>();
  let selfId = "";

  const ensure = (player: PublicPlayer): RemoteTurtle => {
    const existing = turtles.get(player.id);
    if (existing) {
      return existing;
    }
    const paint = slotColors[player.slot] ?? slotColors[0];
    const pose = poseOf(player);
    const bodyId = remoteBodyId(player);
    const body = createOceanTurtle(scene, {
      id: bodyId,
      tint: Color3.Lerp(Color3.White(), paint.shell, 0.22),
    });
    const trail = createTrail(scene, bodyId);
    const remote: RemoteTurtle = {
      body,
      animation: { phase: 0 },
      sample: createRemoteSample(pose),
      rendered: pose,
      shield: createShield(scene, bodyId, body),
      trap: createTrap(scene, bodyId, body),
      net: createNetMark(scene, bodyId, body),
      lift: 0,
      trail: trail.markers,
      trailMaterial: trail.material,
      ...blankLook(),
      ...pending.get(player.id),
    };
    pending.delete(player.id);
    place(remote, pose);
    turtles.set(player.id, remote);
    return remote;
  };

  const drop = (id: string) => {
    const remote = turtles.get(id);
    if (!remote) {
      return;
    }
    disposeRemote(remote);
    turtles.delete(id);
    pending.delete(id);
  };

  const remember = (playerId: string, patch: Partial<RemoteLook>) => {
    const remote = turtles.get(playerId);
    if (remote) {
      Object.assign(remote, patch);
      return;
    }
    pending.set(playerId, { ...(pending.get(playerId) ?? blankLook()), ...patch });
  };

  return {
    setSelf(playerId: string) {
      selfId = playerId;
    },
    applyRoster(players: readonly PublicPlayer[]) {
      const seen = new Set<string>();
      for (const player of players) {
        if (player.id === selfId || player.place > 0) {
          continue;
        }
        seen.add(player.id);
        ensure(player);
      }
      for (const id of [...turtles.keys()]) {
        if (!seen.has(id)) {
          drop(id);
        }
      }
    },
    /** Keeps another hatchling's ability visible until the server time runs out. */
    showAbility(playerId: string, ability: AbilityId, untilLocalMs: number) {
      if (ability === "sand-spray") {
        return;
      }
      if (ability === "flipper-frenzy") {
        remember(playerId, { frenzyUntil: untilLocalMs });
      } else if (ability === "shell-guard") {
        remember(playerId, { shieldUntil: untilLocalMs });
      } else if (ability === "magnetic-sense") {
        remember(playerId, { trailUntil: untilLocalMs });
      } else {
        remember(playerId, { waveUntil: untilLocalMs });
      }
    },
    showSlow(playerId: string, untilLocalMs: number) {
      remember(playerId, { slowUntil: untilLocalMs });
    },
    clearShield(playerId: string) {
      remember(playerId, { shieldUntil: 0 });
    },
    remove(playerId: string) {
      drop(playerId);
    },
    showCatch(playerId: string, net: boolean, bubble: boolean, lift: number) {
      const remote = turtles.get(playerId);
      if (!remote) {
        return;
      }
      remote.net.isVisible = net;
      remote.trap.isVisible = bubble;
      remote.lift = lift;
    },
    applyPose(message: PoseMessage) {
      if (message.playerId === selfId) {
        return;
      }
      const remote = turtles.get(message.playerId);
      if (!remote) {
        return;
      }
      const pose = poseOf(message);
      remote.sample = pushRemoteSample(remote.rendered, pose);
    },
    step(dt: number, now = Date.now()) {
      for (const remote of turtles.values()) {
        const stepped = stepRemoteSample(remote.sample, dt);
        remote.sample = stepped.sample;
        remote.rendered = stepped.pose;
        place(remote, stepped.pose);
        const frenzy = remote.frenzyUntil > now;
        stepTurtleAnimation(remote.animation, remote.body.visual, remote.body.flippers, stepped.pose.speed, dt, frenzy);
        paintRemote(remote, now);
      }
    },
    clear() {
      for (const id of [...turtles.keys()]) {
        drop(id);
      }
    },
  };
}

function poseOf(pose: { x: number; z: number; heading: number; speed: number }): SamplePose {
  return { x: pose.x, z: pose.z, heading: pose.heading, speed: pose.speed };
}

function place(remote: RemoteTurtle, pose: SamplePose) {
  remote.body.root.position.set(pose.x, remote.lift, pose.z);
  remote.body.root.rotation.y = pose.heading;
}

function blankLook(): RemoteLook {
  return { frenzyUntil: 0, shieldUntil: 0, trailUntil: 0, waveUntil: 0, slowUntil: 0 };
}

function remoteBodyId(player: PublicPlayer): string {
  return `remote-${player.slot}-${player.id.slice(0, 8)}`;
}

function disposeRemote(remote: RemoteTurtle): void {
  for (const marker of remote.trail) {
    marker.dispose(false, false);
  }
  remote.trailMaterial.dispose();
  remote.body.root.dispose(false, true);
}

function paintRemote(remote: RemoteTurtle, now: number): void {
  const frenzy = remote.frenzyUntil > now;
  const shield = remote.shieldUntil > now;
  const slowed = remote.slowUntil > now;
  const wave = remote.waveUntil > now;
  const skin = remote.body.skin.emissiveColor;
  const shell = remote.body.shell.emissiveColor;
  if (frenzy) {
    const pulse = 0.28 + Math.sin(now / 1000 * 22) * 0.16;
    skin.set(pulse, pulse * 0.45, 0.05);
  } else if (slowed) {
    skin.set(0.22, 0.16, 0.05);
  } else if (wave) {
    skin.set(0.05, 0.2, 0.28);
  } else {
    skin.set(0, 0, 0);
  }
  if (shield) {
    shell.set(0.12, 0.42, 0.36);
  } else if (wave) {
    shell.set(0.05, 0.28, 0.4);
  } else {
    shell.set(0, 0, 0);
  }
  remote.shield.isVisible = shield;

  const points = remote.trailUntil > now ? oceanTrail(remote.rendered.x, remote.rendered.z, remote.trail.length) : [];
  for (const [index, marker] of remote.trail.entries()) {
    const point = points[index];
    marker.isVisible = point !== undefined;
    if (point) {
      marker.position.set(point.x, 0.38, point.z);
    }
  }
}

function createShield(scene: Scene, id: string, body: PlaceholderTurtle): Mesh {
  const shield = MeshBuilder.CreateSphere(`${id}Shield`, { diameter: 1.7, segments: 12 }, scene);
  shield.position.y = 0.32;
  shield.parent = body.visual;
  const material = new StandardMaterial(`${id}ShieldMaterial`, scene);
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

function createTrap(scene: Scene, id: string, body: PlaceholderTurtle): Mesh {
  const trap = MeshBuilder.CreateSphere(`${id}Bubble`, { diameter: 1.8, segments: 12 }, scene);
  trap.position.y = 0.4;
  trap.parent = body.visual;
  const material = new StandardMaterial(`${id}BubbleMaterial`, scene);
  material.diffuseColor = new Color3(0.55, 0.82, 0.95);
  material.emissiveColor = new Color3(0.25, 0.55, 0.7);
  material.alpha = 0.35;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.backFaceCulling = false;
  trap.material = material;
  trap.isVisible = false;
  return trap;
}

function createNetMark(scene: Scene, id: string, body: PlaceholderTurtle): Mesh {
  const net = MeshBuilder.CreateTorus(`${id}Net`, { diameter: 1.5, thickness: 0.08, tessellation: 16 }, scene);
  net.position.y = 0.2;
  net.parent = body.root;
  const material = new StandardMaterial(`${id}NetMaterial`, scene);
  material.diffuseColor = new Color3(0.9, 0.78, 0.45);
  material.emissiveColor = new Color3(0.35, 0.25, 0.08);
  net.material = material;
  net.isVisible = false;
  return net;
}

function createTrail(scene: Scene, id: string): { markers: Mesh[]; material: StandardMaterial } {
  const material = new StandardMaterial(`${id}Trail`, scene);
  material.diffuseColor = new Color3(0.72, 0.62, 0.95);
  material.emissiveColor = new Color3(0.45, 0.32, 0.75);
  material.specularColor = new Color3(0.1, 0.1, 0.12);
  const markers = Array.from({ length: 6 }, (_, index) => {
    const marker = MeshBuilder.CreateSphere(`${id}Trail${index}`, { diameter: 0.22, segments: 8 }, scene);
    marker.material = material;
    marker.isVisible = false;
    return marker;
  });
  return { markers, material };
}
