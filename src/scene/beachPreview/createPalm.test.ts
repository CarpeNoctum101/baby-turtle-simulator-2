import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createPalm } from "./createPalm";

describe("procedural palm asset", () => {
  it("produces finite geometry within a small browser asset budget, without collision", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const palm = createPalm(scene, new Vector3(-9.4, 0, -10));
      const meshes = palm.getChildMeshes();
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes.length).toBeLessThanOrEqual(8);
      let triangles = 0;
      for (const mesh of meshes) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(normals.length).toBe(positions.length);
        expect(normals.every(Number.isFinite)).toBe(true);
        const indices = mesh.getIndices()!;
        expect(indices.every((index) => index >= 0 && index < positions.length / 3)).toBe(true);
        expect(mesh.checkCollisions).toBe(false);
        triangles += indices.length / 3;
      }
      expect(triangles).toBeGreaterThan(1000);
      expect(triangles).toBeLessThan(12000);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
