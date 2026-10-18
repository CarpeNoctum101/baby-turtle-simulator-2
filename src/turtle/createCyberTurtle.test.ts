import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { stepTurtleAnimation } from "./animateTurtle";
import { createCyberTurtle } from "./createCyberTurtle";

describe("cybernetic hatchling", () => {
  it("keeps armor on the existing animation rig within a browser geometry budget", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const turtle = createCyberTurtle(scene);
      expect(turtle.flippers).toHaveLength(4);
      expect(scene.getMeshByName("cyberVisor")?.parent).toBe(turtle.visual);
      let triangles = 0;
      for (const mesh of turtle.root.getChildMeshes()) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(mesh.getIndices()!.every(i => i >= 0 && i < positions.length / 3)).toBe(true);
        triangles += mesh.getTotalIndices() / 3;
      }
      expect(triangles).toBeLessThan(40000);
      for (const [i, flipper] of turtle.flippers.entries()) {
        expect(scene.getMeshByName(`cyberFlipperPlate${i}`)?.parent).toBe(flipper.mesh);
        expect(scene.getMeshByName(`cyberFlipperLight${i}`)?.parent).toBe(flipper.mesh);
      }
      stepTurtleAnimation({ phase: 0 }, turtle.visual, turtle.flippers, 3, 1 / 30);
      expect(turtle.root.position.asArray()).toEqual([0, 0, 0]);
      for (const flipper of turtle.flippers) expect(flipper.mesh.rotation.z).not.toBe(flipper.baseZ);
    } finally {
      scene.dispose(); engine.dispose();
    }
  });

  it("gives the rival its own nodes and light materials", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const player = createCyberTurtle(scene);
      const rival = createCyberTurtle(scene, { id: "rival", magenta: true });
      expect(scene.getTransformNodeByName("turtle")).toBe(player.root);
      expect(scene.getTransformNodeByName("rival")).toBe(rival.root);
      expect(scene.getMeshByName("rival-cyberVisor")?.isDescendantOf(rival.root)).toBe(true);
      expect(player.skin).not.toBe(rival.skin);
      expect(scene.getMaterialByName("cyberCyanCircuits")).not.toBe(scene.getMaterialByName("rival-cyberCyanCircuits"));
    } finally {
      scene.dispose(); engine.dispose();
    }
  });
});
