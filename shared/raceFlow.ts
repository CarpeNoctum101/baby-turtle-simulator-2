import { abilityCatalog, raceAbilityPool, sandRules, type AbilityId } from "../src/abilities/catalog";
import { orbPickupRadius, orbRespawnSeconds, rollAbility, tideOrbSpots } from "../src/abilities/pickups";
import { isInSandSpray } from "../src/abilities/sandSpray";
import { isInFinishZone } from "../src/movement/course";
import { abandonAfterMs, freshOrbs, slotPose, type PlayerRecord, type RoomState } from "./roomState";

/** The whole room sees the same three-second countdown. */
export const countdownMs = 3_000;

/**
 * A connected hatchling who never finishes cannot hold the room open longer than this.
 * Disconnects of the last unfinished racer end the race immediately, without waiting.
 */
export const raceLimitMs = 120_000;

/** Ready, pickup, ability, finish and rematch share this gap so one socket cannot flood the room. */
export const actionGapMs = 120;

/** A little extra reach so a pose that is still on its way is not treated as a miss. */
export const pickupSlackMeters = 0.75;

export type RaceAction = "ready" | "start" | "pickup" | "ability" | "finish" | "rematch";

export type RaceReason =
  | "phase"
  | "host"
  | "ready"
  | "rate"
  | "orb"
  | "range"
  | "held"
  | "empty"
  | "running"
  | "zone"
  | "done"
  | "missing";

export interface RaceFailure {
  ok: false;
  action: RaceAction;
  reason: RaceReason;
}

export interface AbilityActivation {
  ability: AbilityId;
  until: number;
  x: number;
  z: number;
  heading: number;
  /** Racers the sand cloud slowed. */
  slowed: string[];
  /** Racers whose shell stopped the sand cloud. */
  blocked: string[];
}

/**
 * Short sentences a rejected action can show. The client does not get to invent a nicer result.
 */
export function explainRaceRejection(reason: RaceReason): string {
  switch (reason) {
    case "phase":
      return "That action does not fit this part of the race.";
    case "host":
      return "Only the host can do that.";
    case "ready":
      return "Every connected hatchling needs to be ready.";
    case "rate":
      return "Slow down.";
    case "orb":
      return "That Tide Orb is not there.";
    case "range":
      return "That Tide Orb is too far away.";
    case "held":
      return "You already hold a Tide Orb.";
    case "empty":
      return "You do not hold that ability.";
    case "running":
      return "That ability is already running.";
    case "zone":
      return "You have not reached the ocean.";
    case "done":
      return "You already finished.";
    case "missing":
      return "You are not in this race.";
  }
}

/**
 * Moves the clock forward. Call this before every action so a sleeping room
 * still leaves the countdown, and so a race that has run out of time can end.
 * Returns the same state object when nothing is due.
 */
export function advanceRace(state: RoomState, now: number): { state: RoomState; changed: boolean } {
  let next = state;
  if (next.phase === "countdown" && next.countdownEndsAt !== null && now >= next.countdownEndsAt) {
    next = {
      ...next,
      phase: "racing",
      raceStartedAt: next.countdownEndsAt,
      countdownEndsAt: null,
    };
  }
  if (next.phase === "racing" && next.raceStartedAt !== null && now >= next.raceStartedAt + raceLimitMs) {
    next = { ...next, phase: "finished" };
  }
  if (next.phase === "racing" && connectedRacers(next).length > 0 && connectedRacers(next).every((player) => player.place > 0)) {
    next = { ...next, phase: "finished" };
  }
  return { state: next, changed: next !== state };
}

/**
 * The next time the room needs to wake, even if every browser is quiet.
 * Null means there is nothing to wait for, so the room may sleep.
 */
export function nextWake(state: RoomState): number | null {
  if (state.phase === "closed") {
    return null;
  }
  const times: number[] = [];
  if (state.emptySince !== null) {
    times.push(state.emptySince + abandonAfterMs);
  }
  if (state.phase === "countdown" && state.countdownEndsAt !== null) {
    times.push(state.countdownEndsAt);
  }
  if (state.phase === "racing" && state.raceStartedAt !== null) {
    times.push(state.raceStartedAt + raceLimitMs);
  }
  if (times.length === 0) {
    return null;
  }
  return Math.min(...times);
}

