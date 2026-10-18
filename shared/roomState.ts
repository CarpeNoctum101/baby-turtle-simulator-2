import type { AbilityId } from "../src/abilities/catalog";
import type { BeachHazards } from "./beachHazards";
import { tideOrbSpots } from "../src/abilities/pickups";
import { clampToBeach, clampToCourse, course } from "../src/movement/course";
import type { PublicPlayer, RoomPhase, Ticket } from "./protocol";

/** One race room holds at most eight hatchlings. */
export const maxPlayers = 8;

/** An empty room is deleted after two minutes so abandoned lobbies do not linger. */
export const abandonAfterMs = 2 * 60 * 1000;

/** Poses faster than this are ignored. Shallow water plus Flipper Frenzy stays under it. */
export const maxPoseSpeed = 14;

/** Extra meters allowed so a normal frame is not rejected for being a little late. */
export const poseSlackMeters = 0.6;

/** Drops extra poses that arrive faster than about twenty per second. */
export const minPoseIntervalMs = 45;

/** One shared Tide Orb. `at` is the server time it can be collected again. 0 means it is on the sand. */
export interface OrbState {
  id: string;
  at: number;
}

export interface PlayerRecord {
  id: string;
  token: string;
  name: string;
  slot: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  connected: boolean;
  lastPoseAt: number;
  /** Lobby only. A disconnected hatchling is not ready. */
  ready: boolean;
  held: AbilityId | null;
  /** The ability whose timer is still running, if any. */
  active: AbilityId | null;
  activeUntil: number;
  slowUntil: number;
  /** Server clock when this hatchling reached the ocean. Null until the server accepts a finish. */
  finishedAt: number | null;
  /** 0 until the server assigns a place. Clients never choose this. */
  place: number;
  lastActionAt: number;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  createdAt: number;
  emptySince: number | null;
  hostId: string;
  /** When the countdown reaches zero and the crawl may begin. */
  countdownEndsAt: number | null;
  /** Server clock at the instant the countdown ended. Finish times are measured from here. */
  raceStartedAt: number | null;
  orbs: OrbState[];
  players: PlayerRecord[];
  /** Shared nets, seagulls and bubbles. Absent in older rows until the room writes them. */
  hazards?: BeachHazards;
}

export function freshOrbs(): OrbState[] {
  return tideOrbSpots.map((spot) => ({ id: spot.id, at: 0 }));
}

export interface AcceptedPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

/**
 * Eight pads across the nest, facing the ocean.
 * Slot 0 is the host's pad. Later joiners fill the next open pad.
 */
export function slotPose(slot: number): { x: number; z: number; heading: number } {
  if (!Number.isInteger(slot) || slot < 0 || slot >= maxPlayers) {
    throw new Error(`Slot ${slot} is outside the starting grid.`);
  }
  const edge = course.halfWidth - 4;
  const x = -edge + (slot * (edge * 2)) / (maxPlayers - 1);
  return { x, z: course.nest.z, heading: 0 };
}

export function openRoom(input: {
  code: string;
  name: string;
  playerId: string;
  token: string;
  now: number;
}): { state: RoomState; ticket: Ticket } {
  const pose = slotPose(0);
  const player = playerAt(input.playerId, input.token, input.name, 0, pose, input.now);
  const state: RoomState = {
    code: input.code,
    phase: "lobby",
    createdAt: input.now,
    emptySince: input.now,
    hostId: player.id,
    countdownEndsAt: null,
    raceStartedAt: null,
    orbs: freshOrbs(),
    players: [player],
  };
  return { state, ticket: ticketFor(state.code, player) };
}

