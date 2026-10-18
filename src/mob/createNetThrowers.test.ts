import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { course } from "../movement/course";
import { createNetThrowers } from "./createNetThrowers";
import { createNetHazards, netThrowerSpawns } from "./netThrower";

describe("procedural humans and nets", () => {
  it("uses finite low-budget geometry and keeps the whole human outside the lane while throwing", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const renderer = createNetThrowers(scene, new TransformNode("player", scene), new TransformNode("rival", scene), true);
      const state = createNetHazards(netThrowerSpawns);
      expect(scene.meshes.length).toBeLessThan(35);
      expect(scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0)).toBeLessThan(20000);
      for (const mesh of scene.meshes) {
        expect(mesh.getVerticesData(VertexBuffer.PositionKind)!.every(Number.isFinite)).toBe(true);
        expect(mesh.getVerticesData(VertexBuffer.NormalKind)!.every(Number.isFinite)).toBe(true);
      }
      for (const time of [0, 0.4, 0.84]) {
        state.throwers.forEach(t => { t.phase = "aim"; t.time = time; t.target = { x: 0, z: t.z + 5 }; });
        renderer.sync(state, time, true);
        for (const actor of renderer.actors) {
          for (const mesh of actor.root.getChildMeshes()) {
            mesh.computeWorldMatrix(true);
            const box = mesh.getBoundingInfo().boundingBox;
            expect(actor.root.position.x < 0 ? box.maximumWorld.x < -course.halfWidth : box.minimumWorld.x > course.halfWidth).toBe(true);
          }
        }
      }
    } finally { scene.dispose(); engine.dispose(); }
  });

  it("shows warning, flight and caught ropes, then clears them for endings, online races and reset", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const renderer = createNetThrowers(scene, new TransformNode("player", scene), new TransformNode("rival", scene), false);
      const state = createNetHazards(netThrowerSpawns);
      state.throwers[0].phase = "aim";
      renderer.sync(state, 0, true);
      expect(renderer.markers[0].isEnabled()).toBe(true);
      expect(renderer.nets[0].isEnabled()).toBe(false);
      state.throwers[0].phase = "flight"; state.throwers[0].time = 0.5;
      state.slow.player = 2;
      renderer.sync(state, 1, true);
      expect(renderer.nets[0].position.y).toBeGreaterThan(2);
      expect(renderer.wraps[0].isEnabled()).toBe(true);
      expect(renderer.nets[0].geometry).toBe(renderer.nets[1].geometry);
      renderer.sync(state, 1, false);
      expect(renderer.actors.every(a => !a.root.isEnabled())).toBe(true);
      expect([...renderer.nets, ...renderer.wraps, ...renderer.markers].every(m => !m.isEnabled())).toBe(true);
      renderer.sync(createNetHazards(netThrowerSpawns), 1, true);
      expect(renderer.actors.every(a => a.root.isEnabled())).toBe(true);
      expect([...renderer.nets, ...renderer.wraps, ...renderer.markers].every(m => !m.isEnabled())).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
