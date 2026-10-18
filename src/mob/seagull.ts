import { surfaceAt } from "../movement/course";
import { clampDt } from "../abilities/clock";

/**
 * A seagull that guards a patch of beach. Coming close wakes it up; it chases at a little
 * under the regular turtle's top speed, and a touch knocks both of them apart.
 * When the turtle runs out of health the gull swoops in, carries it back toward the nest, and drops it.
 */
export const seagullRules = {
  /** Chase speed as a fraction of the regular turtle's top speed on the ground below the gull. */
  speedFactor: 0.9,
  aggroRadius: 10,
  /** Past this distance from its home the gull gives up and flies back. */
  leashRadius: 18,
  hitRange: 1.1,
  /** A landed hit costs this share of the turtle's maximum health, so it scales with the turtle type. */
  damageFraction: 0.33,
  /** Starting push speeds in metres per second. Each fades out by `knockDecay`. */
  playerKnockSpeed: 8,
  gullKnockSpeed: 7,
  knockDecay: 4.5,
  /** After a strike the gull is dazed for this long before it chases again. */
  recoverTime: 1.3,
  /** Fliers: cruising height while circling, and the height they keep while stalking. */
  cruiseHeight: 5.5,
  circleRadius: 3,
  circleSpeed: 0.9,
  /** A flier starts its dive once it is this close (horizontally) to the turtle. */
  diveRange: 5,
  diveSpeed: 9,
  /** A diving gull only counts as touching the turtle below this height. */
  diveHitHeight: 1.8,
  /** After a dive that misses, the gull climbs away for this long before stalking again. */
  climbTime: 1.4,
  /** How long a snap leaves a gull flat on the sand, unable to attack. */
  stunTime: 2.5,
  perchHeight: 0.56,
  flyHeight: 1.1,
  /** Rescue (carry) tuning. */
  swoopSpeed: 11,
  grabTime: 0.6,
  carryTime: 2.8,
  carryDistance: 22,
  carryHeight: 3.2,
  /** How far below the gull the turtle hangs. */
  dangle: 1,
  dropTime: 0.8,
  gravity: 20,
  returnSpeed: 6,
  /** Seconds the gull ignores the player after a rescue. */
  graceAfterRescue: 6,
  /** The turtle is set down at full health after a rescue. */
  restoreFraction: 1,
  /** The carry never goes further back than this. */
  nestLimitZ: -30,
} as const;

export type SeagullPhase = "perched" | "chase" | "dive" | "climb" | "recover" | "stunned" | "swoop" | "grab" | "carry" | "drop" | "return";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Seagull {
  id: string;
  home: Vec2;
  x: number;
  y: number;
  z: number;
  /** Radians. 0 faces +Z, like the turtles. */
  heading: number;
  phase: SeagullPhase;
  phaseTime: number;
  knock: Vec2;
  /** Seconds left in which the gull will not notice the player. */
  grace: number;
  carryFrom: Vec2;
  carryTo: Vec2;
  /** True for gulls that circle high up and dive at the turtle instead of walking in low. */
  flier: boolean;
  /** Seconds left inside a bubble. The gull stays put and cannot strike until this reaches zero. */
  bubble: number;
  /** Where a dive is headed, and where it began. */
  diveTo: Vec2;
  diveFrom: { x: number; y: number; z: number };
}

export function createSeagull(id: string, home: Vec2, flier = false): Seagull {
  return {
    flier,
    diveTo: { x: home.x, z: home.z },
    diveFrom: { x: home.x, y: 0, z: home.z },
    id,
    home,
    x: home.x,
    y: flier ? seagullRules.cruiseHeight : seagullRules.perchHeight,
    z: home.z,
    heading: Math.PI,
    phase: "perched",
    phaseTime: 0,
    knock: { x: 0, z: 0 },
    grace: 0,
    carryFrom: { x: home.x, z: home.z },
    carryTo: { x: home.x, z: home.z },
    bubble: 0,
  };
}

/**
 * Where the game puts seagulls.
 * Ground gulls are turned off for now. Only the fliers remain: they circle high and dive.
 * The walking homes were gull-1 near the dry sand and gull-3 on the wet sand.
 */
export const seagullSpawns: readonly { id: string; home: Vec2; flier?: boolean }[] = [
  { id: "gull-2", home: { x: 7, z: 2 }, flier: true },
  { id: "gull-4", home: { x: -6, z: 32 }, flier: true },
];

