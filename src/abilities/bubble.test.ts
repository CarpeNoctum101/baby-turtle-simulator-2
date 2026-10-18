import { describe, expect, it } from "vitest";
import { createSeagull, stepSeagull, trapSeagull } from "../mob/seagull";
import { createTurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion } from "../race/stepRival";
import { obstacleLayout } from "../movement/obstacles";
import { beginAbility, createEffects, createLoadout, holdAbility, speedModifiers, stepEffects } from "./abilityState";
import { abilityCatalog, bubbleShotRules } from "./catalog";
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
    aimY: 0,
    aimZ: 1,
    ...overrides,
  });
}

function withGun(world: AbilityWorld, shots: number = bubbleShotRules.shots, seconds = 8): AbilityWorld {
  return {
    ...world,
    bubbleCooldown: 0,
    loadout: {
      ...world.loadout,
      effects: { ...world.loadout.effects, bubbleGunRemaining: seconds, bubbleShotsLeft: shots },
    },
  };
}

describe("bubble shot", () => {
  it("flies along the aim direction, climbs when aimed up, and pops on a rock", () => {
    const shot = launchBubble(0, bubbleRules.spawnHeight, 0, 0, 0, 1);
    if (!shot) throw new Error("expected a bubble");
    expect(shot.z).toBeCloseTo(bubbleRules.spawnForward);
    expect(shot.y).toBeCloseTo(bubbleRules.spawnHeight);
    const moved = stepBubbleShots([shot], 0.1);
    expect(moved[0]?.z).toBeGreaterThan(shot.z);

    const rising = launchBubble(0, bubbleRules.spawnHeight, 0, 0, 1, 0);
    if (!rising) throw new Error("expected an upward bubble");
    expect(rising.y).toBeGreaterThan(bubbleRules.spawnHeight);
    const climbed = stepBubbleShots([rising], 0.1);
    expect(climbed[0]?.y).toBeGreaterThan(rising.y);
    expect(climbed[0]?.z).toBeCloseTo(rising.z);

    const rock = obstacleLayout.find((obstacle) => obstacle.kind === "rock");
    if (!rock) throw new Error("expected a rock");
    const popped = consumeBubbleHits(
      [{ ...shot, x: rock.x, y: 0.3, z: rock.z }],
      [{ id: "rival", x: rock.x, z: rock.z, y: 0.4 }],
    );
    expect(popped.shots).toHaveLength(0);
    expect(popped.hits).toHaveLength(0);
    const over = consumeBubbleHits([{ ...shot, x: rock.x, y: 8, z: rock.z }], []);
    expect(over.shots).toHaveLength(1);
    const highMiss = consumeBubbleHits([{ ...shot, y: 6, z: 1 }], [{ id: "rival", x: 0, y: 0.4, z: 1 }]);
    expect(highMiss.hits).toHaveLength(0);
  });

  it("does nothing until Bubble Shot is armed, then stops after three shots or the timer", () => {
    const player = { ...createTurtleMotion(), x: 0, z: 0 };
    const rival = { ...player, x: 8, z: 8 };
    const denied = tick(createAbilityWorld(), { player, rival, shoot: true });
    expect(denied.world.bubbles).toHaveLength(0);
    expect(denied.cues).not.toContain("bubble");

    const started = beginAbility(holdAbility(createLoadout(), "bubble-shot"), "bubble-shot");
    expect(started.started).toBe(true);
    expect(started.loadout.effects.bubbleShotsLeft).toBe(bubbleShotRules.shots);
    expect(started.loadout.effects.bubbleGunRemaining).toBe(abilityCatalog["bubble-shot"].duration);

    let world = withGun(createAbilityWorld());
    for (let n = 0; n < bubbleShotRules.shots; n += 1) {
      const fired = tick(withGun(world, bubbleShotRules.shots - n), { player, rival, shoot: true });
      expect(fired.cues).toContain("bubble");
      world = fired.world;
    }
    expect(world.loadout.effects.bubbleShotsLeft).toBe(0);
    const extra = tick({ ...world, bubbleCooldown: 0 }, { player, rival, shoot: true });
    expect(extra.cues).not.toContain("bubble");

    const armed = tick(createAbilityWorld(), {
      player,
      rival,
      activate: true,
      shoot: true,
    });
    const fresh = {
      ...createAbilityWorld(),
      loadout: holdAbility(createLoadout(), "bubble-shot"),
    };
    const first = tick(fresh, { player, rival, activate: true, shoot: true });
    expect(first.cues).toContain("bubble");
    expect(first.world.bubbles).toHaveLength(1);
    expect(first.world.loadout.effects.bubbleShotsLeft).toBe(bubbleShotRules.shots - 1);
    expect(armed.cues).not.toContain("bubble");

    const faded = stepEffects(
      { ...createEffects(), bubbleGunRemaining: 0.01, bubbleShotsLeft: 2 },
      0.05,
    );
    expect(faded.bubbleGunRemaining).toBe(0);
    expect(faded.bubbleShotsLeft).toBe(0);
  });

  it("traps the rival, then lets the rival crawl again", () => {
    const player = { ...createTurtleMotion(), x: 0, z: 0, heading: 0 };
    const rival = { ...player, x: 0, z: 3, speed: 2 };
    let world = withGun(createAbilityWorld());
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
    const guarded = withGun({
      ...createAbilityWorld(),
      rivalEffects: { ...createEffects(), shieldRemaining: 5, shieldCharges: 1 },
    });
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
    let current = tick(withGun(createAbilityWorld(50, [{ id: "g", home: { x: 0, z: 3 } }])), { player, rival, shoot: true });
    for (let step = 0; step < 30 && current.world.seagulls[0]?.bubble === 0; step += 1) {
      current = tick(current.world, { player, rival });
    }
    expect(current.world.seagulls[0]?.bubble).toBeGreaterThan(2);
    expect(current.cues).toContain("bubble-trap");
  });
});
