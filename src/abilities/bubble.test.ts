import { describe, expect, it } from "vitest";
import { createSeagull, stepSeagull, trapSeagull } from "../mob/seagull";
import { createTurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion } from "../race/stepRival";
import { obstacleLayout } from "../movement/obstacles";
import { createEffects, speedModifiers } from "./abilityState";
import { bubbleRules, consumeBubbleHits, launchBubble, stepBubbleShots } from "./bubble";
import { createAbilityWorld, stepAbilityWorld, type AbilityTick, type AbilityWorld } from "./stepAbilityWorld";

const frame = 1 / 60;

function tick(world: AbilityWorld, overrides: Partial<AbilityTick> = {}) {
  const player = overrides.player ?? createTurtleMotion();
  return stepAbilityWorld(world, {
    dt: frame,
    racing: true,
    activate: false,
    player,
    rival: overrides.rival ?? createRivalMotion(player),
    inWaveZone: false,
    random: () => 0,
    pool: [],
    aimX: 0,
    aimZ: 1,
    ...overrides,
  });
}

describe("bubble shot", () => {
  it("flies along the aim direction and pops on a rock", () => {
    const shot = launchBubble(0, 0, 0, 1);
    if (!shot) throw new Error("expected a bubble");
    expect(shot.z).toBeCloseTo(bubbleRules.spawnForward);
    const moved = stepBubbleShots([shot], 0.1);
    expect(moved[0]?.z).toBeGreaterThan(shot.z);

    const rock = obstacleLayout.find((obstacle) => obstacle.kind === "rock");
    if (!rock) throw new Error("expected a rock");
    const popped = consumeBubbleHits([{ ...shot, x: rock.x, z: rock.z }], [{ id: "rival", x: rock.x, z: rock.z, y: 0.4 }]);
    expect(popped.shots).toHaveLength(0);
    expect(popped.hits).toHaveLength(0);
  });

  it("traps the rival, then lets the rival crawl again", () => {
    const player = { ...createTurtleMotion(), x: 0, z: 0, heading: 0 };
    const rival = { ...player, x: 0, z: 3, speed: 2 };
    let world = createAbilityWorld();
    let current = tick(world, { player, rival, shoot: true });
    expect(current.cues).toContain("bubble");
    expect(current.world.bubbles).toHaveLength(1);

    const blocked = tick(current.world, { player, rival, shoot: true });
    expect(blocked.world.bubbles).toHaveLength(1);

    for (let step = 0; step < 30 && current.world.rivalEffects.bubbleRemaining === 0; step += 1) {
      current = tick(current.world, { player: current.player, rival: current.rival, shoot: false });
    }
    expect(current.world.rivalEffects.bubbleRemaining).toBeGreaterThan(2);
    expect(current.cues).toContain("bubble-trap");
    expect(speedModifiers(current.world.rivalEffects).maxSpeedMultiplier).toBe(0);

    world = current.world;
    const later = tick(
      { ...world, rivalEffects: { ...world.rivalEffects, bubbleRemaining: frame / 2 } },
      { player, rival: current.rival },
    );
    expect(later.world.rivalEffects.bubbleRemaining).toBe(0);
    expect(speedModifiers(later.world.rivalEffects).maxSpeedMultiplier).toBe(1);
  });

  it("spends a shell charge instead of trapping the rival", () => {
    const player = { ...createTurtleMotion(), x: 0, z: 0 };
    const rival = { ...player, x: 0, z: 3 };
    const guarded = {
      ...createAbilityWorld(),
      rivalEffects: { ...createEffects(), shieldRemaining: 5, shieldCharges: 1 },
    };
    let current = tick(guarded, { player, rival, shoot: true });
    for (let step = 0; step < 30 && current.world.rivalEffects.shieldCharges === 1; step += 1) {
      current = tick(current.world, { player, rival: current.rival });
    }
    expect(current.world.rivalEffects.shieldCharges).toBe(0);
    expect(current.world.rivalEffects.bubbleRemaining).toBe(0);
    expect(current.cues).toContain("block");
  });

  it("holds a seagull in place until the bubble ends", () => {
    const home = { x: 2, z: 2 };
    const gull = trapSeagull({ ...createSeagull("g", home), phase: "chase" }, bubbleRules.trapSeconds);
    const held = stepSeagull(gull, { dt: 0.05, player: { x: 0, z: 0 }, canAttack: true });
    expect(held.contact).toBe(false);
    expect(held.gull.x).toBe(home.x);
    expect(held.gull.z).toBe(home.z);
    expect(held.gull.phase).toBe("chase");
    expect(held.gull.bubble).toBeCloseTo(bubbleRules.trapSeconds - 0.05);

    const player = { ...createTurtleMotion(), x: 0, z: 0 };
    const rival = { ...player, x: 8, z: 8 };
    let current = tick(createAbilityWorld(50, [{ id: "g", home: { x: 0, z: 3 } }]), { player, rival, shoot: true });
    for (let step = 0; step < 30 && current.world.seagulls[0]?.bubble === 0; step += 1) {
      current = tick(current.world, { player, rival });
    }
    expect(current.world.seagulls[0]?.bubble).toBeGreaterThan(2);
    expect(current.cues).toContain("bubble-trap");
  });
});
