/**
 * Messages shared by the browser and the race room.
 * The browser sends intents. The room decides the countdown, the orbs, the abilities and the finishing order.
 */
import { abilityCatalog, type AbilityId } from "../src/abilities/catalog";

export const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RoomPhase = "lobby" | "countdown" | "racing" | "finished" | "closed";

export interface Ticket {
  roomCode: string;
  playerId: string;
  token: string;
  name: string;
  slot: number;
  x: number;
  z: number;
  heading: number;
}

/** What every other hatchling is allowed to know. The secret token stays out. */
export interface PublicPlayer {
  id: string;
  name: string;
  slot: number;
  connected: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  ready: boolean;
  /** 0 until the server assigns a finishing place. */
  place: number;
  /** Milliseconds from the shared start. 0 until that finish is accepted. */
  ms: number;
}

export interface ClientPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface PublicOrb {
  id: string;
  /** Server time when this orb can be collected again. 0 means it is on the sand. */
  at: number;
}

export type ClientMessage =
  | { type: "hello"; playerId: string; token: string }
  | ({ type: "pose" } & ClientPose)
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "pickup"; orb: string }
  | { type: "ability"; ability: AbilityId }
  | { type: "finish" }
  | { type: "rematch" }
  | { type: "reset" }
  | { type: "leave" };

export interface WelcomeMessage {
  type: "welcome";
  roomCode: string;
  playerId: string;
  hostId: string;
  slot: number;
  phase: RoomPhase;
  x: number;
  z: number;
  heading: number;
  speed: number;
  players: PublicPlayer[];
}

export interface RosterMessage {
  type: "roster";
  hostId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
}

export interface PoseMessage extends ClientPose {
  type: "pose";
  playerId: string;
}

export interface PoseRejectedMessage extends ClientPose {
  type: "pose-rejected";
  reason: "invalid" | "too-fast";
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

/** One clock for the whole room. `serverNow` lets a browser correct its own clock. */
export interface PhaseMessage {
  type: "phase";
  phase: RoomPhase;
  endsAt: number | null;
  startedAt: number | null;
  serverNow: number;
  /** True when every hatchling should snap back to their starting pad. */
  snap: boolean;
}

export interface OrbsMessage {
  type: "orbs";
  orbs: PublicOrb[];
}

/** One orb changed. The ability is what the server rolled, not what the browser asked for. */
export interface OrbMessage {
  type: "orb";
  id: string;
  at: number;
  playerId: string;
  ability: AbilityId;
}

/** Private to the hatchling it describes. */
export interface LoadoutMessage {
  type: "loadout";
  held: AbilityId | null;
  active: AbilityId | null;
  until: number;
  slowUntil: number;
}

export interface AbilityMessage {
  type: "ability";
  playerId: string;
  ability: AbilityId;
  until: number;
  x: number;
  z: number;
  heading: number;
  slowed: string[];
  blocked: string[];
}

/** The server's place and time. A browser cannot fill these in for itself. */
export interface FinishMessage {
  type: "finish";
  playerId: string;
  place: number;
  ms: number;
}

export interface RejectedActionMessage {
  type: "rejected";
  action: "ready" | "start" | "pickup" | "ability" | "finish" | "rematch";
  reason: string;
}

export type ServerMessage =
  | WelcomeMessage
  | RosterMessage
  | PoseMessage
  | PoseRejectedMessage
  | PhaseMessage
  | OrbsMessage
  | OrbMessage
  | LoadoutMessage
  | AbilityMessage
  | FinishMessage
  | RejectedActionMessage
  | ErrorMessage;

export function isRoomCode(value: string): boolean {
  return value.length === 4 && [...value].every((character) => roomCodeAlphabet.includes(character));
}

/** Turns four random bytes into a code that is easier to read aloud. */
export function roomCodeFromBytes(bytes: Uint8Array): string {
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += roomCodeAlphabet[(bytes[index] ?? 0) % roomCodeAlphabet.length];
  }
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return isRoomCode(code) ? code : null;
}

/** Keeps display names short and plain so they are safe to show in the page. */
export function displayName(input: unknown): string {
  if (typeof input !== "string") {
    return "Hatchling";
  }
  const cleaned = input.replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/ +/g, " ").slice(0, 16);
  return cleaned.length > 0 ? cleaned : "Hatchling";
}