export function joinRoom(
  state: RoomState | null,
  input: { name: string; playerId: string; token: string; now: number },
): { ok: true; state: RoomState; ticket: Ticket } | { ok: false; status: number; error: string } {
  if (!state || state.players.length === 0) {
    return { ok: false, status: 404, error: "That room code does not exist." };
  }
  if (state.phase === "closed") {
    return { ok: false, status: 404, error: "That room has closed. Create a new one." };
  }
  if (state.phase !== "lobby") {
    return { ok: false, status: 409, error: "That race has already started." };
  }
  const slot = firstFreeSlot(state.players);
  if (slot === null) {
    return { ok: false, status: 409, error: "That room is full. Eight players is the limit." };
  }
  const player = playerAt(input.playerId, input.token, input.name, slot, slotPose(slot), input.now);
  return {
    ok: true,
    state: { ...state, players: [...state.players, player] },
    ticket: ticketFor(state.code, player),
  };
}

export function authenticate(state: RoomState, playerId: string, token: string): PlayerRecord | null {
  if (state.phase === "closed") {
    return null;
  }
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.token !== token) {
    return null;
  }
  return player;
}

export function connectPlayer(state: RoomState, playerId: string, now: number): RoomState | null {
  if (!state.players.some((player) => player.id === playerId)) {
    return null;
  }
  const players = state.players.map((player) =>
    player.id === playerId ? { ...player, connected: true, lastPoseAt: now } : player,
  );
  return withHost({ ...state, players, emptySince: null });
}

export function disconnectPlayer(state: RoomState, playerId: string, now: number): RoomState {
  if (!state.players.some((player) => player.id === playerId)) {
    return state;
  }
  const players = state.players.map((player) =>
    player.id === playerId ? { ...player, connected: false, ready: false } : player,
  );
  const anyone = players.some((player) => player.connected);
  return withHost({ ...state, players, emptySince: anyone ? null : now });
}

/** Leaving frees the pad. Closing the socket without leaving keeps the pad for a reconnect. */
export function removePlayer(state: RoomState, playerId: string, now: number): RoomState {
  const players = state.players.filter((player) => player.id !== playerId);
  if (players.length === 0) {
    return { ...state, players, hostId: "", emptySince: now };
  }
  const anyone = players.some((player) => player.connected);
  return withHost({ ...state, players, emptySince: anyone ? null : now });
}

export function closeIfAbandoned(state: RoomState, now: number): RoomState {
  if (state.phase === "closed" || state.emptySince === null) {
    return state;
  }
  if (now - state.emptySince < abandonAfterMs) {
    return state;
  }
  return {
    ...state,
    phase: "closed",
    players: [],
    hostId: "",
    emptySince: null,
  };
}

/** The client and server share this rule so prediction cannot crawl before Go. */
export function canMoveInRoom(phase: RoomPhase, place: number): boolean {
  return (phase === "lobby" || phase === "racing") && place === 0;
}

export function applyPose(
  state: RoomState,
  playerId: string,
  pose: AcceptedPose,
  now: number,
):
  | { ok: true; state: RoomState; pose: AcceptedPose }
  | { ok: false; reason: "missing" | "rate" | "invalid" | "too-fast" | "phase"; pose: AcceptedPose | null } {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || !player.connected || state.phase === "closed") {
    return { ok: false, reason: "missing", pose: player ? poseOf(player) : null };
  }
  if (!canMoveInRoom(state.phase, player.place)) {
    return { ok: false, reason: "phase", pose: poseOf(player) };
  }
  if (now - player.lastPoseAt < minPoseIntervalMs) {
    return { ok: false, reason: "rate", pose: poseOf(player) };
  }
  const checked = checkPose(player, pose, (now - player.lastPoseAt) / 1000);
  if (!checked.ok) {
    return { ok: false, reason: checked.reason, pose: poseOf(player) };
  }
  const players = state.players.map((entry) =>
    entry.id === playerId ? { ...entry, ...checked.pose, lastPoseAt: now } : entry,
  );
  return { ok: true, state: { ...state, players }, pose: checked.pose };
}

