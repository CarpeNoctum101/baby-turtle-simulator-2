import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createCourse } from "../createCourse";
import { beachHeight } from "./landscape";
import { createPalm } from "./createPalm";
import { copyPalmPiece, seatRaceMarkers } from "./createBeachPreview";

describe("beach preview pieces after the course merge", () => {
  it("copies each palm piece onto the extra trees, including the raised crown", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const palm = createPalm(scene, new Vector3(-13.4, 0.02, -10));
      const root = new TransformNode("previewPalmInstance0", scene);
      root.position.set(20, 0.4, 12);
      root.scaling.setAll(1.12);
      root.rotation.y = 1.5;
      for (const source of palm.getChildMeshes()) {
        copyPalmPiece(source as Mesh, root, `${source.name}Instance0`);
      }
      const source = scene.getMeshByName("palmCrownShaft");
      const copy = scene.getMeshByName("palmCrownShaftInstance0");
      expect(source).toBeTruthy();
      expect(copy).toBeTruthy();
      expect(source!.position.y).toBeGreaterThan(4);
      expect(copy!.position.y).toBeCloseTo(source!.position.y, 4);
      expect(copy!.position.x).toBeCloseTo(source!.position.x, 4);
      expect(copy!.scaling.asArray()).toEqual(source!.scaling.asArray());
      copy!.computeWorldMatrix(true);
      const crown = copy!.getAbsolutePosition();
      expect(crown.y).toBeGreaterThan(4);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });

  it("sits the center start pad on the sand once the raised nest is hidden", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      createCourse(scene);
      const before = scene.getMeshByName("startPad-center")!.position.y;
      seatRaceMarkers(scene);
      const pad = scene.getMeshByName("startPad-center")!;
      const half = pad.getBoundingInfo().boundingBox.extendSize.y * Math.abs(pad.scaling.y);
      const bottom = pad.position.y - half;
      const sand = beachHeight(pad.position.x, pad.position.z);
      expect(before).toBeGreaterThan(sand + 0.1);
      expect(bottom).toBeGreaterThanOrEqual(sand);
      expect(bottom - sand).toBeLessThan(0.03);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
