import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { aimThroughCrosshair, createFollowCamera, updateFollowCamera } from "./createThirdPersonCamera";

function groundForward(scene: Scene) {
  const camera = scene.activeCamera;
  if (!camera) {
    throw new Error("missing camera");
  }
  camera.getViewMatrix(true);
  const forward = camera.getDirection(new Vector3(0, 0, 1));
  return { x: forward.x, z: forward.z };
}

describe("follow camera", () => {
  it("does not pan right when the turtle moves straight forward", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const rig = createFollowCamera(scene);
    const look = { yaw: 0, pitch: 0 };

    updateFollowCamera(rig, look, 0, -24);
    scene.render();
    const samples = [groundForward(scene)];
    let z = -24;
    for (let step = 0; step < 120; step += 1) {
      z += 0.08;
      updateFollowCamera(rig, look, 0, z);
      scene.render();
      if (step % 30 === 29) {
        samples.push(groundForward(scene));
      }
    }

    rig.dispose();
    scene.dispose();
    engine.dispose();

    expect(samples[0].z).toBeGreaterThan(0.5);
    expect(samples[0].x).toBeCloseTo(0, 2);
    for (const sample of samples) {
      expect(sample.x).toBeCloseTo(0, 2);
      expect(sample.z).toBeGreaterThan(0.5);
    }
    expect(samples.every((sample) => Math.abs(sample.x) < 1e-6)).toBe(true);
    expect(new Set(samples.map((sample) => sample.x)).size).toBe(1);
  });

  it("aims a shot through the crosshair, including pitch", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const rig = createFollowCamera(scene);
    const look = { yaw: 0.4, pitch: -0.35 };
    updateFollowCamera(rig, look, 2, -10);
    scene.render();
    const camera = scene.activeCamera;
    if (!camera) throw new Error("missing camera");
    const forward = camera.getDirection(new Vector3(0, 0, 1));
    const aim = aimThroughCrosshair(look);
    expect(aim.x).toBeCloseTo(forward.x, 5);
    expect(aim.y).toBeCloseTo(forward.y, 5);
    expect(aim.z).toBeCloseTo(forward.z, 5);

    const level = aimThroughCrosshair({ yaw: 0, pitch: 0 });
    const raised = aimThroughCrosshair({ yaw: 0, pitch: 0.45 });
    expect(level.z).toBeGreaterThan(0.8);
    expect(level.y).toBeLessThan(0);
    expect(raised.y).toBeGreaterThan(level.y);

    rig.dispose();
    scene.dispose();
    engine.dispose();
  });
});
