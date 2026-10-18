import type { CrawlModifiers } from "../movement/stepTurtle";
import {
  abilityCatalog,
  collisionSpeedScale,
  frenzyRules,
  sandRules,
  shellRules,
  waveRules,
  type AbilityId,
} from "./catalog";
import { clampDt } from "./clock";
import { spinRules } from "./specials";
import type { TurtleMotion } from "../movement/stepTurtle";

/**
 * A hit the shell can stop, or one it must ignore.
 * Ability effects and collision penalties are eligible. Ordinary ground is not.
 */
export type HitKind = "ability" | "collision" | "environment";

export interface RacerEffects {
  frenzyRemaining: number;
  shieldRemaining: number;
  /** 1 while the shell can still stop a hit, otherwise 0. */
  shieldCharges: number;
  slowRemaining: number;
  /** Sand Spray's own cloud clock. While this is above zero, another ability cannot start. */
  sprayRemaining: number;
  /** Seconds left to reach the wave zone. 0 means the window is closed. */
  waveWindowRemaining: number;
  waveBoostRemaining: number;
  trailRemaining: number;
  /** Kempy's spin dash. While this is above zero every hit is ignored. */
  spinRemaining: number;
  /** The turtle cannot move while this is above zero. A body slam does this to a rival. */
  stunRemaining: number;
}

export interface AbilityLoadout {
  held: AbilityId | null;
  /** A second stored ability, used only by turtles with two item slots. It moves up when `held` is spent. */
  spare: AbilityId | null;
  effects: RacerEffects;
}

export function createEffects(): RacerEffects {
  return {
    frenzyRemaining: 0,
    shieldRemaining: 0,
    shieldCharges: 0,
    slowRemaining: 0,
    sprayRemaining: 0,
    waveWindowRemaining: 0,
    waveBoostRemaining: 0,
    trailRemaining: 0,
    spinRemaining: 0,
    stunRemaining: 0,
  };
}

/** A fresh loadout. Restarting a race uses this, so no boost survives the rematch. */
export function createLoadout(): AbilityLoadout {
  return {
    held: null,
    spare: null,
    effects: createEffects(),
  };
}

export function isEligibleHit(kind: HitKind): boolean {
  return kind === "ability" || kind === "collision";
}

/**
 * Stops the first eligible hit and drops the shell.
 * A second call, or an environment hit, leaves the racer unprotected only if the charge is already gone.
 */
export function absorbHit(effects: RacerEffects, kind: HitKind): { effects: RacerEffects; blocked: boolean } {
  // A spinning turtle shrugs everything off and keeps its shell charge for later.
  if (isEligibleHit(kind) && effects.spinRemaining > 0) {
    return { effects, blocked: true };
  }
  if (!isEligibleHit(kind) || effects.shieldCharges < 1 || effects.shieldRemaining <= 0) {
    return { effects, blocked: false };
  }
  return {
    blocked: true,
    effects: {
      ...effects,
      shieldCharges: 0,
      shieldRemaining: 0,
    },
  };
}

/** Sand Spray's payoff. A live shell spends its one charge and the slow never starts. */
export function applySandSlow(effects: RacerEffects): { effects: RacerEffects; blocked: boolean } {
  const hit = absorbHit(effects, "ability");
  if (hit.blocked) {
    return hit;
  }
  return {
    blocked: false,
    effects: { ...hit.effects, slowRemaining: sandRules.slowDuration },
  };
}

/** Debris and rival bumps. The speed cut is skipped when the shell takes the hit. */
export function applyCollisionPenalty(
  motion: TurtleMotion,
  effects: RacerEffects,
): { motion: TurtleMotion; effects: RacerEffects; blocked: boolean } {
  const hit = absorbHit(effects, "collision");
  if (hit.blocked) {
    return { motion, effects: hit.effects, blocked: true };
  }
  return {
    blocked: false,
    effects: hit.effects,
    motion: { ...motion, speed: motion.speed * collisionSpeedScale },
  };
}

/**
 * Caps used by the crawl. Frenzy and a successful Wave Rider multiply together.
 * A sand slow multiplies after that, and a finished timer contributes nothing.
 */
