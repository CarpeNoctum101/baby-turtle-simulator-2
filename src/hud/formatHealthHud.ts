import { healthFraction, isExhausted, type Health } from "../abilities/health";
import type { RacerEffects } from "../abilities/abilityState";
import { snapRules, type SnapState } from "../abilities/snap";
import { slamRules, specialNames, spinRules, type SlamState, type SpecialId, type SpinState } from "../abilities/specials";

export type HealthTone = "ok" | "low" | "empty";

export interface HealthView {
  /** 0 to 1, for the width of the bar. */
  fraction: number;
  label: string;
  tone: HealthTone;
}

export function formatHealth(health: Health, name = "Health"): HealthView {
  const fraction = healthFraction(health);
  const current = Math.ceil(health.current);
  if (isExhausted(health)) {
    return { fraction, label: `${name} 0/${health.max} · worn out`, tone: "empty" };
  }
  return { fraction, label: `${name} ${current}/${health.max}`, tone: fraction <= 0.3 ? "low" : "ok" };
}

export interface SpecialView {
  ready: boolean;
  /** Fill of the cooldown bar. 1 means ready. */
  meter: number;
  label: string;
}

export interface SpecialHudInput {
  kind: SpecialId;
  snap: SnapState;
  slam: SlamState;
  spin: SpinState;
  effects: RacerEffects;
}

/** One cooldown readout for whichever move the turtle has. */
export function formatSpecial(input: SpecialHudInput): SpecialView {
  const name = specialNames[input.kind];
  let cooldown = 0;
  let total = 1;
  if (input.kind === "snap") {
    cooldown = input.snap.cooldownRemaining;
    total = snapRules.cooldown;
  } else if (input.kind === "slam") {
    cooldown = input.slam.cooldownRemaining;
    total = slamRules.cooldown;
  } else {
    cooldown = input.spin.cooldownRemaining;
    total = spinRules.cooldown;
    if (input.effects.spinRemaining > 0) {
      return { ready: false, meter: input.effects.spinRemaining / spinRules.duration, label: `Spinning ${input.effects.spinRemaining.toFixed(1)}s` };
    }
  }
  if (cooldown <= 0) {
    return { ready: true, meter: 1, label: `${name} ready (E / Y)` };
  }
  return { ready: false, meter: 1 - cooldown / total, label: `${name} ${cooldown.toFixed(1)}s` };
}
