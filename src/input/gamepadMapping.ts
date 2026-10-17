import type { StickMapping } from "./types";

/**
 * Layout used only when the browser reports mapping === "standard".
 * That is the common Xbox-style arrangement: left stick on axes 0 and 1,
 * right stick on axes 2 and 3, and B on button 1.
 */
export const standardStickMapping: StickMapping = {
  steerAxis: 0,
  throttleAxis: 1,
  lookXAxis: 2,
  lookYAxis: 3,
  brakeButton: 1,
  abilityButton: 2,
  invertThrottle: true,
  invertLookX: true,
  invertLookY: true,
};

/**
 * Used when a controller does not advertise the standard layout.
 * Axes 0 and 1 are still read as a left stick, because that is the usual hardware
 * placement, but no button is treated as brake. The HUD shows the raw button numbers.
 */
export const unknownStickMapping: StickMapping = {
  steerAxis: 0,
  throttleAxis: 1,
  lookXAxis: 2,
  lookYAxis: 3,
  brakeButton: null,
  abilityButton: null,
  invertThrottle: true,
  invertLookX: true,
  invertLookY: true,
};

const standardButtonNames: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "View",
  9: "Menu",
  10: "LS",
  11: "RS",
  12: "D-up",
  13: "D-down",
  14: "D-left",
  15: "D-right",
};

export function mappingForGamepad(mapping: string): StickMapping {
  return mapping === "standard" ? standardStickMapping : unknownStickMapping;
}

export function describeButton(index: number, mapping: string): string {
  const standardName = mapping === "standard" ? standardButtonNames[index] : undefined;
  return standardName ? `${standardName} (${index})` : `button ${index}`;
}
