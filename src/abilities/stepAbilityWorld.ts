import { absorbHit, beginAbility, createEffects, createLoadout, resolveWaveWindow, stepLoadout, type AbilityLoadout, type RacerEffects } from "./abilityState";
import type { AbilityId } from "./catalog";
import { abilityCatalog, collisionSpeedScale } from "./catalog";
import { applyDamage, createHealth, damageRules, type Health } from "./health";
import {
  beginRescue,
  createSeagull,
  isRescuePhase,
  playerKnockFrom,
  seagullRules,
  stepKnock,
  stepSeagull,
  strikeSeagull,
  stunSeagull,
  type Seagull,
  type Vec2,
} from "../mob/seagull";
import { createSnap, snapRules, stepSnap, trySnap, type SnapState } from "./snap";
import { createContactBook, resolveCollisions, stepContactBook, type ContactBook } from "./contacts";
import { collectTideOrbs, createTideOrbs, stepTideOrbs, type TideOrb } from "./pickups";
import { createSandCloud, ownCloudRemaining, resolveSandClouds, stepSandClouds, type SandCloud } from "./sandSpray";
import type { TurtleMotion } from "../movement/stepTurtle";

export type AbilityCue = "pickup" | "frenzy" | "shield" | "spray" | "block" | "bump" | "wave-arm" | "wave-boost" | "wave-miss" | "trail" | "snap" | "snap-hit" | "gull-hit" | "gull-swoop";

/** Everything the ability rules remember between frames, apart from the meshes. */
export interface AbilityWorld {
  loadout: AbilityLoadout;
  rivalEffects: RacerEffects;
  orbs: TideOrb[];
  clouds: SandCloud[];
  contacts: ContactBook;
  nextCloudId: number;
  playerHealth: Health;
  rivalHealth: Health;
  snap: SnapState;
  seagulls: Seagull[];
  /** Speed of the push the turtle is still sliding from. */
  playerKnock: Vec2;
}

export const defaultMaxHealth = 100;

export function createAbilityWorld(
  maxHealth = defaultMaxHealth,
  spawns: readonly { id: string; home: Vec2 }[] = [],
): AbilityWorld {
  return {
    seagulls: spawns.map((spawn) => createSeagull(spawn.id, spawn.home)),
    playerKnock: { x: 0, z: 0 },
    playerHealth: createHealth(maxHealth),
    rivalHealth: createHealth(defaultMaxHealth),
    snap: createSnap(),
    loadout: createLoadout(),
    rivalEffects: createEffects(),
    orbs: createTideOrbs(),
    clouds: [],
    contacts: createContactBook(),
    nextCloudId: 1,
  };
}

export interface AbilityTick {
  dt: number;
  racing: boolean;
  activate: boolean;
  player: TurtleMotion;
  rival: TurtleMotion;
  inWaveZone: boolean;
  random: () => number;
  pool: readonly AbilityId[];
  /** Abilities the player can hold at once. Defaults to 1. */
  itemSlots?: number;
  /** True for turtles that can snap. */
  canSnap?: boolean;
  /** True on the frame the snap button goes down. */
  snapPressed?: boolean;
}

export interface AbilityTickResult {
  world: AbilityWorld;
  player: TurtleMotion;
  rival: TurtleMotion;
  cues: AbilityCue[];
  /** How far knockback slides the turtle this frame. The caller keeps it on the beach. */
  playerShift: Vec2;
  /** Height of the turtle above the sand while a seagull carries it. */
  playerLift: number;
  /** True while a seagull has the turtle. Input is ignored for that time. */
  rescuing: boolean;
}

/**
 * One frame of items and abilities.
 * Hits are resolved before the clocks tick, so a shell that is up at the start of the frame can still block.
 */
