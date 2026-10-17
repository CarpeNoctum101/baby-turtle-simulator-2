/** Long frames must not skip a whole cooldown or boost. Matches the race clock. */
export function clampDt(dt: number): number {
  if (!Number.isFinite(dt)) {
    return 0;
  }
  return Math.min(Math.max(dt, 0), 0.05);
}
