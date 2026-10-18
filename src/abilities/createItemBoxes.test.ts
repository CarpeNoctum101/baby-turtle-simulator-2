import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createLoadout } from "./abilityState";
import { starterAbilityPool } from "./catalog";
import { collectTideOrbs, createTideOrbs, stepTideOrbs, tideOrbSpots } from "./pickups";
import { createAbilityFx, type AbilityFxFrame } from "./renderAbilityFx";

describe("question-mark item boxes", () => {
  it("retains pickup locations and hides/respawns the collected box without hiding its neighbors", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const turtle = createPlaceholderTurtle(scene), rival = createPlaceholderTurtle(scene, { id: "rival" });
      const fx = createAbilityFx(scene, turtle.visual);
      const pickup = collectTideOrbs(createTideOrbs(), createLoadout(), tideOrbSpots[0], () => 0, starterAbilityPool);
      const frame: AbilityFxFrame = {
        time: 1, orbs: pickup.orbs, clouds: [], playerEffects: pickup.loadout.effects,
        rivalEffects: createLoadout().effects, blockFlash: 0, playerX: -5.5, playerZ: -16,
        trail: false, waveArmed: false, waveBoost: false,
        playerSkin: turtle.skin, playerShell: turtle.shell, rivalSkin: rival.skin, rivalShell: rival.shell,
        bubbles: [], traps: [],
      };
      fx.sync(frame);
      expect(pickup.granted).toBe("flipper-frenzy");
      for (const [i, spot] of tideOrbSpots.entries()) {
        const box = scene.getMeshByName(spot.id)!;
        expect(box.position.x).toBe(spot.x);
        expect(box.position.z).toBe(spot.z);
        expect(box.isVisible).toBe(i !== 0);
        expect(box.getTotalIndices() / 3).toBeLessThan(200);
      }
      let orbs = pickup.orbs;
      for (let i = 0; i < 181; i++) orbs = stepTideOrbs(orbs, 0.05);
      fx.sync({ ...frame, time: 10.1, orbs });
      for (const spot of tideOrbSpots) expect(scene.getMeshByName(spot.id)?.isVisible).toBe(true);
      expect(scene.getMeshByName(tideOrbSpots[1].id)!.rotation.y).not.toBe(0);
    } finally {
      scene.dispose(); engine.dispose();
    }
  });
});