export function parseClientMessage(raw: string): ClientMessage | null {
  const value = parseObject(raw);
  if (!value) {
    return null;
  }
  if (value.type === "hello" && typeof value.playerId === "string" && typeof value.token === "string") {
    if (!isShortId(value.playerId) || !isShortId(value.token)) {
      return null;
    }
    return { type: "hello", playerId: value.playerId, token: value.token };
  }
  if (value.type === "pose") {
    const pose = readPose(value);
    return pose ? { type: "pose", ...pose } : null;
  }
  if (value.type === "ready" && typeof value.ready === "boolean") {
    return { type: "ready", ready: value.ready };
  }
  if (value.type === "start") {
    return { type: "start" };
  }
  if (value.type === "pickup" && typeof value.orb === "string" && value.orb.length > 0 && value.orb.length <= 32) {
    return { type: "pickup", orb: value.orb };
  }
  if (value.type === "ability" && isAbilityId(value.ability)) {
    return { type: "ability", ability: value.ability };
  }
  if (value.type === "finish") {
    if ("place" in value || "ms" in value || "time" in value) {
      return null;
    }
    return { type: "finish" };
  }
  if (value.type === "rematch") {
    return { type: "rematch" };
  }
  if (value.type === "reset") {
    return { type: "reset" };
  }
  if (value.type === "leave") {
    return { type: "leave" };
  }
  return null;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const value = parseObject(raw);
  if (!value || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "error" && typeof value.message === "string" && value.message.length <= 200) {
    return { type: "error", message: value.message };
  }
  if (value.type === "rejected" && isRaceAction(value.action) && typeof value.reason === "string" && value.reason.length <= 160) {
    return { type: "rejected", action: value.action, reason: value.reason };
  }
  if (value.type === "phase" && isRoomPhase(value.phase) && typeof value.snap === "boolean" && isStamp(value.serverNow)) {
    const endsAt = optionalStamp(value.endsAt);
    const startedAt = optionalStamp(value.startedAt);
    if (endsAt === undefined || startedAt === undefined) {
      return null;
    }
    return { type: "phase", phase: value.phase, endsAt, startedAt, serverNow: value.serverNow, snap: value.snap };
  }
  if (value.type === "orbs") {
    const orbs = readOrbs(value.orbs);
    return orbs ? { type: "orbs", orbs } : null;
  }
  if (value.type === "orb" && typeof value.id === "string" && isStamp(value.at) && isShortId(stringOrEmpty(value.playerId)) && isAbilityId(value.ability)) {
    return { type: "orb", id: value.id, at: value.at, playerId: stringOrEmpty(value.playerId), ability: value.ability };
  }
  if (value.type === "loadout" && isOptionalAbility(value.held) && isOptionalAbility(value.active) && isStamp(value.until) && isStamp(value.slowUntil)) {
    return { type: "loadout", held: value.held, active: value.active, until: value.until, slowUntil: value.slowUntil };
  }
  if (value.type === "ability" && isShortId(stringOrEmpty(value.playerId)) && isAbilityId(value.ability) && isStamp(value.until)) {
    const pose = readAim(value);
    const slowed = readIdList(value.slowed);
    const blocked = readIdList(value.blocked);
    if (!pose || !slowed || !blocked) {
      return null;
    }
    return { type: "ability", playerId: stringOrEmpty(value.playerId), ability: value.ability, until: value.until, ...pose, slowed, blocked };
  }
  if (value.type === "finish" && isShortId(stringOrEmpty(value.playerId)) && isPlace(value.place) && isRaceMs(value.ms)) {
    return { type: "finish", playerId: stringOrEmpty(value.playerId), place: value.place, ms: value.ms };
  }
  if (value.type === "pose-rejected") {
    const pose = readPose(value);
    if (!pose || (value.reason !== "invalid" && value.reason !== "too-fast")) {
      return null;
    }
    return { type: "pose-rejected", reason: value.reason, ...pose };
  }
  if (value.type === "pose") {
    const pose = readPose(value);
    if (!pose || typeof value.playerId !== "string" || !isShortId(value.playerId)) {
      return null;
    }
    return { type: "pose", playerId: value.playerId, ...pose };
  }
  const players = readPlayers(value.players);
  if (!players || typeof value.hostId !== "string" || !isRoomPhase(value.phase)) {
    return null;
  }
  if (value.type === "roster") {
    return { type: "roster", hostId: value.hostId, phase: value.phase, players };
  }
  if (value.type === "welcome") {
    const pose = readPose(value);
    if (
      !pose ||
      typeof value.roomCode !== "string" ||
      !isRoomCode(value.roomCode) ||
      typeof value.playerId !== "string" ||
      !isShortId(value.playerId) ||
      typeof value.slot !== "number"
    ) {
      return null;
    }
    return {
      type: "welcome",
      roomCode: value.roomCode,
      playerId: value.playerId,
      hostId: value.hostId,
      slot: value.slot,
      phase: value.phase,
      x: pose.x,
      z: pose.z,
      heading: pose.heading,
      speed: pose.speed,
      players,
    };
  }
  return null;
}