export function setReady(
  state: RoomState,
  playerId: string,
  ready: boolean,
  now: number,
): { ok: true; state: RoomState } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("ready", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("ready", "rate");
  }
  if (state.phase !== "lobby") {
    return failure("ready", "phase");
  }
  return {
    ok: true,
    state: updatePlayer(state, playerId, { ready, lastActionAt: now }),
  };
}

/**
 * The host starts one shared countdown. Everyone is put back on their own pad.
 * A guest, a half-ready lobby, or a race that already started is rejected.
 */
export function requestStart(state: RoomState, playerId: string, now: number): { ok: true; state: RoomState } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("start", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("start", "rate");
  }
  if (state.phase !== "lobby") {
    return failure("start", "phase");
  }
  if (playerId !== state.hostId) {
    return failure("start", "host");
  }
  const connected = state.players.filter((entry) => entry.connected);
  if (connected.length === 0 || connected.some((entry) => !entry.ready)) {
    return failure("start", "ready");
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: "countdown",
      countdownEndsAt: now + countdownMs,
      raceStartedAt: null,
      orbs: freshOrbs(),
      players: state.players.map((entry) => {
        const home = slotPose(entry.slot);
        return {
          ...entry,
          ...home,
          speed: 0,
          held: null,
          active: null,
          activeUntil: 0,
          slowUntil: 0,
          finishedAt: null,
          place: 0,
          lastPoseAt: now,
          lastActionAt: entry.id === playerId ? now : entry.lastActionAt,
        };
      }),
    },
  };
}

/**
 * Claims one shared Tide Orb. The server uses the last accepted pose, not a position in the message.
 */
export function claimPickup(
  state: RoomState,
  playerId: string,
  orbId: string,
  now: number,
  random: () => number,
): { ok: true; state: RoomState; ability: AbilityId } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("pickup", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("pickup", "rate");
  }
  if (state.phase !== "racing" || player.place > 0) {
    return failure("pickup", "phase");
  }
  if (player.held !== null) {
    return failure("pickup", "held");
  }
  const spot = tideOrbSpots.find((entry) => entry.id === orbId);
  const orb = state.orbs.find((entry) => entry.id === orbId);
  if (!spot || !orb) {
    return failure("pickup", "orb");
  }
  if (orb.at > now) {
    return failure("pickup", "orb");
  }
  const reach = orbPickupRadius + pickupSlackMeters;
  if (Math.hypot(spot.x - player.x, spot.z - player.z) > reach) {
    return failure("pickup", "range");
  }
  const ability = rollAbility(random, raceAbilityPool);
  return {
    ok: true,
    ability,
    state: {
      ...updatePlayer(state, playerId, { held: ability, lastActionAt: now }),
      orbs: state.orbs.map((entry) => (entry.id === orbId ? { ...entry, at: now + orbRespawnSeconds * 1000 } : entry)),
    },
  };
}

/**
 * Spends the ability the server stored for this hatchling.
 * A second press is rejected because the item is already gone, or because its timer is still running.
 */
export function activateAbility(
  state: RoomState,
  playerId: string,
  ability: AbilityId,
  now: number,
): { ok: true; state: RoomState; activation: AbilityActivation } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("ability", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("ability", "rate");
  }
  if (state.phase !== "racing" || player.place > 0) {
    return failure("ability", "phase");
  }
  if (player.activeUntil > now) {
    return failure("ability", "running");
  }
  if (player.held !== ability) {
    return failure("ability", "empty");
  }
  const until = now + abilityCatalog[ability].duration * 1000;
  let next = updatePlayer(state, playerId, {
    held: null,
    active: ability,
    activeUntil: until,
    lastActionAt: now,
  });
  const slowed: string[] = [];
  const blocked: string[] = [];
  if (ability === "sand-spray") {
    next = applySand(next, player, now, slowed, blocked);
  }
  return {
    ok: true,
    state: next,
    activation: {
      ability,
      until,
      x: player.x,
      z: player.z,
      heading: player.heading,
      slowed,
      blocked,
    },
  };
}

