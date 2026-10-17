/**
 * Tunable control values. The stick dead zone can also be changed while playing
 * with the [ and ] keys. Raising it ignores more of a sticky or drifting stick.
 */
export const controlSettings = {
  stickDeadZone: 0.18,
  mouseYawSensitivity: 0.0032,
  mousePitchSensitivity: 0.0022,
  stickLookYawRate: 1.7,
  stickLookPitchRate: 1.7,
  /** How far the right stick can pitch, in radians. Large enough to look up or down. */
  lookPitchLimit: Math.PI / 2,
};

export function setStickDeadZone(value: number): number {
  controlSettings.stickDeadZone = Math.min(0.5, Math.max(0, value));
  return controlSettings.stickDeadZone;
}
