import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createDetailedTurtle } from "../turtle/createDetailedTurtle";
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createOceanTurtle } from "../turtle/createOceanTurtle";
import { createSculptedTurtle } from "../turtle/createSculptedTurtle";
import { createEffects } from "./abilityState";
import { createAbilityFx, type AbilityFxFrame } from "./renderAbilityFx";
import { createAbilityWorld } from "./stepAbilityWorld";

describe("ability effects across both turtle materials", () => {
  it.each([
    ["standard", createPlaceholderTurtle],
    ["PBR", createDetailedTurtle],
    ["Blender ocean", createOceanTurtle],
    ["saved TMNT", createSculptedTurtle],
  ] as const)("applies and clears frenzy and shield glow on the %s turtle", (_name, createTurtle) => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const turtle = createTurtle(scene);
      const rival = createPlaceholderTurtle(scene, { id: "rival" });
      const fx = createAbilityFx(scene, turtle.visual);
      const world = createAbilityWorld();
      const frame: AbilityFxFrame = {
        time: 1,
        orbs: world.orbs,
        clouds: [],
        playerEffects: { ...createEffects(), frenzyRemaining: 2, shieldCharges: 1, shieldRemaining: 2 },
        rivalEffects: createEffects(),
        blockFlash: 0,
        playerX: 0,
        playerZ: -24,
        trail: false,
        waveArmed: false,
        waveBoost: false,
        playerSkin: turtle.skin,
        playerShell: turtle.shell,
        rivalSkin: rival.skin,
        rivalShell: rival.shell,
      };
      fx.sync(frame);
      expect(turtle.skin.emissiveColor.r).toBeGreaterThan(0);
      expect(turtle.shell.emissiveColor.g).toBeGreaterThan(0);
      expect(scene.getMeshByName("shellGuard")?.isVisible).toBe(true);

      fx.sync({ ...frame, playerEffects: createEffects() });
      expect(turtle.skin.emissiveColor.asArray()).toEqual([0, 0, 0]);
      expect(turtle.shell.emissiveColor.asArray()).toEqual([0, 0, 0]);
      expect(scene.getMeshByName("shellGuard")?.isVisible).toBe(false);
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
