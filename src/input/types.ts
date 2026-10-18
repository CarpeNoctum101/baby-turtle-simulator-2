/** A button reading copied out of the browser Gamepad API. */
export interface ButtonSnapshot {
  pressed: boolean;
  /** Analog pressure from 0 to 1. Triggers use the values in between. */
  value: number;
}

/**
 * The parts of a browser gamepad this game understands.
 * Kept as plain data so tests can build a controller without a browser.
 */
export interface GamepadSnapshot {
  id: string;
  index: number;
  /**
   * "standard" means the browser published the usual Xbox-style layout.
   * Any other value means the button numbers are not known.
   */
  mapping: string;
  axes: readonly number[];
  buttons: readonly ButtonSnapshot[];
}

/** Which axes and buttons a particular controller layout uses. */
export interface StickMapping {
  steerAxis: number;
  throttleAxis: number;
  lookXAxis: number;
  lookYAxis: number;
  /** Null when this layout does not assign a brake button. */
  brakeButton: number | null;
  /** Null when this layout does not assign the ability button. Standard pads use RT. */
  abilityButton: number | null;
  /** Null when this layout does not assign the snap button. Standard pads use Y. */
  snapButton: number | null;
  /** Null when this layout does not assign the bubble button. Standard pads use RT, the same button as abilities. */
  shootButton: number | null;
  /** Null when this layout does not assign a menu button. Standard pads use the Menu button. */
  menuButton: number | null;
  /** Standard pads report "stick up" as a negative number. */
  invertThrottle: boolean;
  /** Stick right should yaw the camera the same way as moving the mouse right. */
  invertLookX: boolean;
  invertLookY: boolean;
}

export interface MovementIntent {
  /** -1 is reverse, 1 is forward. */
  throttle: number;
  /** -1 is left, 1 is right. */
  steer: number;
  brake: boolean;
  source: "keyboard" | "gamepad";
}