/** Lobby-only snap back to that player's own pad. The speed cap does not apply. */
export function resetPlayer(state: RoomState, playerId: string, now: number): { state: RoomState; pose: AcceptedPose } | null {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || state.phase !== "lobby") {
    return null;
  }
  const home = slotPose(player.slot);
  const pose = { ...home, speed: 0 };
  const players = state.players.map((entry) =>
    entry.id === playerId ? { ...entry, ...pose, lastPoseAt: now } : entry,
  );
  return { state: { ...state, players }, pose };
}

export function publicView(state: RoomState): { hostId: string; phase: RoomPhase; players: PublicPlayer[] } {
  return {
    hostId: state.hostId,
    phase: state.phase,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      slot: player.slot,
      connected: player.connected,
      x: player.x,
      z: player.z,
      heading: player.heading,
      speed: player.speed,
      ready: player.ready,
      place: player.place,
      ms: finishMilliseconds(state, player),
    })),
  };
}

/** Finish time in milliseconds from the shared start. 0 until the server has accepted that finish. */
export function finishMilliseconds(state: RoomState, player: PlayerRecord): number {
  if (player.finishedAt === null || state.raceStartedAt === null) {
    return 0;
  }
  return Math.max(0, player.finishedAt - state.raceStartedAt);
}

export function checkPose(
  previous: { x: number; z: number },
  next: AcceptedPose,
  dtSeconds: number,
): { ok: true; pose: AcceptedPose } | { ok: false; reason: "invalid" | "too-fast" } {
  if (![next.x, next.z, next.heading, next.speed].every(Number.isFinite)) {
    return { ok: false, reason: "invalid" };
  }
  const pose = {
    x: clampToBeach(next.x),
    z: clampToCourse(next.z),
    heading: wrapAngle(next.heading),
    speed: Math.min(maxPoseSpeed, Math.max(0, next.speed)),
  };
  if (Math.hypot(pose.x - next.x, pose.z - next.z) > 0.05) {
    return { ok: false, reason: "invalid" };
  }
  const distance = Math.hypot(pose.x - previous.x, pose.z - previous.z);
  const allowed = maxPoseSpeed * Math.min(Math.max(dtSeconds, 0), 1) + poseSlackMeters;
  if (distance > allowed) {
    return { ok: false, reason: "too-fast" };
  }
  return { ok: true, pose };
}

export function wrapAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

function playerAt(
  id: string,
  token: string,
  name: string,
  slot: number,
  pose: { x: number; z: number; heading: number },
  now: number,
): PlayerRecord {
  return {
    id,
    token,
    name,
    slot,
    x: pose.x,
    z: pose.z,
    heading: pose.heading,
    speed: 0,
    connected: false,
    lastPoseAt: now,
    ready: false,
    held: null,
    active: null,
    activeUntil: 0,
    slowUntil: 0,
    finishedAt: null,
    place: 0,
    lastActionAt: 0,
  };
}

function ticketFor(code: string, player: PlayerRecord): Ticket {
  return {
    roomCode: code,
    playerId: player.id,
    token: player.token,
    name: player.name,
    slot: player.slot,
    x: player.x,
    z: player.z,
    heading: player.heading,
  };
}

function poseOf(player: PlayerRecord): AcceptedPose {
  return { x: player.x, z: player.z, heading: player.heading, speed: player.speed };
}

function firstFreeSlot(players: PlayerRecord[]): number | null {
  const used = new Set(players.map((player) => player.slot));
  for (let slot = 0; slot < maxPlayers; slot += 1) {
    if (!used.has(slot)) {
      return slot;
    }
  }
  return null;
}

function withHost(state: RoomState): RoomState {
  return { ...state, hostId: assignHost(state.players, state.hostId) };
}

function assignHost(players: PlayerRecord[], hostId: string): string {
  if (players.some((player) => player.id === hostId && player.connected)) {
    return hostId;
  }
  const connected = players.filter((player) => player.connected).sort((left, right) => left.slot - right.slot);
  if (connected[0]) {
    return connected[0].id;
  }
  const remaining = players.slice().sort((left, right) => left.slot - right.slot);
  return remaining[0]?.id ?? "";
}
