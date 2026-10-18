import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createBirdWingRig, wingWeight } from "../src/mob/createBirdWingRig";

describe("actual seagull wing deformation", () => {
  it("flaps the supplied static mesh while keeping head, feet and torso anchored", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const glb = readFileSync(new URL("../public/models/seagull.glb", import.meta.url));
      const jsonLength = glb.readUInt32LE(12);
      const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
      const primitive = json.meshes[0].primitives[0];
      const accessor = json.accessors[primitive.attributes.POSITION];
      const view = json.bufferViews[accessor.bufferView];
      const binaryStart = 20 + jsonLength + 8;
      const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const positions = Array.from({ length: accessor.count * 3 }, (_, i) => glb.readFloatLE(start + i * 4));
      const mesh = new Mesh("gull", scene), vertices = new VertexData();
      vertices.positions = positions; vertices.applyToMesh(mesh);
      const rig = createBirdWingRig(mesh);
      const pose = (time: number, flying: boolean) => {
        rig.update(time, flying, false); mesh.skeleton!.prepare(true);
        return Array.from(mesh.getPositionData(true)!);
      };
      const rest = pose(0, false);
      let up = rest;
      for (let i = 1; i <= 60; i++) up = pose(i / 60, true);
      const down = pose(1.05, true);
      let movingWing = false, changingBeat = false;
      for (let i = 0; i < positions.length; i += 3) {
        const weight = wingWeight(positions[i], positions[i + 1], positions[i + 2]);
        if (weight === 0) {
          for (let axis = 0; axis < 3; axis++) expect(up[i + axis]).toBeCloseTo(rest[i + axis], 5);
        } else {
          movingWing ||= Math.abs(up[i] - rest[i]) > 0.02;
          changingBeat ||= Math.abs(up[i + 1] - down[i + 1]) > 0.01;
        }
      }
      expect(movingWing).toBe(true); expect(changingBeat).toBe(true);
      let folded = down;
      for (let i = 64; i <= 180; i++) folded = pose(i / 60, false);
      expect(Math.max(...folded.map((value, i) => Math.abs(value - rest[i])))).toBeLessThan(0.001);
      expect(mesh.skeleton!.bones).toHaveLength(5);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
