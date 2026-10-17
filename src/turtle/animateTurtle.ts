import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export interface FlipperRig {
  mesh: Mesh;
  baseY: number;
  baseZ: number;
  /** 1 for the turtle's left, -1 for its right, so the pair mirrors. */
  side: 1 | -1;
  role: "front" | "rear";
}

export interface TurtleAnimation {
  phase: number;
}

/**
 * Front flippers sweep together. The sweep gets larger and faster as speed rises,
 * and the shell bobs on a child node so the follow camera stays steady.
 */
export function stepTurtleAnimation(
  animation: TurtleAnimation,
  visual: TransformNode,
  flippers: readonly FlipperRig[],
  speed: number,
  dt: number,
): void {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const pace = Math.abs(speed);
  animation.phase += safeDt * (1.4 + pace * 1.7);
  const flap = Math.sin(animation.phase) * (0.08 + Math.min(0.5, pace * 0.11));

  for (const flipper of flippers) {
    const roleScale = flipper.role === "front" ? 1 : 0.6;
    flipper.mesh.rotation.z = flipper.baseZ + flap * flipper.side * roleScale;
    flipper.mesh.rotation.y = flipper.baseY + flap * 0.2 * roleScale;
  }

  visual.position.y = Math.sin(animation.phase) * (0.012 + Math.min(0.045, pace * 0.01));
  visual.rotation.x = Math.sin(animation.phase) * Math.min(0.07, pace * 0.018);
  visual.rotation.z = Math.sin(animation.phase * 0.5) * Math.min(0.04, pace * 0.008);
}
