/**
 * Turns a raw stick axis into a control value.
 * Values inside the dead zone become 0, so a resting stick does not steer.
 * Values outside it are rescaled so the first movement is gentle and full tilt is still 1.
 */
export function applyDeadZone(value: number, deadZone: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(deadZone)) {
    return 0;
  }

  const clampedDeadZone = Math.min(0.95, Math.max(0, deadZone));
  const clamped = Math.min(1, Math.max(-1, value));
  const magnitude = Math.abs(clamped);
  if (magnitude <= clampedDeadZone) {
    return 0;
  }

  const scaled = (magnitude - clampedDeadZone) / (1 - clampedDeadZone);
  return Math.sign(clamped) * Math.min(1, scaled);
}