export function speedModifiers(effects: RacerEffects): CrawlModifiers {
  let maxSpeedMultiplier = 1;
  let accelerationMultiplier = 1;
  if (effects.frenzyRemaining > 0) {
    maxSpeedMultiplier *= frenzyRules.maxSpeedMultiplier;
    accelerationMultiplier *= frenzyRules.accelerationMultiplier;
  }
  if (effects.waveBoostRemaining > 0) {
    maxSpeedMultiplier *= waveRules.maxSpeedMultiplier;
    accelerationMultiplier *= waveRules.accelerationMultiplier;
  }
  if (effects.spinRemaining > 0) {
    maxSpeedMultiplier *= spinRules.maxSpeedMultiplier;
    accelerationMultiplier *= spinRules.accelerationMultiplier;
  }
  if (effects.slowRemaining > 0) {
    maxSpeedMultiplier *= sandRules.slowMultiplier;
    accelerationMultiplier *= sandRules.slowMultiplier;
  }
  if (effects.stunRemaining > 0) {
    maxSpeedMultiplier = 0;
  }
  return { maxSpeedMultiplier, accelerationMultiplier };
}

export function stepEffects(effects: RacerEffects, dt: number): RacerEffects {
  const step = clampDt(dt);
  const shieldRemaining = Math.max(0, effects.shieldRemaining - step);
  return {
    frenzyRemaining: Math.max(0, effects.frenzyRemaining - step),
    shieldRemaining,
    shieldCharges: shieldRemaining > 0 ? effects.shieldCharges : 0,
    slowRemaining: Math.max(0, effects.slowRemaining - step),
    sprayRemaining: Math.max(0, effects.sprayRemaining - step),
    waveWindowRemaining: Math.max(0, effects.waveWindowRemaining - step),
    waveBoostRemaining: Math.max(0, effects.waveBoostRemaining - step),
    trailRemaining: Math.max(0, effects.trailRemaining - step),
    spinRemaining: Math.max(0, effects.spinRemaining - step),
    stunRemaining: Math.max(0, effects.stunRemaining - step),
  };
}

export function stepLoadout(loadout: AbilityLoadout, dt: number): AbilityLoadout {
  const step = clampDt(dt);
  return {
    ...loadout,
    effects: stepEffects(loadout.effects, step),
  };
}

export function holdAbility(loadout: AbilityLoadout, ability: AbilityId): AbilityLoadout {
  return { ...loadout, held: ability };
}

/** True while one of your abilities is still going, so a second one cannot start. */
export function abilityIsRunning(effects: RacerEffects): boolean {
  return (
    effects.frenzyRemaining > 0 ||
    effects.shieldRemaining > 0 ||
    effects.sprayRemaining > 0 ||
    effects.waveWindowRemaining > 0 ||
    effects.waveBoostRemaining > 0 ||
    effects.trailRemaining > 0
  );
}

/**
 * Spends the ability stored in the item slot and starts its duration.
 * Refuses the press while another of your abilities is still running.
 */
export function beginAbility(
  loadout: AbilityLoadout,
  ability: AbilityId,
): { loadout: AbilityLoadout; started: boolean } {
  if (loadout.held !== ability || abilityIsRunning(loadout.effects)) {
    return { loadout, started: false };
  }
  const rules = abilityCatalog[ability];
  const spent: AbilityLoadout = {
    ...loadout,
    held: loadout.spare,
    spare: null,
  };
  if (ability === "flipper-frenzy") {
    return {
      started: true,
      loadout: {
        ...spent,
        effects: { ...loadout.effects, frenzyRemaining: rules.duration },
      },
    };
  }
  if (ability === "shell-guard") {
    return {
      started: true,
      loadout: {
        ...spent,
        effects: {
          ...loadout.effects,
          shieldRemaining: rules.duration,
          shieldCharges: shellRules.charges,
        },
      },
    };
  }
  if (ability === "wave-rider") {
    return {
      started: true,
      loadout: {
        ...spent,
        effects: { ...loadout.effects, waveWindowRemaining: rules.duration },
      },
    };
  }
  if (ability === "magnetic-sense") {
    return {
      started: true,
      loadout: {
        ...spent,
        effects: { ...loadout.effects, trailRemaining: rules.duration },
      },
    };
  }
  return {
    started: true,
    loadout: {
      ...spent,
      effects: { ...loadout.effects, sprayRemaining: rules.duration },
    },
  };
}

/**
 * Wave Rider's timing check. The boost starts the first moment the turtle is in the
 * zone while the window is open, including the press itself. A closed window does nothing.
 */
export function resolveWaveWindow(effects: RacerEffects, inWaveZone: boolean): { effects: RacerEffects; triggered: boolean } {
  if (effects.waveWindowRemaining <= 0 || !inWaveZone) {
    return { effects, triggered: false };
  }
  return {
    triggered: true,
    effects: {
      ...effects,
      waveWindowRemaining: 0,
      waveBoostRemaining: waveRules.boostDuration,
    },
  };
}

export function isTrailVisible(effects: RacerEffects): boolean {
  return effects.trailRemaining > 0;
}
