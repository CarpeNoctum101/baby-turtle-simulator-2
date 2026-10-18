import { bubbleRules, consumeBubbleHits, launchBubble, stepBubbleShots, type BubbleShot } from "../src/abilities/bubble";
import { bubbleShotRules } from "../src/abilities/catalog";
import {
  beginRescue,
  createSeagull,
  isRescuePhase,
  seagullRules,
  seagullSpawns,
  stepSeagull,
  strikeSeagull,
  trapSeagull,
  type Seagull,
  type SeagullPhase,
} from "../src/mob/seagull";
import {
  createNetHazards,
  netRules,
  netThrowerSpawns,
  stepNetHazards,
  type NetPhase,
  type NetThrower,
} from "../src/mob/netThrower";

/** How often the room advances the shared beach. Shorter than a bubble can tunnel through a turtle. */
export const beachStepMs = 50;

export interface BeachPlayer {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  connected: boolean;
  /** Greater than 0 once the server has accepted a finish. */
  place: number;
  /** Shell Guard is up, so the next net, gull, or bubble is spent on the shell. */
  guard: boolean;
}

export interface BeachRacer {
  id: string;
  health: number;
  maxHealth: number;
  netSlow: number;
  netGrace: number;
  bubble: number;
  lift: number;
  x: number;
  z: number;
  gunShots: number;
  /** Server time when Bubble Shot expires. */
  gunUntil: number;
  /** Server time when another bubble may be fired. */
  gunReadyAt: number;
}

export interface TrackedSeagull extends Seagull {
  /** The one turtle this gull is chasing. Null while it is waiting on its perch. */
  targetId: string | null;
}

export interface TrackedNet extends NetThrower {
  /** The one turtle this throw is aimed at. Null while the thrower is waiting. */
  targetId: string | null;
}

export interface TrackedBubble extends BubbleShot {
  id: string;
  ownerId: string;
}

export interface BeachHazards {
  steppedAt: number;
  /** Turtle type health, remembered even before the first race step. */
  bodies: Record<string, number>;
  seagulls: TrackedSeagull[];
  nets: TrackedNet[];
  bubbles: TrackedBubble[];
  racers: BeachRacer[];
  nextBubble: number;
}

export interface BeachStep {
  hazards: BeachHazards;
  /** Carried turtles. The server writes these over the client's pose. */
  poses: { id: string; x: number; z: number }[];
  /** Shell Guard was used and should come down. */
  cleared: string[];
}

export interface WorldSeagull {
  id: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  phase: SeagullPhase;
  bubble: number;
  flier: boolean;
  diveX: number;
  diveZ: number;
}

export interface WorldNet {
  id: string;
  phase: NetPhase;
  time: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
}

export interface WorldBubble {
  x: number;
  y: number;
  z: number;
}

export interface WorldRacer {
  id: string;
  health: number;
  maxHealth: number;
  netSlow: number;
  bubble: number;
  lift: number;
  x: number;
  z: number;
  gunShots: number;
  gunSeconds: number;
}

export interface WorldView {
  seagulls: WorldSeagull[];
  nets: WorldNet[];
  bubbles: WorldBubble[];
  racers: WorldRacer[];
}

const gullPhases: readonly SeagullPhase[] = [
  "perched", "chase", "dive", "climb", "recover", "stunned", "swoop", "grab", "carry", "drop", "return",
];
const netPhases: readonly NetPhase[] = ["idle", "aim", "flight", "ground", "rest"];
const knownHealth = [35, 50, 58, 75];

export function createBeachHazards(now: number): BeachHazards {
  return {
    steppedAt: now,
    bodies: {},
    seagulls: seagullSpawns.map((spawn) => ({ ...createSeagull(spawn.id, spawn.home, spawn.flier), targetId: null })),
    nets: createNetHazards(netThrowerSpawns).throwers.map((thrower) => ({ ...thrower, targetId: null })),
    bubbles: [],
    racers: [],
    nextBubble: 1,
  };
}

/** Remembers which turtle body this hatchling brought, so a gull bite uses that health bar. */
export function rememberBody(hazards: BeachHazards, playerId: string, maxHealth: number): BeachHazards {
  const max = knownHealth.includes(maxHealth) ? maxHealth : 50;
  const bodies = { ...hazards.bodies, [playerId]: max };
  const racers = hazards.racers.map((racer) => {
    if (racer.id !== playerId) {
      return racer;
    }
    const fraction = racer.maxHealth > 0 ? racer.health / racer.maxHealth : 1;
    return { ...racer, maxHealth: max, health: Math.max(0, Math.round(fraction * max)) };
  });
  return { ...hazards, bodies, racers };
}

