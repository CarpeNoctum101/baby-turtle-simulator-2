import { abilityCatalog, waveRules, type AbilityId } from "../abilities/catalog";
import type { RacerEffects } from "../abilities/abilityState";

export type AbilityHudTone = "empty" | "active" | "shield" | "spray" | "wave" | "trail";

export interface AbilityHudInput {
  held: AbilityId | null;
  effects: RacerEffects;
}

export interface AbilityTimer {
  label: string;
  /** Remaining time as a fraction of this effect's duration. */
  meter: number;
  tone: AbilityHudTone;
}

/**
 * The item box holds the next ability. The timer belongs only to the effect that is already running.
 */
export interface AbilityHudView {
  stored: AbilityId | null;
  timer: AbilityTimer | null;
}

/** Builds the item box and, when an effect is running, its duration bar. */
export function formatAbilityHud(input: AbilityHudInput): AbilityHudView {
  return {
    stored: input.held,
    timer: activeTimer(input),
  };
}

export function formatAbilityLine(view: AbilityHudView): string {
  const stored = view.stored ? abilityCatalog[view.stored].name : "empty";
  if (!view.timer) {
    return `Item box: ${stored}`;
  }
  return `Item box: ${stored}. ${view.timer.label}`;
}

export function formatPlace(place: number, field: number): string {
  return `${ordinal(place)} of ${field}`;
}

function activeTimer(input: AbilityHudInput): AbilityTimer | null {
  const { effects } = input;
  if (effects.shieldCharges > 0 && effects.shieldRemaining > 0) {
    return timer("Shell Guard", effects.shieldRemaining, abilityCatalog["shell-guard"].duration, "shield");
  }
  if (effects.frenzyRemaining > 0) {
    return timer("Flipper Frenzy", effects.frenzyRemaining, abilityCatalog["flipper-frenzy"].duration, "active");
  }
  if (effects.waveBoostRemaining > 0) {
    return timer("Wave boost", effects.waveBoostRemaining, waveRules.boostDuration, "wave");
  }
  if (effects.waveWindowRemaining > 0) {
    return timer("Enter the waves", effects.waveWindowRemaining, abilityCatalog["wave-rider"].duration, "wave");
  }
  if (effects.trailRemaining > 0) {
    return timer("Magnetic Sense", effects.trailRemaining, abilityCatalog["magnetic-sense"].duration, "trail");
  }
  if (effects.sprayRemaining > 0) {
    return timer("Sand Spray", effects.sprayRemaining, abilityCatalog["sand-spray"].duration, "spray");
  }
  return null;
}

function timer(name: string, remaining: number, duration: number, tone: AbilityHudTone): AbilityTimer {
  return {
    label: `${name} ${seconds(remaining)}s`,
    meter: fraction(remaining, duration),
    tone,
  };
}

function fraction(remaining: number, duration: number): number {
  if (duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, remaining / duration));
}

function seconds(value: number): string {
  return Math.max(0, value).toFixed(1);
}

function ordinal(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) {
    return `${place}th`;
  }
  const ones = place % 10;
  if (ones === 1) return `${place}st`;
  if (ones === 2) return `${place}nd`;
  if (ones === 3) return `${place}rd`;
  return `${place}th`;
}
