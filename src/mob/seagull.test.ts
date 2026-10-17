import { describe, expect, it } from "vitest";
import { createLoadout, holdAbility, beginAbility } from "../abilities/abilityState";
import { createAbilityWorld, stepAbilityWorld, type AbilityTick, type AbilityWorld } from "../abilities/stepAbilityWorld";
import { starterAbilityPool } from "../abilities/catalog";
import { surfaces } from "../movement/surfaces";
import { createTurtleMotion, type TurtleMotion } from "../movement/stepTurtle";
import { createRivalMotion } from "../race/stepRival";
import {
  chaseSpeed,
  createSeagull,
  isRescuePhase,
  seagullRules,
  stepKnock,
  seagullSpawns,
  stepSeagull,
  strikeSeagull,
  stunSeagull,
  type Seagull,
} from "./seagull";

const home = { x: 0, z: -4 };
const frame = 1 / 60;

function runGull(gull: Seagull, player: { x: number; z: number }, seconds: number) {
  let current = gull;
  for (let t = 0; t < seconds; t += frame) {
    current = stepSeagull(current, { dt: frame, player, canAttack: true }).gull;
  }
  return current;
}

describe("seagull behaviour", () => {
  it("ignores a turtle that is far away and wakes up when it comes close", () => {
    const far = runGull(createSeagull("g", home), { x: 0, z: home.z - 30 }, 1);
    expect(far.phase).toBe("perched");
    const near = runGull(createSeagull("g", home), { x: 0, z: home.z - 6 }, 0.1);
    expect(near.phase).toBe("chase");
  });

  it("chases slightly slower than the regular turtle", () => {
    for (const surface of Object.values(surfaces)) {
      expect(surface.maxSpeed * seagullRules.speedFactor).toBeLessThan(surface.maxSpeed);
      expect(seagullRules.speedFactor).toBeGreaterThan(0.8);
    }
    expect(chaseSpeed(-10)).toBeCloseTo(surfaces["dry-sand"].maxSpeed * seagullRules.speedFactor);
  });

  it("covers distance at its chase speed", () => {
    const player = { x: 0, z: home.z - 9 };
    const start = stepSeagull(createSeagull("g", home), { dt: frame, player, canAttack: true }).gull;
    const after = runGull(start, player, 1);
    expect(home.z - after.z).toBeGreaterThan(chaseSpeed(home.z) * 0.8);
    expect(home.z - after.z).toBeLessThan(chaseSpeed(home.z) * 1.05);
  });

  it("gives up and flies home when the turtle gets away", () => {
    const strayed = { ...createSeagull("g", home), phase: "chase" as const, z: home.z - seagullRules.leashRadius - 1 };
    const gone = runGull(strayed, { x: 0, z: home.z - 40 }, 0.1);
    expect(gone.phase).toBe("return");
    expect(runGull(gone, { x: 0, z: home.z - 40 }, 6).phase).toBe("perched");
  });

  it("reports contact when it reaches the turtle", () => {
    const woke = { ...createSeagull("g", home), phase: "chase" as const };
    const step = stepSeagull(woke, { dt: frame, player: { x: 0.5, z: home.z }, canAttack: true });
    expect(step.contact).toBe(true);
  });

  it("bounces the gull away from the turtle and stuns it", () => {
    const struck = strikeSeagull({ ...createSeagull("g", home), phase: "chase" }, { x: 0, z: home.z - 1 });
    expect(struck.phase).toBe("recover");
    expect(struck.knock.z).toBeGreaterThan(0);
    const later = runGull(struck, { x: 0, z: home.z - 1 }, 0.3);
    expect(later.z).toBeGreaterThan(home.z);
  });

  it("fades a knock-back to nothing", () => {
    let knock = { x: 0, z: 8 };
    let travelled = 0;
    for (let i = 0; i < 300; i += 1) {
      const moved = stepKnock(knock, frame);
      travelled += moved.shift.z;
      knock = moved.knock;
    }
    expect(knock).toEqual({ x: 0, z: 0 });
    expect(travelled).toBeGreaterThan(1);
    expect(travelled).toBeLessThan(3);
  });
});

function worldTick(world: AbilityWorld, player: TurtleMotion, overrides: Partial<AbilityTick> = {}) {
  return stepAbilityWorld(world, {
    dt: frame,
    racing: true,
    activate: false,
    player,
    rival: { ...createRivalMotion(player), x: 50, z: 50 },
    inWaveZone: false,
    random: () => 0,
    pool: starterAbilityPool,
    ...overrides,
  });
}