/** Bubble Shot was accepted. The hatchling gets the shared three shots. */
export function armBubbleGun(hazards: BeachHazards, playerId: string, until: number, now: number): BeachHazards {
  return {
    ...hazards,
    racers: hazards.racers.map((racer) => (
      racer.id === playerId
        ? { ...racer, gunShots: bubbleShotRules.shots, gunUntil: until, gunReadyAt: now }
        : racer
    )),
  };
}

export function fireBubble(
  hazards: BeachHazards,
  playerId: string,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  now: number,
): { ok: true; hazards: BeachHazards } | { ok: false } {
  const racer = hazards.racers.find((entry) => entry.id === playerId);
  if (!racer || racer.gunShots <= 0 || now < racer.gunReadyAt || now > racer.gunUntil) {
    return { ok: false };
  }
  if (Math.hypot(origin.x - racer.x, origin.z - racer.z) > 4) {
    return { ok: false };
  }
  const shot = launchBubble(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
  if (!shot) {
    return { ok: false };
  }
  const bubble: TrackedBubble = { ...shot, id: `bubble-${hazards.nextBubble}`, ownerId: playerId };
  return {
    ok: true,
    hazards: {
      ...hazards,
      nextBubble: hazards.nextBubble + 1,
      bubbles: [...hazards.bubbles, bubble].slice(-24),
      racers: hazards.racers.map((entry) => (
        entry.id === playerId
          ? { ...entry, gunShots: entry.gunShots - 1, gunReadyAt: now + bubbleRules.cooldown * 1000 }
          : entry
      )),
    },
  };
}

/** One mash while netted. The room, not the browser, shortens the slow. */
export function struggleBeach(hazards: BeachHazards, playerId: string): BeachHazards {
  return {
    ...hazards,
    racers: hazards.racers.map((racer) => {
      if (racer.id !== playerId || racer.netSlow <= 0) {
        return racer;
      }
      const cut = Math.min(racer.netSlow, netRules.struggleSeconds);
      return { ...racer, netSlow: racer.netSlow - cut, netGrace: Math.max(0, racer.netGrace - cut) };
    }),
  };
}

/**
 * Advances the one shared beach.
 * Each gull and each net thrower locks a single turtle and will not switch until that action ends.
 */
export function stepBeach(hazards: BeachHazards, players: readonly BeachPlayer[], now: number): BeachStep {
  const elapsed = now - hazards.steppedAt;
  let current = syncRacers(hazards, players);
  if (elapsed < beachStepMs) {
    return { hazards: current, poses: carriedPoses(current), cleared: [] };
  }
  let left = Math.min(0.2, elapsed / 1000);
  const cleared: string[] = [];
  while (left > 0) {
    const slice = Math.min(0.05, left);
    const stepped = stepSlice(current, players, slice);
    current = stepped.hazards;
    for (const id of stepped.cleared) {
      if (!cleared.includes(id)) {
        cleared.push(id);
      }
    }
    left -= slice;
  }
  current = { ...current, steppedAt: now };
  return { hazards: current, poses: carriedPoses(current), cleared };
}

export function worldView(hazards: BeachHazards, now: number): WorldView {
  return {
    seagulls: hazards.seagulls.map((gull) => ({
      id: gull.id,
      x: gull.x,
      y: gull.y,
      z: gull.z,
      heading: gull.heading,
      phase: gull.phase,
      bubble: gull.bubble,
      flier: gull.flier,
      diveX: gull.diveTo.x,
      diveZ: gull.diveTo.z,
    })),
    nets: hazards.nets.map((net) => ({
      id: net.id,
      phase: net.phase,
      time: net.time,
      x: net.x,
      z: net.z,
      targetX: net.target.x,
      targetZ: net.target.z,
    })),
    bubbles: hazards.bubbles.map((bubble) => ({ x: bubble.x, y: bubble.y, z: bubble.z })),
    racers: hazards.racers.map((racer) => ({
      id: racer.id,
      health: racer.health,
      maxHealth: racer.maxHealth,
      netSlow: racer.netSlow,
      bubble: racer.bubble,
      lift: racer.lift,
      x: racer.x,
      z: racer.z,
      gunShots: racer.gunShots,
      gunSeconds: Math.max(0, (racer.gunUntil - now) / 1000),
    })),
  };
}

export function readWorldMessage(value: unknown): (WorldView & { type: "world" }) | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const message = value as Record<string, unknown>;
  if (message.type !== "world" || !Array.isArray(message.seagulls) || !Array.isArray(message.nets) || !Array.isArray(message.bubbles) || !Array.isArray(message.racers)) {
    return null;
  }
  if (message.seagulls.length > 8 || message.nets.length > 4 || message.bubbles.length > 24 || message.racers.length > 8) {
    return null;
  }
  const seagulls: WorldSeagull[] = [];
  for (const entry of message.seagulls) {
    const gull = readSeagull(entry);
    if (!gull) {
      return null;
    }
    seagulls.push(gull);
  }
  const nets: WorldNet[] = [];
  for (const entry of message.nets) {
    const net = readNet(entry);
    if (!net) {
      return null;
    }
    nets.push(net);
  }
  const bubbles: WorldBubble[] = [];
  for (const entry of message.bubbles) {
    const bubble = readBubble(entry);
    if (!bubble) {
      return null;
    }
    bubbles.push(bubble);
  }
  const racers: WorldRacer[] = [];
  for (const entry of message.racers) {
    const racer = readRacer(entry);
    if (!racer) {
      return null;
    }
    racers.push(racer);
  }
  return { type: "world", seagulls, nets, bubbles, racers };
}

