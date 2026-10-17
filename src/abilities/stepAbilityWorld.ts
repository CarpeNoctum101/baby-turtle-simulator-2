import { beginAbility, createEffects, createLoadout, resolveWaveWindow, stepLoadout, type AbilityLoadout, type RacerEffects } from "./abilityState";
import type { AbilityId } from "./catalog";
import { abilityCatalog } from "./catalog";
import { createContactBook, resolveCollisions, stepContactBook, type ContactBook } from "./contacts";
import { collectTideOrbs, createTideOrbs, stepTideOrbs, type TideOrb } from "./pickups";
import { createSandCloud, ownCloudRemaining, resolveSandClouds, stepSandClouds, type SandCloud } from "./sandSpray";
import type { TurtleMotion } from "../movement/stepTurtle";

export type AbilityCue = "pickup" | "frenzy" | "shield" | "spray" | "block" | "bump" | "wave-arm" | "wave-boost" | "wave-miss" | "trail";

/** Everything the ability rules remember between frames, apart from the meshes. */
export interface AbilityWorld {
  loadout: AbilityLoadout;
  rivalEffects: RacerEffects;
  orbs: TideOrb[];
  clouds: SandCloud[];
  contacts: ContactBook;
  nextCloudId: number;
}

export function createAbilityWorld(): AbilityWorld {
  return {
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
}

export interface AbilityTickResult {
  world: AbilityWorld;
  player: TurtleMotion;
  rival: TurtleMotion;
  cues: AbilityCue[];
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

  if (tick.racing) {
    const pickup = collectTideOrbs(orbs, loadout, player, tick.random, tick.pool);
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
  if (sprayed.hits.some((hit) => hit.blocked)) {
    cues.push("block");
  }

  const collided = resolveCollisions(
    { id: "player", motion: player, effects: loadout.effects },
    { id: "rival", motion: rival, effects: rivalEffects },
    world.contacts,
  );
  player = collided.player.motion;
  rival = collided.rival.motion;
  loadout = { ...loadout, effects: collided.player.effects };
  rivalEffects = collided.rival.effects;
  if (collided.blocked) {
    cues.push("block");
  }
  if (collided.bumped) {
    cues.push("bump");
  }

  const hadBoost = loadout.effects.waveBoostRemaining > 0;
  loadout = stepLoadout(loadout, tick.dt);
  rivalEffects = stepEffectsOnly(rivalEffects, tick.dt);
  clouds = stepSandClouds(clouds, tick.dt);
  if (windowBefore > 0 && loadout.effects.waveWindowRemaining === 0 && !hadBoost && loadout.effects.waveBoostRemaining === 0) {
    cues.push("wave-miss");
  }

  return {
    player,
    rival,
    cues,
    world: {
      loadout,
      rivalEffects,
      orbs,
      clouds,
      contacts: stepContactBook(collided.book, tick.dt),
      nextCloudId,
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
  return stepLoadout({ held: null, effects }, dt).effects;
}

export function playerCloudRemaining(world: AbilityWorld): number {
  return ownCloudRemaining(world.clouds, "player");
}