describe("seagull in the world", () => {
  const spawns = [{ id: "g", home }];
  const touching = { ...createTurtleMotion(), x: home.x, z: home.z - 0.6, speed: 3 };

  it("hurts the turtle and knocks both back on contact", () => {
    const world = createAbilityWorld(100, spawns);
    world.seagulls[0] = { ...world.seagulls[0]!, phase: "chase" };
    const hit = worldTick(world, touching);
    expect(hit.world.playerHealth.current).toBe(100 - seagullRules.damage);
    expect(hit.cues).toContain("gull-hit");
    expect(hit.player.speed).toBeLessThan(touching.speed);
    expect(hit.world.playerKnock.z).toBeLessThan(0);
    expect(hit.world.seagulls[0]!.phase).toBe("recover");
    expect(hit.world.seagulls[0]!.knock.z).toBeGreaterThan(0);
  });

  it("is stopped by Shell Guard, which is spent, and only the gull bounces", () => {
    const world = createAbilityWorld(100, spawns);
    world.seagulls[0] = { ...world.seagulls[0]!, phase: "chase" };
    const guarded = { ...world, loadout: beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout };
    const hit = worldTick(guarded, touching);
    expect(hit.world.playerHealth.current).toBe(100);
    expect(hit.world.loadout.effects.shieldCharges).toBe(0);
    expect(hit.world.playerKnock).toEqual({ x: 0, z: 0 });
    expect(hit.world.seagulls[0]!.phase).toBe("recover");
  });

  it("carries a turtle at zero health back toward the nest, then sets it down with some health", () => {
    let world = createAbilityWorld(100, spawns);
    world = { ...world, playerHealth: { current: 0, max: 100 } };
    const start = { ...createTurtleMotion(), x: 3, z: 12 };
    let player = start;
    let sawCarry = false;
    let peak = 0;
    let finished = false;
    for (let step = 0; step < 60 * 20 && !finished; step += 1) {
      const result = worldTick(world, player);
      world = result.world;
      player = result.player;
      sawCarry = sawCarry || world.seagulls[0]!.phase === "carry";
      peak = Math.max(peak, result.playerLift);
      finished = !result.rescuing && sawCarry;
    }
    expect(finished).toBe(true);
    expect(peak).toBeGreaterThan(1.5);
    expect(start.z - player.z).toBeGreaterThan(15);
    expect(world.playerHealth.current).toBe(Math.ceil(100 * seagullRules.restoreFraction));
    expect(world.seagulls[0]!.grace).toBeGreaterThan(0);
  });

  it("ignores input and hazards while carried, and never carries past the nest", () => {
    let world = createAbilityWorld(100, spawns);
    world = { ...world, playerHealth: { current: 0, max: 100 } };
    let player = { ...createTurtleMotion(), x: 0, z: -26 };
    for (let step = 0; step < 60 * 20; step += 1) {
      const result = worldTick(world, player);
      world = result.world;
      player = result.player;
      expect(player.z).toBeGreaterThanOrEqual(seagullRules.nestLimitZ - 0.01);
    }
    expect(isRescuePhase(world.seagulls[0]!.phase)).toBe(false);
  });

  it("does nothing special without a seagull", () => {
    const world = { ...createAbilityWorld(100), playerHealth: { current: 0, max: 100 } };
    const result = worldTick(world, createTurtleMotion());
    expect(result.rescuing).toBe(false);
  });
});

describe("stunned seagull", () => {
  const spawns = [{ id: "g", home }];

  it("cannot attack while stunned, then goes back to chasing", () => {
    const player = { x: 0, z: home.z - 0.5 };
    const stunned = stunSeagull({ ...createSeagull("g", home), phase: "chase" }, player);
    expect(stunned.phase).toBe("stunned");
    expect(stepSeagull(stunned, { dt: frame, player, canAttack: true }).contact).toBe(false);
    const mid = runGull(stunned, player, seagullRules.stunTime - 0.3);
    expect(mid.phase).toBe("stunned");
    expect(mid.y).toBeCloseTo(seagullRules.perchHeight, 1);
    expect(runGull(stunned, player, seagullRules.stunTime + 0.1).phase).toBe("chase");
  });

  it("does not stun a gull that is carrying a turtle", () => {
    const carrying = { ...createSeagull("g", home), phase: "carry" as const };
    expect(stunSeagull(carrying, { x: 0, z: 0 }).phase).toBe("carry");
  });

  it("is stunned by a snap within reach, and ignored beyond it", () => {
    const player = { ...createTurtleMotion(), x: 0, z: home.z - 1.5 };
    const world = createAbilityWorld(115, spawns);
    const far = createAbilityWorld(115, [{ id: "g", home: { x: 0, z: home.z + 20 } }]);
    const bitten = worldTick(world, player, { snapPressed: true, canSnap: true });
    expect(bitten.world.seagulls[0]!.phase).toBe("stunned");
    expect(bitten.cues).toContain("snap-hit");
    const missed = worldTick(far, player, { snapPressed: true, canSnap: true });
    expect(missed.world.seagulls[0]!.phase).toBe("perched");
    const unable = worldTick(createAbilityWorld(100, spawns), player, { snapPressed: true, canSnap: false });
    expect(unable.world.seagulls[0]!.phase).not.toBe("stunned");
  });

  it("stops a stunned gull from attacking the player", () => {
    const player = { ...createTurtleMotion(), x: home.x, z: home.z - 0.5 };
    const world = createAbilityWorld(100, spawns);
    world.seagulls[0] = stunSeagull({ ...world.seagulls[0]!, phase: "chase" }, player);
    expect(worldTick(world, player).world.playerHealth.current).toBe(100);
  });

  it("waits for a recovered gull before carrying a turtle at zero health", () => {
    const player = { ...createTurtleMotion(), x: home.x, z: home.z - 3 };
    let world = createAbilityWorld(100, spawns);
    world = { ...world, playerHealth: { current: 0, max: 100 } };
    world.seagulls[0] = stunSeagull(world.seagulls[0]!, player);
    let result = worldTick(world, player);
    expect(result.rescuing).toBe(false);
    let current = result.world;
    for (let step = 0; step < 60 * (seagullRules.stunTime + 1); step += 1) {
      result = worldTick(current, player);
      current = result.world;
      if (result.rescuing) break;
    }
    expect(result.rescuing).toBe(true);
  });

  it("puts several gulls along the course, apart from each other", () => {
    expect(seagullSpawns.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seagullSpawns.map((spawn) => spawn.id)).size).toBe(seagullSpawns.length);
    for (const a of seagullSpawns) {
      for (const b of seagullSpawns) {
        if (a !== b) expect(Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z)).toBeGreaterThan(8);
      }
    }
  });
});
