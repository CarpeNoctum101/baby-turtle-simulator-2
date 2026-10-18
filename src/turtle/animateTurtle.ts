import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export interface FlipperRig {
  mesh: TransformNode;
  baseY: number;
  baseZ: number;
  /** 1 for the turtle's left, -1 for its right, so the pair mirrors. */
  side: 1 | -1;
  role: "front" | "rear";
  /** Optional folded pose for arms/legs that use the same crawl rig. */
  boardingY?: number;
  /** Arms and legs stride; sea-turtle flippers retain the original paddle motion. */
  gait?: "stride" | "paddle";
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
  frenzy = false,
): void {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const pace = Math.abs(speed);
  const rate = frenzy ? 2.6 : 1;
  const amp = frenzy ? 1.9 : 1;
  animation.phase += safeDt * (1.4 + pace * 1.7) * rate;
  const flap = Math.sin(animation.phase) * (0.08 + Math.min(0.5, pace * 0.11)) * amp;

  for (const flipper of flippers) {
    const roleScale = flipper.role === "front" ? 1 : 0.6;
    if (flipper.gait === "paddle") {
      // The imported mesh uses weighted shoulder/hip pivots, keeping the flipper
      // roots joined to the shell. Lift from the ground rather than through it.
      const lift = (1 + Math.sin(animation.phase)) * Math.min(0.12, pace * 0.035) * amp;
      flipper.mesh.rotation.z = flipper.baseZ + lift * flipper.side * roleScale;
      flipper.mesh.rotation.y = flipper.baseY + flap * 0.4 * roleScale;
      continue;
    }
    if (flipper.gait === "stride") {
      const phase = animation.phase + (flipper.side === 1 ? 0 : Math.PI) + (flipper.role === "front" ? Math.PI : 0);
      const swing = Math.sin(phase) * Math.min(0.32, pace * 0.075) * amp;
      flipper.mesh.rotation.x = swing;
      flipper.mesh.rotation.z = flipper.baseZ + flap * flipper.side * 0.08;
      flipper.mesh.rotation.y = flipper.baseY + swing * 0.12;
      continue;
    }
    flipper.mesh.rotation.z = flipper.baseZ + flap * flipper.side * roleScale;
    flipper.mesh.rotation.y = flipper.baseY + flap * 0.2 * roleScale;
  }

  const lowCrawl = flippers.some(flipper => flipper.gait === "paddle");
  visual.position.y = Math.sin(animation.phase) * (lowCrawl ? 0.006 + Math.min(0.018, pace * 0.004) : 0.012 + Math.min(0.045, pace * 0.01));
  visual.rotation.x = Math.sin(animation.phase) * Math.min(lowCrawl ? 0.025 : 0.07, pace * 0.018);
  visual.rotation.z = Math.sin(animation.phase * 0.5) * Math.min(lowCrawl ? 0.016 : 0.04, pace * 0.008);
}