export function isRescuePhase(phase: SeagullPhase): boolean {
  return phase === "swoop" || phase === "grab" || phase === "carry" || phase === "drop";
}

/** Seagull chase speed at its current spot. */
export function chaseSpeed(z: number): number {
  return surfaceAt(z).maxSpeed * seagullRules.speedFactor;
}

/** The turtle's pose while a gull has it. y is the height above the sand. */
export interface RescuePose {
  x: number;
  y: number;
  z: number;
}

export interface SeagullInput {
  dt: number;
  player: Vec2;
  /** True while the player may be attacked. False during another gull's rescue. */
  canAttack: boolean;
}

export interface SeagullStep {
  gull: Seagull;
  /** True on the frame the gull reaches the turtle and can strike. */
  contact: boolean;
  pose: RescuePose | null;
  /** True on the frame the turtle is set down and the rescue is over. */
  rescueDone: boolean;
  /** True on the frame the gull first clamps onto the turtle. */
  grabbed: boolean;
}

/** Starts the rescue. The gull drops whatever it was doing and flies to the turtle. */
export function beginRescue(gull: Seagull): Seagull {
  return { ...gull, phase: "swoop", phaseTime: 0, knock: { x: 0, z: 0 } };
}

/** The gull bounces away from the turtle and is dazed for a moment. */
export function strikeSeagull(gull: Seagull, player: Vec2): Seagull {
  const away = unit(gull.x - player.x, gull.z - player.z, Math.sin(gull.heading + Math.PI), Math.cos(gull.heading + Math.PI));
  return {
    ...gull,
    phase: "recover",
    phaseTime: 0,
    knock: { x: away.x * seagullRules.gullKnockSpeed, z: away.z * seagullRules.gullKnockSpeed },
  };
}

/** A bubble closes around the gull. A rescue already in progress is left alone. */
export function trapSeagull(gull: Seagull, seconds: number): Seagull {
  if (isRescuePhase(gull.phase)) {
    return gull;
  }
  return { ...gull, bubble: Math.max(gull.bubble, seconds), knock: { x: 0, z: 0 } };
}

/** A snap lands: the gull drops to the sand, gets pushed back a little, and cannot attack until it recovers. */
export function stunSeagull(gull: Seagull, from: Vec2): Seagull {
  if (isRescuePhase(gull.phase)) {
    return gull;
  }
  const away = unit(gull.x - from.x, gull.z - from.z, Math.sin(gull.heading + Math.PI), Math.cos(gull.heading + Math.PI));
  const push = seagullRules.gullKnockSpeed * 0.6;
  return { ...gull, phase: "stunned", phaseTime: 0, knock: { x: away.x * push, z: away.z * push } };
}

/** The push the turtle receives when the gull strikes it, pointing from the gull through the turtle. */
export function playerKnockFrom(gull: Seagull, player: Vec2): Vec2 {
  const away = unit(player.x - gull.x, player.z - gull.z, Math.sin(gull.heading), Math.cos(gull.heading));
  return { x: away.x * seagullRules.playerKnockSpeed, z: away.z * seagullRules.playerKnockSpeed };
}

/** Moves a knock-back along and fades it. Returns how far to shift this frame. */
export function stepKnock(knock: Vec2, dt: number): { shift: Vec2; knock: Vec2 } {
  const step = clampDt(dt);
  const fade = Math.exp(-seagullRules.knockDecay * step);
  const next = { x: knock.x * fade, z: knock.z * fade };
  const settled = Math.hypot(next.x, next.z) < 0.05;
  return {
    shift: { x: knock.x * step, z: knock.z * step },
    knock: settled ? { x: 0, z: 0 } : next,
  };
}

