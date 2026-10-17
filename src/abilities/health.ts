export interface Health {
  current: number;
  max: number;
}

/** How much each kind of hit costs. A live Shell Guard stops the hit, so it costs nothing. */
export const damageRules = {
  debris: 12,
  rivalBump: 8,
  sandSpray: 15,
  snap: 20,
} as const;

/** At zero health a turtle is worn out and crawls at this fraction of its normal speed. */
export const exhaustedSpeedScale = 0.4;

export function createHealth(max: number): Health {
  return { current: max, max };
}

export function applyDamage(health: Health, amount: number): Health {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return { ...health, current: Math.max(0, health.current - safe) };
}

export function isExhausted(health: Health): boolean {
  return health.current <= 0;
}

export function healthFraction(health: Health): number {
  return health.max > 0 ? Math.min(1, Math.max(0, health.current / health.max)) : 0;
}

export function exhaustionScale(health: Health): number {
  return isExhausted(health) ? exhaustedSpeedScale : 1;
}