function parseObject(raw: string): Record<string, unknown> | null {
  if (raw.length > 8_000) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readPose(value: Record<string, unknown>): ClientPose | null {
  if (
    typeof value.x !== "number" ||
    typeof value.z !== "number" ||
    typeof value.heading !== "number" ||
    typeof value.speed !== "number" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.z) ||
    !Number.isFinite(value.heading) ||
    !Number.isFinite(value.speed)
  ) {
    return null;
  }
  return { x: value.x, z: value.z, heading: value.heading, speed: value.speed };
}

function readPlayers(value: unknown): PublicPlayer[] | null {
  if (!Array.isArray(value) || value.length > 8) {
    return null;
  }
  const players: PublicPlayer[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const player = entry as Record<string, unknown>;
    if ("token" in player) {
      return null;
    }
    const pose = readPose(player);
    if (
      !pose ||
      typeof player.id !== "string" ||
      !isShortId(player.id) ||
      typeof player.name !== "string" ||
      player.name.length > 16 ||
      typeof player.slot !== "number" ||
      !Number.isInteger(player.slot) ||
      typeof player.connected !== "boolean" ||
      typeof player.ready !== "boolean" ||
      !isPlace(player.place) ||
      !isRaceMs(player.ms)
    ) {
      return null;
    }
    players.push({
      id: player.id,
      name: player.name,
      slot: player.slot,
      connected: player.connected,
      ready: player.ready,
      place: player.place,
      ms: player.ms,
      ...pose,
    });
  }
  return players;
}

function readOrbs(value: unknown): PublicOrb[] | null {
  if (!Array.isArray(value) || value.length > 8) {
    return null;
  }
  const orbs: PublicOrb[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const orb = entry as Record<string, unknown>;
    if (typeof orb.id !== "string" || orb.id.length === 0 || orb.id.length > 32 || !isStamp(orb.at)) {
      return null;
    }
    orbs.push({ id: orb.id, at: orb.at });
  }
  return orbs;
}

function readAim(value: Record<string, unknown>): { x: number; z: number; heading: number } | null {
  if (!isCoord(value.x) || !isCoord(value.z) || !isCoord(value.heading)) {
    return null;
  }
  return { x: value.x, z: value.z, heading: value.heading };
}

function readIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 8) {
    return null;
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isShortId(entry)) {
      return null;
    }
    ids.push(entry);
  }
  return ids;
}

function isAbilityId(value: unknown): value is AbilityId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(abilityCatalog, value);
}

function isOptionalAbility(value: unknown): value is AbilityId | null {
  return value === null || isAbilityId(value);
}

function isRaceAction(value: unknown): value is RejectedActionMessage["action"] {
  return value === "ready" || value === "start" || value === "pickup" || value === "ability" || value === "finish" || value === "rematch";
}

function optionalStamp(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return isStamp(value) ? value : undefined;
}

function isStamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10_000_000_000_000;
}

function isCoord(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1_000;
}

function isPlace(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 8;
}

function isRaceMs(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 600_000;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRoomPhase(value: unknown): value is RoomPhase {
  return value === "lobby" || value === "countdown" || value === "racing" || value === "finished" || value === "closed";
}

function isShortId(value: string): boolean {
  return value.length > 0 && value.length <= 80;
}