function stepSlice(hazards: BeachHazards, players: readonly BeachPlayer[], dt: number): BeachStep {
  const cleared: string[] = [];
  let racers = hazards.racers.map((racer) => ({
    ...racer,
    netSlow: Math.max(0, racer.netSlow - dt),
    netGrace: Math.max(0, racer.netGrace - dt),
    bubble: Math.max(0, racer.bubble - dt),
    lift: 0,
  }));
  const live = players.filter((player) => player.connected && player.place === 0);
  let seagulls = hazards.seagulls.map((gull) => ({ ...gull }));
  const gullBusy = new Set(seagulls.filter((gull) => gull.phase !== "perched" && gull.targetId).map((gull) => gull.targetId as string));
  seagulls = seagulls.map((gull) => {
    let targetId = gull.phase === "perched" ? null : gull.targetId;
    if (gull.phase === "perched") {
      targetId = nearestId(gull, live, gullBusy, seagullRules.aggroRadius);
      if (targetId) {
        gullBusy.add(targetId);
      }
    }
    const player = live.find((entry) => entry.id === targetId);
    if (!player) {
      const { targetId, ...body } = gull;
      void targetId;
      const stepped = stepSeagull(
        { ...body, phase: gull.phase === "perched" || isRescuePhase(gull.phase) ? gull.phase : "return" },
        { dt, player: gull.home, canAttack: false },
      );
      return { ...stepped.gull, targetId: null };
    }
    const carried = racers.find((racer) => racer.id === player.id)?.lift ?? 0;
    const { targetId: locked, ...body } = gull;
    void locked;
    const stepped = stepSeagull(body, { dt, player, canAttack: carried <= 0 });
    let next = { ...stepped.gull, targetId };
    const index = racers.findIndex((racer) => racer.id === player.id);
    const racer = racers[index];
    if (racer && stepped.contact && !isRescuePhase(gull.phase)) {
      if (player.guard && !cleared.includes(player.id)) {
        cleared.push(player.id);
        next = { ...strikeSeagull(next, player), targetId };
      } else {
        const health = Math.max(0, racer.health - racer.maxHealth * seagullRules.damageFraction);
        racers[index] = { ...racer, health };
        next = { ...(health <= 0 ? beginRescue(next) : strikeSeagull(next, player)), targetId };
      }
    }
    if (racer && stepped.rescueDone) {
      racers[index] = { ...racers[index], health: racer.maxHealth, lift: 0 };
    } else if (racer && stepped.pose && next.targetId === player.id && isRescuePhase(next.phase)) {
      racers[index] = { ...racers[index], x: stepped.pose.x, z: stepped.pose.z, lift: stepped.pose.y };
    }
    return next;
  });

  const netBusy = new Set(hazards.nets.filter((net) => net.phase !== "idle" && net.targetId).map((net) => net.targetId as string));
  const nets = hazards.nets.map((thrower) => {
    let targetId = thrower.phase === "idle" ? null : thrower.targetId;
    if (thrower.phase === "idle") {
      targetId = nearestThrow(thrower, live, racers, netBusy);
      if (targetId) {
        netBusy.add(targetId);
      }
    }
    const player = live.find((entry) => entry.id === targetId);
    const racer = racers.find((entry) => entry.id === targetId);
    const grounded = !!player && !!racer && racer.lift <= 0 && racer.bubble <= 0;
    const motion = player
      ? { x: player.x, z: player.z, heading: player.heading, speed: player.speed, steer: 0 }
      : { x: 0, z: -500, heading: 0, speed: 0, steer: 0 };
    const stepped = stepNetHazards(
      { throwers: [thrower], slow: { player: 0, rival: 0 }, grace: { player: 0, rival: 0 } },
      { dt, racing: true, player: motion, rival: { x: 999, z: 999, heading: 0, speed: 0, steer: 0 }, playerGrounded: grounded && !!targetId },
    );
    const next = stepped.state.throwers[0] ?? thrower;
    if (targetId && racer && stepped.hits.includes("player") && racer.netSlow <= 0 && racer.netGrace <= 0 && racer.lift <= 0) {
      if (player?.guard && !cleared.includes(targetId)) {
        cleared.push(targetId);
      } else {
        const slot = racers.findIndex((entry) => entry.id === targetId);
        if (slot >= 0) {
          racers[slot] = { ...racers[slot], netSlow: netRules.slowSeconds, netGrace: netRules.slowSeconds + netRules.graceSeconds };
        }
      }
    }
    return { ...next, targetId: next.phase === "idle" ? null : targetId };
  });

  const bubbles: TrackedBubble[] = [];
  for (const bubble of hazards.bubbles) {
    const moved = stepBubbleShots([bubble], dt)[0];
    if (!moved) {
      continue;
    }
    const flown: TrackedBubble = { ...moved, id: bubble.id, ownerId: bubble.ownerId };
    const targets = [
      ...live
        .filter((player) => player.id !== flown.ownerId)
        .filter((player) => {
          const racer = racers.find((entry) => entry.id === player.id);
          return racer !== undefined && racer.bubble <= 0 && racer.lift <= 0;
        })
        .map((player) => ({ id: player.id, x: player.x, z: player.z, y: 0.45 })),
      ...seagulls.filter((gull) => gull.bubble <= 0 && !isRescuePhase(gull.phase)).map((gull) => ({ id: gull.id, x: gull.x, z: gull.z, y: gull.y })),
    ];
    const caught = consumeBubbleHits([flown], targets);
    if (caught.hits.length === 0) {
      const still = caught.shots[0];
      if (still) {
        bubbles.push({ ...still, id: flown.id, ownerId: flown.ownerId });
      }
      continue;
    }
    const id = caught.hits[0];
    if (!id) {
      continue;
    }
    const player = live.find((entry) => entry.id === id);
    if (player?.guard && !cleared.includes(id)) {
      cleared.push(id);
      continue;
    }
    const slot = racers.findIndex((entry) => entry.id === id);
    if (slot >= 0) {
      racers[slot] = { ...racers[slot], bubble: bubbleRules.trapSeconds };
      continue;
    }
    const gullIndex = seagulls.findIndex((gull) => gull.id === id);
    if (gullIndex >= 0) {
      const trapped = trapSeagull(seagulls[gullIndex], bubbleRules.trapSeconds);
      seagulls[gullIndex] = { ...trapped, targetId: seagulls[gullIndex].targetId };
    }
  }
  return { hazards: { ...hazards, seagulls, nets, bubbles, racers }, poses: [], cleared };
}

