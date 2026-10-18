import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export interface BirdWingRig {
  update: (time: number, airborne: boolean, diving: boolean) => void;
}

/** The supplied gull is a static, perched mesh. Two weighted shoulder/wing pairs
 * unfold its existing feathered wings, then beat them without moving head or feet.
 * Vertex data is prepared once; deformation happens in Babylon's vertex shader.
 */
export function createBirdWingRig(mesh: Mesh, phase = 0): BirdWingRig {
  const scene = mesh.getScene();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  mesh.makeGeometryUnique();
  const skeleton = new Skeleton(`${mesh.name}WingRig`, `${mesh.name}WingRig`, scene);
  const body = new Bone(`${mesh.name}Body`, skeleton, null, Matrix.Identity());
  const wings = [-1, 1].map(side => {
    const shoulder = new TransformNode(`${mesh.name}Shoulder${side}`, scene);
    shoulder.parent = mesh;
    shoulder.position.set(side * 0.19, 0.08, 0.35);
    const arm = new Bone(`${mesh.name}ShoulderBone${side}`, skeleton, body,
      Matrix.Translation(shoulder.position.x, shoulder.position.y, shoulder.position.z));
    arm.linkTransformNode(shoulder);
    const feathers = new TransformNode(`${mesh.name}Feathers${side}`, scene);
    feathers.parent = shoulder;
    const bone = new Bone(`${mesh.name}WingBone${side}`, skeleton, arm, Matrix.Identity());
    bone.linkTransformNode(feathers);
    return { side, shoulder, feathers, index: bone.getIndex() };
  });
  const indices: number[] = [], weights: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const side = x < 0 ? wings[0] : wings[1];
    const weight = wingWeight(x, y, z);
    indices.push(0, side.index, 0, 0); weights.push(1 - weight, weight, 0, 0);
  }
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, indices);
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, weights);
  mesh.skeleton = skeleton; mesh.numBoneInfluencers = 2;
  // Unfolded feathers extend beyond the perched silhouette; keep them in the view.
  mesh.alwaysSelectAsActiveMesh = true;
  let spread = 0, lastTime = 0;
  return {
    update(time, airborne, diving) {
      const dt = Math.max(0, Math.min(0.05, time - lastTime)); lastTime = time;
      spread += ((airborne ? 1 : 0) - spread) * (1 - Math.exp(-dt * 10));
      for (const wing of wings) {
        wing.feathers.rotation.y = -wing.side * 1.5 * spread;
        const beat = diving ? 0.04 : Math.sin(time * 10 + phase) * 0.8;
        wing.shoulder.rotation.z = wing.side * (0.12 + beat) * spread;
      }
      skeleton.prepare(true);
    },
  };
}

/** Mesh-local coordinates: head/feet and the central torso retain zero wing weight. */
export function wingWeight(x: number, y: number, z: number): number {
  return smooth(0.12, 0.25, Math.abs(x)) * smooth(-0.60, -0.25, y)
    * (1 - smooth(0.45, 0.62, y)) * (1 - smooth(0.28, 0.48, z));
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
