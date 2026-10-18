import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { describe, expect, it } from "vitest";
import { stepTurtleAnimation } from "./animateTurtle";
import { createSculptedTurtle } from "./createSculptedTurtle";

describe("sculpted mutant turtle", () => {
  it("keeps finite sculpted geometry, four animated limbs and a bounded render budget", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const turtle = createSculptedTurtle(scene);
      expect(turtle.flippers.filter(limb => limb.role === "front")).toHaveLength(2);
      expect(turtle.flippers.filter(limb => limb.role === "rear")).toHaveLength(2);
      let triangles = 0;
      const meshes = turtle.root.getChildMeshes();
      expect(meshes.length).toBeLessThanOrEqual(24);
      for (const mesh of meshes) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(normals.every(Number.isFinite)).toBe(true);
        expect(normals.length).toBe(positions.length);
        expect(mesh.getIndices()!.every(index => index >= 0 && index < positions.length / 3)).toBe(true);
        triangles += mesh.getTotalIndices() / 3;
      }
      expect(triangles).toBeLessThan(35000);
      stepTurtleAnimation({ phase: 0 }, turtle.visual, turtle.flippers, 3, 1 / 30);
      expect(turtle.root.position.asArray()).toEqual([0, 0, 0]);
      for (const limb of turtle.flippers) expect(limb.mesh.rotation.z).not.toBe(limb.baseZ);
      const legs = turtle.flippers.filter(limb => limb.role === "rear");
      expect(legs[0].mesh.rotation.x).not.toBe(0);
      expect(legs[0].mesh.rotation.x).toBeCloseTo(-legs[1].mesh.rotation.x);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("folds within the existing rocket doorway and gives the rival independent materials", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const player = createSculptedTurtle(scene);
      const rival = createSculptedTurtle(scene, { id: "rival", redMask: true });
      expect(scene.getTransformNodeByName("turtle")).toBe(player.root);
      expect(scene.getTransformNodeByName("rival")).toBe(rival.root);
      expect(player.skin).not.toBe(rival.skin);
      for (const limb of player.flippers) {
        limb.mesh.rotation.y = limb.boardingY!;
        limb.mesh.rotation.z = 0;
      }
      for (const mesh of player.root.getChildMeshes()) {
        const world = mesh.computeWorldMatrix(true);
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          const p = Vector3.TransformCoordinates(new Vector3(positions[i], positions[i + 1], positions[i + 2]), world);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        expect(minX, mesh.name).toBeGreaterThan(-0.6);
        expect(maxX, mesh.name).toBeLessThan(0.6);
        expect(maxY, mesh.name).toBeLessThan(1.44);
      }
    } finally { scene.dispose(); engine.dispose(); }
  });
});