export function stepAbilityWorld(world: AbilityWorld, tick: AbilityTick): AbilityTickResult {
  const cues: AbilityCue[] = [];
  let loadout = world.loadout;
  let orbs = stepTideOrbs(world.orbs, tick.dt);
  let clouds = world.clouds;
  let nextCloudId = world.nextCloudId;
  let player = tick.player;
  let rival = tick.rival;
  let rivalEffects = world.rivalEffects;
  let playerHealth = world.playerHealth;
  let rivalHealth = world.rivalHealth;
  let snap = world.snap;
  let seagulls = world.seagulls;
  const frozen = world.seagulls.some((gull) => isRescuePhase(gull.phase));

  if (tick.racing && !frozen) {
    const pickup = collectTideOrbs(orbs, loadout, player, tick.random, tick.pool, tick.itemSlots ?? 1);
    orbs = pickup.orbs;
    loadout = pickup.loadout;
    if (pickup.granted) {
      cues.push("pickup");
    }

    if (tick.activate && loadout.held !== null) {
      const held = loadout.held;
      const started = beginAbility(loadout, held);
      if (started.started) {
        loadout = started.loadout;
        cues.push(cueFor(held));
        if (held === "sand-spray") {
          clouds = [...clouds, createSandCloud(nextCloudId, "player", player, abilityCatalog[held].duration)];
          nextCloudId += 1;
        }
      }
    }
  }

  if (tick.racing && !frozen && tick.canSnap && tick.snapPressed) {
    const bite = trySnap(snap, player, rival, rivalEffects);
    snap = bite.state;
    if (bite.started) {
      cues.push("snap");
    }
    rival = bite.target;
    rivalEffects = bite.targetEffects;
    rivalHealth = applyDamage(rivalHealth, bite.damage);
    // The neck swivels, so any gull within reach gets bitten too, whether or not the rival was.
    let gullBitten = false;
    if (bite.started) {
      seagulls = seagulls.map((gull) => {
        if (Math.hypot(gull.x - player.x, gull.z - player.z) > snapRules.reach || isRescuePhase(gull.phase)) {
          return gull;
        }
        gullBitten = true;
        return stunSeagull(gull, player);
      });
    }
    if (bite.hit || gullBitten) {
      cues.push("snap-hit");
    }
    if (bite.blocked) {
      cues.push("block");
    }
  }

  const wave = resolveWaveWindow(loadout.effects, tick.inWaveZone);
  if (wave.triggered) {
    cues.push("wave-boost");
  }
  const windowBefore = loadout.effects.waveWindowRemaining;
  loadout = { ...loadout, effects: wave.effects };

  const sprayed = resolveSandClouds(clouds, [
    { id: "player", x: player.x, z: player.z, effects: loadout.effects },
    { id: "rival", x: rival.x, z: rival.z, effects: rivalEffects },
  ]);
  clouds = sprayed.clouds;
  const playerAfterSpray = sprayed.targets.find((target) => target.id === "player");
  const rivalAfterSpray = sprayed.targets.find((target) => target.id === "rival");
  if (playerAfterSpray) {
    loadout = { ...loadout, effects: playerAfterSpray.effects };
  }
  if (rivalAfterSpray) {
    rivalEffects = rivalAfterSpray.effects;
  }
  for (const hit of sprayed.hits) {
    if (hit.blocked) continue;
    if (hit.targetId === "player") playerHealth = applyDamage(playerHealth, damageRules.sandSpray);
    else rivalHealth = applyDamage(rivalHealth, damageRules.sandSpray);
  }
  if (sprayed.hits.some((hit) => hit.blocked)) {
    cues.push("block");
  }

  const bodies = {
    player: { id: "player", motion: player, effects: loadout.effects },
    rival: { id: "rival", motion: rival, effects: rivalEffects },
  };
  // A turtle in a seagull's grip is off the ground, so nothing on the sand can hit it.
  const collided = frozen
    ? { ...bodies, book: world.contacts, blocked: false, bumped: false, playerDamage: 0, rivalDamage: 0 }
    : resolveCollisions(bodies.player, bodies.rival, world.contacts);
  player = collided.player.motion;
  rival = collided.rival.motion;
  loadout = { ...loadout, effects: collided.player.effects };
  rivalEffects = collided.rival.effects;
  playerHealth = applyDamage(playerHealth, collided.playerDamage);
  rivalHealth = applyDamage(rivalHealth, collided.rivalDamage);
  if (collided.blocked) {
    cues.push("block");
  }
  if (collided.bumped) {
    cues.push("bump");
  }

  let playerKnock = world.playerKnock;
  let playerShift: Vec2 = { x: 0, z: 0 };
  let playerLift = 0;
  if (tick.racing) {
    let rescueDone = false;
    seagulls = seagulls.map((gull) => {
      const step = stepSeagull(gull, { dt: tick.dt, player, canAttack: !frozen });
      let next = step.gull;
      if (step.grabbed) {
        cues.push("gull-swoop");
      }
      if (step.pose) {
        player = { ...player, x: step.pose.x, z: step.pose.z, speed: 0 };
        playerLift = step.pose.y;
        playerKnock = { x: 0, z: 0 };
      }
      rescueDone = rescueDone || step.rescueDone;
      if (step.contact) {
        const hit = absorbHit(loadout.effects, "collision");
        loadout = { ...loadout, effects: hit.effects };
        if (hit.blocked) {
          cues.push("block");
        } else {
          playerHealth = applyDamage(playerHealth, seagullRules.damage);
          player = { ...player, speed: player.speed * collisionSpeedScale };
          playerKnock = playerKnockFrom(next, player);
          cues.push("gull-hit");
        }
        next = strikeSeagull(next, player);
      }
      return next;
    });
    if (rescueDone) {
      playerHealth = { ...playerHealth, current: Math.ceil(playerHealth.max * seagullRules.restoreFraction) };
    }
    const stillFrozen = seagulls.some((gull) => isRescuePhase(gull.phase));
    if (playerHealth.current <= 0 && !stillFrozen && seagulls.length > 0) {
      // A stunned gull cannot answer the call. If every gull is stunned the rescue waits for one to recover.
      const able = seagulls.filter((gull) => gull.phase !== "stunned");
      const nearest = able.reduce<Seagull | null>(
        (best, gull) =>
          !best || Math.hypot(gull.x - player.x, gull.z - player.z) < Math.hypot(best.x - player.x, best.z - player.z) ? gull : best,
        null,
      );
      if (nearest) {
        seagulls = seagulls.map((gull) => (gull === nearest ? beginRescue(gull) : gull));
        cues.push("gull-swoop");
      }
    }
    if (!seagulls.some((gull) => isRescuePhase(gull.phase))) {
      const moved = stepKnock(playerKnock, tick.dt);
      playerKnock = moved.knock;
      playerShift = moved.shift;
    }
  }

  const hadBoost = loadout.effects.waveBoostRemaining > 0;
  loadout = stepLoadout(loadout, tick.dt);
  rivalEffects = stepEffectsOnly(rivalEffects, tick.dt);
  clouds = stepSandClouds(clouds, tick.dt);
  snap = stepSnap(snap, tick.dt);
  if (windowBefore > 0 && loadout.effects.waveWindowRemaining === 0 && !hadBoost && loadout.effects.waveBoostRemaining === 0) {
    cues.push("wave-miss");
  }

  return {
    player,
    rival,
    cues,
    playerShift,
    playerLift,
    rescuing: seagulls.some((gull) => isRescuePhase(gull.phase)),
    world: {
      loadout,
      rivalEffects,
      orbs,
      clouds,
      contacts: stepContactBook(collided.book, tick.dt),
      nextCloudId,
      playerHealth,
      rivalHealth,
      snap,
      seagulls,
      playerKnock,
    },
  };
}

function cueFor(ability: AbilityId): AbilityCue {
  if (ability === "flipper-frenzy") return "frenzy";
  if (ability === "shell-guard") return "shield";
  if (ability === "sand-spray") return "spray";
  if (ability === "wave-rider") return "wave-arm";
  return "trail";
}

function stepEffectsOnly(effects: RacerEffects, dt: number): RacerEffects {
  return stepLoadout({ held: null, spare: null, effects }, dt).effects;
}

export function playerCloudRemaining(world: AbilityWorld): number {
  return ownCloudRemaining(world.clouds, "player");
}