export function stepSeagull(gull: Seagull, input: SeagullInput): SeagullStep {
  const dt = clampDt(input.dt);
  if (gull.bubble > 0) {
    return {
      gull: { ...gull, bubble: Math.max(0, gull.bubble - dt), knock: { x: 0, z: 0 } },
      contact: false,
      pose: null,
      rescueDone: false,
      grabbed: false,
    };
  }
  let next: Seagull = { ...gull, phaseTime: gull.phaseTime + dt, grace: Math.max(0, gull.grace - dt) };
  const toPlayer = distance(next, input.player);
  let contact = false;
  let pose: RescuePose | null = null;
  let rescueDone = false;
  let grabbed = false;

  if (!isRescuePhase(next.phase)) {
    const moved = stepKnock(next.knock, dt);
    next = { ...next, x: next.x + moved.shift.x, z: next.z + moved.shift.z, knock: moved.knock };
  }

  switch (next.phase) {
    case "perched": {
      next = next.flier ? circleHome(next, dt) : settleAt(next, next.home, dt, seagullRules.perchHeight);
      if (input.canAttack && next.grace <= 0 && toPlayer <= seagullRules.aggroRadius) {
        next = { ...next, phase: "chase", phaseTime: 0 };
      }
      break;
    }
    case "chase": {
      if (!input.canAttack || next.grace > 0 || distance(next, next.home) > seagullRules.leashRadius) {
        next = { ...next, phase: "return", phaseTime: 0 };
        break;
      }
      if (next.flier) {
        // Stalk from above, then commit to a dive at where the turtle is right now.
        next = flyToward(next, input.player, chaseSpeed(next.z), dt, seagullRules.cruiseHeight);
        if (distance(next, input.player) <= seagullRules.diveRange) {
          next = {
            ...next,
            phase: "dive",
            phaseTime: 0,
            diveTo: { x: input.player.x, z: input.player.z },
            diveFrom: { x: next.x, y: next.y, z: next.z },
          };
        }
        break;
      }
      next = flyToward(next, input.player, chaseSpeed(next.z), dt, seagullRules.flyHeight);
      contact = distance(next, input.player) <= seagullRules.hitRange;
      break;
    }
    case "dive": {
      if (!input.canAttack) {
        next = { ...next, phase: "return", phaseTime: 0 };
        break;
      }
      const total = Math.max(0.5, distance(next.diveFrom, next.diveTo));
      next = flyToward(next, next.diveTo, seagullRules.diveSpeed, dt, next.y);
      const left = distance(next, next.diveTo);
      const progress = Math.min(1, 1 - left / total);
      next = { ...next, y: next.diveFrom.y + (seagullRules.flyHeight - next.diveFrom.y) * progress };
      contact = next.y <= seagullRules.diveHitHeight && distance(next, input.player) <= seagullRules.hitRange;
      if (!contact && left <= 0.05) {
        next = { ...next, phase: "climb", phaseTime: 0 };
      }
      break;
    }
    case "climb": {
      // A missed dive carries on past the turtle while climbing back up.
      const ahead = { x: next.x + Math.sin(next.heading) * 3, z: next.z + Math.cos(next.heading) * 3 };
      next = { ...flyToward(next, ahead, chaseSpeed(next.z) * 1.5, dt, seagullRules.cruiseHeight), heading: next.heading };
      if (next.phaseTime >= seagullRules.climbTime) {
        next = { ...next, phase: "chase", phaseTime: 0 };
      }
      break;
    }
    case "recover": {
      next = {
        ...next,
        y: approach(next.y, next.flier ? seagullRules.cruiseHeight : seagullRules.flyHeight + 0.4, 3 * dt),
      };
      if (next.phaseTime >= seagullRules.recoverTime) {
        next = { ...next, phase: "chase", phaseTime: 0 };
      }
      break;
    }
    case "stunned": {
      next = { ...next, y: approach(next.y, seagullRules.perchHeight, 3 * dt) };
      if (next.phaseTime >= seagullRules.stunTime) {
        next = { ...next, phase: "chase", phaseTime: 0 };
      }
      break;
    }
    case "swoop": {
      next = flyToward(next, input.player, seagullRules.swoopSpeed, dt, seagullRules.dangle + 0.1);
      if (distance(next, input.player) <= 0.4) {
        const target = {
          x: next.x,
          z: Math.max(seagullRules.nestLimitZ, input.player.z - seagullRules.carryDistance),
        };
        next = { ...next, phase: "grab", phaseTime: 0, carryFrom: { x: next.x, z: next.z }, carryTo: target };
        grabbed = true;
      }
      pose = { x: input.player.x, y: 0, z: input.player.z };
      break;
    }
    case "grab": {
      pose = { x: next.carryFrom.x, y: 0, z: next.carryFrom.z };
      next = { ...next, x: next.carryFrom.x, z: next.carryFrom.z, y: seagullRules.dangle + 0.1 };
      if (next.phaseTime >= seagullRules.grabTime) {
        next = { ...next, phase: "carry", phaseTime: 0 };
      }
      break;
    }
    case "carry": {
      const t = Math.min(1, next.phaseTime / seagullRules.carryTime);
      const glide = t * t * (3 - 2 * t);
      const lift = Math.min(1, t / 0.2);
      const y = seagullRules.dangle + 0.1 + (seagullRules.carryHeight - seagullRules.dangle - 0.1) * lift + Math.sin(t * 14) * 0.08;
      const x = next.carryFrom.x + (next.carryTo.x - next.carryFrom.x) * glide;
      const z = next.carryFrom.z + (next.carryTo.z - next.carryFrom.z) * glide;
      const heading = Math.atan2(next.carryTo.x - next.carryFrom.x, next.carryTo.z - next.carryFrom.z) || Math.PI;
      next = { ...next, x, y, z, heading };
      pose = { x, y: Math.max(0, y - seagullRules.dangle), z };
      if (t >= 1) {
        next = { ...next, phase: "drop", phaseTime: 0 };
      }
      break;
    }
    case "drop": {
      const start = seagullRules.carryHeight - seagullRules.dangle;
      const fallen = 0.5 * seagullRules.gravity * next.phaseTime * next.phaseTime;
      const turtleY = Math.max(0, start - fallen);
      pose = { x: next.x, y: turtleY, z: next.z };
      next = { ...next, y: next.y + 2.5 * dt };
      if (next.phaseTime >= seagullRules.dropTime && turtleY === 0) {
        rescueDone = true;
        next = { ...next, phase: "return", phaseTime: 0, grace: seagullRules.graceAfterRescue };
      }
      break;
    }
    case "return": {
      next = flyToward(next, next.home, seagullRules.returnSpeed, dt, next.flier ? seagullRules.cruiseHeight : seagullRules.flyHeight);
      if (distance(next, next.home) <= 0.3) {
        next = { ...next, phase: "perched", phaseTime: 0 };
      }
      break;
    }
  }

  return { gull: next, contact, pose, rescueDone, grabbed };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function unit(dx: number, dz: number, fallbackX: number, fallbackZ: number): Vec2 {
  const length = Math.hypot(dx, dz);
  if (length < 0.001) {
    return { x: fallbackX, z: fallbackZ };
  }
  return { x: dx / length, z: dz / length };
}

function approach(current: number, target: number, maxDelta: number): number {
  return current < target ? Math.min(target, current + maxDelta) : Math.max(target, current - maxDelta);
}

function flyToward(gull: Seagull, target: Vec2, speed: number, dt: number, height: number): Seagull {
  const dx = target.x - gull.x;
  const dz = target.z - gull.z;
  const gap = Math.hypot(dx, dz);
  const travel = Math.min(gap, speed * dt);
  const heading = gap > 0.001 ? Math.atan2(dx, dz) : gull.heading;
  return {
    ...gull,
    x: gap > 0.001 ? gull.x + (dx / gap) * travel : gull.x,
    z: gap > 0.001 ? gull.z + (dz / gap) * travel : gull.z,
    y: approach(gull.y, height, 4 * dt),
    heading,
  };
}

function settleAt(gull: Seagull, spot: Vec2, dt: number, height: number): Seagull {
  const settled = flyToward(gull, spot, seagullRules.returnSpeed, dt, height);
  return { ...settled, heading: gull.heading };
}

/** A flier idles by looping around its home spot high in the air. */
function circleHome(gull: Seagull, dt: number): Seagull {
  const angle = gull.phaseTime * seagullRules.circleSpeed;
  const spot = {
    x: gull.home.x + Math.cos(angle) * seagullRules.circleRadius,
    z: gull.home.z + Math.sin(angle) * seagullRules.circleRadius,
  };
  return flyToward(gull, spot, seagullRules.returnSpeed, dt, seagullRules.cruiseHeight);
}

/**
 * What the ground should show about a flying gull, so the player can see a dive coming.
 * `ring` runs from 0 (nothing) to 1 (strongest): a faint circle under the gull as wide as its dive range.
 * `marker` is where a dive in progress will land.
 */
export function diveWarning(gull: Seagull): { ring: number; marker: Vec2 | null } {
  if (!gull.flier) {
    return { ring: 0, marker: null };
  }
  switch (gull.phase) {
    case "perched":
      return { ring: 0.35, marker: null };
    case "chase":
      return { ring: 0.7, marker: null };
    case "dive":
      return { ring: 1, marker: gull.diveTo };
    case "climb":
    case "recover":
    case "return":
      return { ring: 0.4, marker: null };
    default:
      return { ring: 0, marker: null };
  }
}