function nearestId(gull: Seagull, players: readonly BeachPlayer[], busy: ReadonlySet<string>, radius: number): string | null {
  let best: BeachPlayer | null = null;
  let bestDist = radius;
  for (const player of players) {
    if (busy.has(player.id)) {
      continue;
    }
    const dist = Math.hypot(player.x - gull.x, player.z - gull.z);
    if (dist <= bestDist) {
      best = player;
      bestDist = dist;
    }
  }
  return best?.id ?? null;
}

function nearestThrow(thrower: NetThrower, players: readonly BeachPlayer[], racers: readonly BeachRacer[], busy: ReadonlySet<string>): string | null {
  let best: BeachPlayer | null = null;
  let bestDist: number = netRules.range;
  for (const player of players) {
    if (busy.has(player.id)) {
      continue;
    }
    const racer = racers.find((entry) => entry.id === player.id);
    if (!racer || racer.lift > 0 || racer.netSlow > 0) {
      continue;
    }
    if (Math.abs(player.z - thrower.z) > netRules.alongTrackRange) {
      continue;
    }
    const dist = Math.hypot(player.x - thrower.x, player.z - thrower.z);
    if (dist <= bestDist) {
      best = player;
      bestDist = dist;
    }
  }
  return best?.id ?? null;
}

