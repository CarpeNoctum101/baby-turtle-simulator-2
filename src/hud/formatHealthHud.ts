import { healthFraction, isExhausted, type Health } from "../abilities/health";
import { snapReady, snapRules, type SnapState } from "../abilities/snap";

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

export interface SnapView {
  ready: boolean;
  /** Fill of the cooldown bar. 1 means ready. */
  meter: number;
  label: string;
}

export function formatSnap(snap: SnapState): SnapView {
  if (snapReady(snap)) {
    return { ready: true, meter: 1, label: "Snap ready (E / Y)" };
  }
  return {
    ready: false,
    meter: 1 - snap.cooldownRemaining / snapRules.cooldown,
    label: `Snap ${snap.cooldownRemaining.toFixed(1)}s`,
  };
}
