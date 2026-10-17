import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";
import type { Seagull } from "./seagull";

/**
 * "Seagull" by Bwinji Shamutete (Sketchfab, MangyMedusa), CC BY 4.0.
 * https://sketchfab.com/3d-models/seagull-dd79fddb754f47caa3145e7d184e3e58
 */
export const seagullModelUrl = `${import.meta.env.BASE_URL}models/seagull.glb`;

/** Model-space fix-ups, in one place so the bird can be turned or resized without touching the rules. */
export const seagullModel = {
  scale: 0.55,
  /** Added to the gull's heading so the beak points the way it flies. */
  yawOffset: 0,
};

export interface SeagullMobs {
  sync: (seagulls: readonly Seagull[], time: number) => void;
}

/**
 * One model node per gull. The glTF is fetched once, and each gull gets its own copy of it.
 * Until the file arrives the gulls are hidden; if it fails, a plain stand-in bird is shown instead.
 */
export function createSeagullMobs(scene: Scene, seagulls: readonly Seagull[]): SeagullMobs {
  const rigs = seagulls.map((gull) => {
    const root = new TransformNode(`${gull.id}Root`, scene);
    const model = new TransformNode(`${gull.id}Model`, scene);
    model.parent = root;
    model.scaling.setAll(seagullModel.scale);
    root.setEnabled(false);
    return { root, model };
  });

  LoadAssetContainerAsync(seagullModelUrl, scene)
    .then((container) => {
      rigs.forEach((rig, index) => {
        const instance = container.instantiateModelsToScene((name) => `${seagulls[index]?.id ?? "gull"}-${name}`, false);
        for (const node of instance.rootNodes) {
          node.parent = rig.model;
        }
        rig.root.setEnabled(true);
      });
    })
    .catch((error: unknown) => {
      console.warn("The seagull model could not be loaded. Using a plain stand-in.", error);
      rigs.forEach((rig, index) => {
        buildStandIn(scene, rig.model, seagulls[index]?.id ?? "gull");
        rig.root.setEnabled(true);
      });
    });

  return {
    sync(current, time) {
      rigs.forEach((rig, index) => {
        const gull = current[index];
        if (!gull) {
          return;
        }
        const flapping = gull.y > 0.8;
        rig.root.position.set(gull.x, gull.y + (flapping ? Math.sin(time * 14 + index) * 0.06 : 0), gull.z);
        rig.root.rotation.y = gull.heading + seagullModel.yawOffset;
        rig.model.rotation.z = flapping ? Math.sin(time * 14 + index) * 0.1 : 0;
      });
    },
  };
}

function buildStandIn(scene: Scene, parent: TransformNode, id: string): void {
  const white = new StandardMaterial(`${id}StandInWhite`, scene);
  white.diffuseColor = new Color3(0.93, 0.94, 0.95);
  const body = MeshBuilder.CreateSphere(`${id}StandInBody`, { diameter: 0.6, segments: 8 }, scene);
  body.scaling.set(0.8, 0.8, 1.4);
  body.material = white;
  body.parent = parent;
  const wings = MeshBuilder.CreateBox(`${id}StandInWings`, { width: 1.9, height: 0.04, depth: 0.5 }, scene);
  wings.material = white;
  wings.parent = parent;
}