function syncRacers(hazards: BeachHazards, players: readonly BeachPlayer[]): BeachHazards {
  const live = new Set(players.filter((player) => player.connected).map((player) => player.id));
  const racers = hazards.racers.filter((racer) => live.has(racer.id)).map((racer) => {
    const player = players.find((entry) => entry.id === racer.id);
    if (!player || racer.lift > 0) {
      return racer;
    }
    return { ...racer, x: player.x, z: player.z };
  });
  for (const player of players) {
    if (!player.connected || racers.some((racer) => racer.id === player.id)) {
      continue;
    }
    const maxHealth = hazards.bodies[player.id] ?? 50;
    racers.push({
      id: player.id,
      health: maxHealth,
      maxHealth,
      netSlow: 0,
      netGrace: 0,
      bubble: 0,
      lift: 0,
      x: player.x,
      z: player.z,
      gunShots: 0,
      gunUntil: 0,
      gunReadyAt: 0,
    });
  }
  return { ...hazards, racers };
}

function carriedPoses(hazards: BeachHazards): { id: string; x: number; z: number }[] {
  return hazards.racers.filter((racer) => racer.lift > 0).map((racer) => ({ id: racer.id, x: racer.x, z: racer.z }));
}

function readSeagull(value: unknown): WorldSeagull | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const gull = value as Record<string, unknown>;
  if (typeof gull.id !== "string" || gull.id.length > 32 || !gullPhases.includes(gull.phase as SeagullPhase)) {
    return null;
  }
  if (!unit(gull.x) || !unit(gull.y) || !unit(gull.z) || !unit(gull.heading) || !unit(gull.bubble) || !unit(gull.diveX) || !unit(gull.diveZ)) {
    return null;
  }
  return {
    id: gull.id,
    x: gull.x as number,
    y: gull.y as number,
    z: gull.z as number,
    heading: gull.heading as number,
    phase: gull.phase as SeagullPhase,
    bubble: gull.bubble as number,
    flier: gull.flier === true,
    diveX: gull.diveX as number,
    diveZ: gull.diveZ as number,
  };
}

function readNet(value: unknown): WorldNet | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const net = value as Record<string, unknown>;
  if (typeof net.id !== "string" || net.id.length > 32 || !netPhases.includes(net.phase as NetPhase)) {
    return null;
  }
  if (!unit(net.time) || !unit(net.x) || !unit(net.z) || !unit(net.targetX) || !unit(net.targetZ)) {
    return null;
  }
  return {
    id: net.id,
    phase: net.phase as NetPhase,
    time: net.time as number,
    x: net.x as number,
    z: net.z as number,
    targetX: net.targetX as number,
    targetZ: net.targetZ as number,
  };
}

function readBubble(value: unknown): WorldBubble | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const bubble = value as Record<string, unknown>;
  if (!unit(bubble.x) || !unit(bubble.y) || !unit(bubble.z)) {
    return null;
  }
  return { x: bubble.x as number, y: bubble.y as number, z: bubble.z as number };
}

function readRacer(value: unknown): WorldRacer | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const racer = value as Record<string, unknown>;
  if (typeof racer.id !== "string" || racer.id.length === 0 || racer.id.length > 80) {
    return null;
  }
  if (!unit(racer.health) || !unit(racer.maxHealth) || !unit(racer.netSlow) || !unit(racer.bubble) || !unit(racer.lift) || !unit(racer.x) || !unit(racer.z) || !unit(racer.gunShots) || !unit(racer.gunSeconds)) {
    return null;
  }
  return {
    id: racer.id,
    health: racer.health as number,
    maxHealth: racer.maxHealth as number,
    netSlow: racer.netSlow as number,
    bubble: racer.bubble as number,
    lift: racer.lift as number,
    x: racer.x as number,
    z: racer.z as number,
    gunShots: racer.gunShots as number,
    gunSeconds: racer.gunSeconds as number,
  };
}

function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 10_000;
}
