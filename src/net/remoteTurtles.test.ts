import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../shared/protocol";
import { createRemoteTurtles } from "./remoteTurtles";

function hatchling(id: string, place = 0): PublicPlayer {
  return {
    id,
    name: "Pebble",
    slot: 1,
    connected: true,
    ready: true,
    place,
    ms: place > 0 ? 1000 : 0,
    x: 1,
    z: -10,
    heading: 0,
    speed: 2,
  };
}

describe("remote hatchlings", () => {
  it("shows another player's ability until the server time runs out", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const remotes = createRemoteTurtles(scene);
      remotes.setSelf("host-000");
      remotes.applyRoster([hatchling("host-000"), hatchling("guest-01")]);
      remotes.showAbility("guest-01", "flipper-frenzy", 5_000);
      remotes.showAbility("guest-01", "shell-guard", 5_000);
      remotes.step(1 / 30, 1_000);
      const skin = scene.getMaterialByName("remote-1-guest-01Skin") as StandardMaterial;
      expect(skin.emissiveColor.r).toBeGreaterThan(0);
      expect(scene.getMeshByName("remote-1-guest-01Shield")?.isVisible).toBe(true);

      remotes.step(1 / 30, 5_001);
      expect(skin.emissiveColor.asArray()).toEqual([0, 0, 0]);
      expect(scene.getMeshByName("remote-1-guest-01Shield")?.isVisible).toBe(false);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });

  it("removes a hatchling from the beach once the server records their finish", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const remotes = createRemoteTurtles(scene);
      remotes.setSelf("host-000");
      remotes.applyRoster([hatchling("host-000"), hatchling("guest-01")]);
      expect(scene.getTransformNodeByName("remote-1-guest-01")).toBeTruthy();

      remotes.remove("guest-01");
      expect(scene.getTransformNodeByName("remote-1-guest-01")).toBeNull();

      remotes.applyRoster([hatchling("host-000"), hatchling("guest-01", 1)]);
      expect(scene.getTransformNodeByName("remote-1-guest-01")).toBeNull();

      remotes.applyRoster([hatchling("host-000"), hatchling("guest-01", 0)]);
      expect(scene.getTransformNodeByName("remote-1-guest-01")).toBeTruthy();
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
