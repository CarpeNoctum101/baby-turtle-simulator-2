import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { course } from "../../movement/course";
import { createCoconuts } from "./createCoconuts";

describe("fallen coconuts", () => {
  it("keeps the complete meshes off the track near both palms, sharing geometry", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const palms = [{ x: -course.halfWidth - 1.4, z: -10 }, { x: course.halfWidth + 1.4, z: -6 }];
      const root = createCoconuts(scene, palms);
      const coconuts = root.getChildMeshes();
      expect(coconuts).toHaveLength(8);
      expect(scene.geometries).toHaveLength(1);
      expect(coconuts[0].getTotalIndices() / 3).toBeLessThan(1500);
      for (const coconut of coconuts) {
        coconut.computeWorldMatrix(true);
        const bounds = coconut.getBoundingInfo().boundingBox;
        const gap = coconut.position.x < 0 ? -bounds.maximumWorld.x - course.halfWidth
          : bounds.minimumWorld.x - course.halfWidth;
        expect(gap).toBeGreaterThan(0.7);
        expect(palms.some(palm => Math.hypot(coconut.position.x - palm.x, coconut.position.z - palm.z) < 1.6)).toBe(true);
      }
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