/**
 * Records a finish from the last accepted pose.
 * The place is the next free number. Nothing in the request can choose it.
 */
export function claimFinish(
  state: RoomState,
  playerId: string,
  now: number,
): { ok: true; state: RoomState; place: number; ms: number } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("finish", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("finish", "rate");
  }
  if (state.phase !== "racing" || state.raceStartedAt === null) {
    return failure("finish", "phase");
  }
  if (player.place > 0) {
    return failure("finish", "done");
  }
  if (!isInFinishZone(player.x, player.z)) {
    return failure("finish", "zone");
  }
  const place = state.players.reduce((highest, entry) => Math.max(highest, entry.place), 0) + 1;
  const finishedAt = now;
  const withPlace = updatePlayer(state, playerId, { place, finishedAt, speed: 0, lastActionAt: now });
  const advanced = advanceRace(withPlace, now).state;
  return {
    ok: true,
    state: advanced,
    place,
    ms: Math.max(0, finishedAt - state.raceStartedAt),
  };
}

/** Host only, and only after the race has a result. Pads, orbs and places all reset. */
export function requestRematch(state: RoomState, playerId: string, now: number): { ok: true; state: RoomState } | RaceFailure {
  const player = findPlayer(state, playerId);
  if (!player || !player.connected) {
    return failure("rematch", "missing");
  }
  if (tooSoon(player, now)) {
    return failure("rematch", "rate");
  }
  if (playerId !== state.hostId) {
    return failure("rematch", "host");
  }
  if (state.phase !== "finished") {
    return failure("rematch", "phase");
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: "lobby",
      countdownEndsAt: null,
      raceStartedAt: null,
      orbs: freshOrbs(),
      players: state.players.map((entry) => {
        const home = slotPose(entry.slot);
        return {
          ...entry,
          ...home,
          speed: 0,
          ready: false,
          held: null,
          active: null,
          activeUntil: 0,
          slowUntil: 0,
          finishedAt: null,
          place: 0,
          lastPoseAt: now,
          lastActionAt: entry.id === playerId ? now : entry.lastActionAt,
        };
      }),
    },
  };
}

/** Finishers first. A place of 0 is did-not-finish and always sorts last. */
export function compareResults(left: { place: number; name: string }, right: { place: number; name: string }): number {
  if (left.place === right.place) {
    return left.name.localeCompare(right.name);
  }
  if (left.place === 0) {
    return 1;
  }
  if (right.place === 0) {
    return -1;
  }
  return left.place - right.place;
}

/** Seconds left on a server clock, adjusted by the offset measured when the message arrived. */
export function syncedRemaining(deadline: number, offsetMs: number, localNow: number): number {
  return (deadline - (localNow + offsetMs)) / 1000;
}

function applySand(
  state: RoomState,
  caster: PlayerRecord,
  now: number,
  slowed: string[],
  blocked: string[],
): RoomState {
  let next = state;
  for (const target of state.players) {
    if (target.id === caster.id || target.place > 0) {
      continue;
    }
    if (!isInSandSpray(caster, target)) {
      continue;
    }
    if (target.active === "shell-guard" && target.activeUntil > now) {
      blocked.push(target.id);
      next = updatePlayer(next, target.id, { active: null, activeUntil: 0 });
      continue;
    }
    slowed.push(target.id);
    next = updatePlayer(next, target.id, { slowUntil: now + sandRules.slowDuration * 1000 });
  }
  return next;
}

function connectedRacers(state: RoomState): PlayerRecord[] {
  return state.players.filter((player) => player.connected);
}

function findPlayer(state: RoomState, playerId: string): PlayerRecord | undefined {
  return state.players.find((player) => player.id === playerId);
}

function tooSoon(player: PlayerRecord, now: number): boolean {
  return player.lastActionAt > 0 && now - player.lastActionAt < actionGapMs;
}

function updatePlayer(state: RoomState, playerId: string, patch: Partial<PlayerRecord>): RoomState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, ...patch } : player)),
  };
}

function failure(action: RaceAction, reason: RaceReason): RaceFailure {
  return { ok: false, action, reason };
}
