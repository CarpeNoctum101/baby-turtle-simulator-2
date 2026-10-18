import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export interface HeadRig {
  /** Parent the head, eyes and mouth to this node. Moving it forward stretches the neck. */
  head: TransformNode;
  /** Pushes the head `reach` metres forward and stretches a neck tube behind it. */
  setReach: (reach: number) => void;
}

/**
 * A head that can slide forward on a neck. Snappy's long neck and its snap lunge both use it.
 * At zero reach the neck tube is hidden, so the regular head looks exactly as before.
 */
export function createHeadRig(
  scene: Scene,
  parent: TransformNode,
  skin: StandardMaterial | PBRMaterial,
  id: string,
  neck: { baseZ: number; y: number; diameter: number },
): HeadRig {
  const head = new TransformNode(`${id}HeadRig`, scene);
  head.parent = parent;
  const tube = MeshBuilder.CreateCylinder(`${id}NeckExtension`, { height: 1, diameter: neck.diameter, tessellation: 12 }, scene);
  tube.rotation.x = Math.PI / 2;
  tube.material = skin;
  tube.parent = parent;
  tube.isVisible = false;
  return {
    head,
    setReach(reach) {
      const length = Math.max(0, reach);
      head.position.z = length;
      tube.isVisible = length > 0.02;
      // The tube is a unit cylinder turned to lie along Z, so its Y scale is its length.
      tube.scaling.y = Math.max(0.001, length + 0.15);
      tube.position.set(0, neck.y, neck.baseZ + (length - 0.15) / 2 + 0.15);
    },
  };
}
