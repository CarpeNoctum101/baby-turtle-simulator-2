import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createDetailedTurtle } from "./createDetailedTurtle";
import { stepTurtleAnimation } from "./animateTurtle";

describe("detailed hatchling", () => {
  it("keeps the animation contract and bounds its geometry without moving the logical root", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const turtle = createDetailedTurtle(scene);
      expect(turtle.flippers.filter(f => f.role === "front")).toHaveLength(2);
      expect(turtle.flippers.filter(f => f.role === "rear")).toHaveLength(2);
      let triangles = 0;
      for (const mesh of turtle.root.getChildMeshes()) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(normals.length).toBe(positions.length);
        expect(normals.every(Number.isFinite)).toBe(true);
        expect(mesh.getIndices()!.every(i => i >= 0 && i < positions.length / 3)).toBe(true);
        triangles += mesh.getTotalIndices() / 3;
      }
      expect(triangles).toBeLessThan(35000);
      stepTurtleAnimation({phase:0},turtle.visual,turtle.flippers,3,1/30);
      expect(turtle.root.position.length()).toBe(0);
      for (const flipper of turtle.flippers) expect(flipper.mesh.rotation.z).not.toBe(flipper.baseZ);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
