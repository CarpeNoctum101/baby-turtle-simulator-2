import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { stepTurtleAnimation } from "./animateTurtle";
import { createOceanTurtle } from "./createOceanTurtle";

describe("user-supplied Blender ocean turtle", () => {
  it("keeps valid UVs, normals, skin weights and a small browser render budget", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const turtle = createOceanTurtle(scene);
      const meshes = turtle.root.getChildMeshes();
      expect(meshes).toHaveLength(4);
      expect(meshes.reduce((total, mesh) => total + mesh.getTotalIndices() / 3, 0)).toBeLessThan(10000);
      expect(turtle.flippers.filter(f => f.role === "front")).toHaveLength(2);
      expect(turtle.flippers.filter(f => f.role === "rear")).toHaveLength(2);
      for (const mesh of meshes) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
        const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
        const weights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
        const bones = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(normals.length).toBe(positions.length);
        expect(uvs.length).toBe(positions.length / 3 * 2);
        expect(uvs.every(Number.isFinite)).toBe(true);
        expect(mesh.getIndices()!.every(i => i >= 0 && i < positions.length / 3)).toBe(true);
        for (let i = 0; i < weights.length; i += 4) {
          expect(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3]).toBeCloseTo(1);
          expect(weights.slice(i, i + 4).every(w => w >= 0 && w <= 1)).toBe(true);
          expect(bones.slice(i, i + 4).every(b => b >= 0 && b <= 4)).toBe(true);
        }
        for (let i = 0; i < normals.length; i += 3) {
          expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 4);
        }
      }
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("deforms flippers while keeping the body anchored and rival rig independent", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const player = createOceanTurtle(scene);
      const rival = createOceanTurtle(scene, { id: "rival" });
      const skin = scene.getMeshByName("turtleOceanskin")!;
      const weights = skin.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      skin.skeleton!.prepare(true);
      const before = Array.from(skin.getPositionData(true)!);
      stepTurtleAnimation({ phase: 0 }, player.visual, player.flippers, 3, 1 / 30, true);
      skin.skeleton!.prepare(true);
      const after = skin.getPositionData(true)!;
      expect(before.some((value, i) => weights[Math.floor(i / 3) * 4 + 1] > 0.99 && Math.abs(value - after[i]) > 0.001)).toBe(true);
      for (let i = 0; i < before.length; i++) {
        if (weights[Math.floor(i / 3) * 4 + 1] === 0) expect(after[i]).toBeCloseTo(before[i], 5);
      }
      expect(player.root.position.asArray()).toEqual([0, 0, 0]);
      expect(player.skin).not.toBe(rival.skin);
      expect(skin.skeleton).not.toBe(scene.getMeshByName("rivalOceanskin")!.skeleton);
      expect(rival.flippers.every(f => f.mesh.rotation.lengthSquared() === 0)).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("folds the skinned model through the existing rocket doorway", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const turtle = createOceanTurtle(scene);
      for (const flipper of turtle.flippers) flipper.mesh.rotation.y = flipper.boardingY!;
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const mesh of turtle.root.getChildMeshes()) {
        mesh.skeleton!.prepare(true);
        const positions = mesh.getPositionData(true)!;
        for (let i = 0; i < positions.length; i += 3) {
          minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]); maxY = Math.max(maxY, positions[i + 1]);
        }
      }
      expect(minX).toBeGreaterThan(-0.6);
      expect(maxX).toBeLessThan(0.6);
      expect(maxY).toBeLessThan(1.44);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
