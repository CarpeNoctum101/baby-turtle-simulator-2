import { DurableObject } from "cloudflare:workers";
import { abilityCatalog, type AbilityId } from "../src/abilities/catalog";
import {
  armBubbleGun,
  createBeachHazards,
  fireBubble,
  rememberBody,
  stepBeach,
  struggleBeach,
  worldView,
  type BeachHazards,
  type BeachPlayer,
} from "../shared/beachHazards";
import {
  activateAbility,
  advanceRace,
  claimFinish,
  claimPickup,
  explainRaceRejection,
  nextWake,
  requestRematch,
  requestStart,
  setReady,
  type RaceFailure,
} from "../shared/raceFlow";
import {
  parseClientMessage,
  type PhaseMessage,
  type PoseRejectedMessage,
  type ServerMessage,
  type Ticket,
} from "../shared/protocol";
import {
  applyPose,
  authenticate,
  closeIfAbandoned,
  connectPlayer,
  disconnectPlayer,
  freshOrbs,
  joinRoom as addToRoom,
  openRoom,
  publicView,
  removePlayer,
  resetPlayer,
  type OrbState,
  type PlayerRecord,
  type RoomState,
} from "../shared/roomState";
import type { Env } from "./env";

interface SocketAttachment {
  playerId: string;
}

/** A broadcast, or a private note for one hatchling. Loadouts stay private. */
interface Notice {
  message: ServerMessage;
  to?: string;
}

/**
 * One SQLite-backed Durable Object is one race room.
 * Membership, the countdown and the latest accepted crawl live in its private database.
 * WebSocket hibernation lets the object sleep; an alarm wakes it for the countdown and the race limit.
 */
export class RaceRoom extends DurableObject<Env> {
  #tail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.#migrate();
    });
  }

  async createRoom(name: string, code: string): Promise<{ ok: true; ticket: Ticket } | { ok: false }> {
    return this.#exclusive(async () => {
      const current = this.#read();
      if (current && current.phase !== "closed" && current.players.length > 0) {
        return { ok: false };
      }
      const opened = openRoom({
        code,
        name,
        playerId: crypto.randomUUID(),
        token: randomToken(),
        now: Date.now(),
      });
      await this.#persist(opened.state);
      return { ok: true, ticket: opened.ticket };
    });
  }

  async joinRoom(name: string): Promise<{ ok: true; ticket: Ticket } | { ok: false; status: number; error: string }> {
    return this.#exclusive(async () => {
      const result = addToRoom(this.#read(), {
        name,
        playerId: crypto.randomUUID(),
        token: randomToken(),
        now: Date.now(),
      });
      if (!result.ok) {
        return result;
      }
      await this.#persist(result.state);
      return { ok: true, ticket: result.ticket };
    });
  }

  async inspect(): Promise<ReturnType<typeof publicView> | null> {
    const state = this.#read();
    if (!state || state.phase === "closed" || state.players.length === 0) {
      return null;
    }
    return publicView(state);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    const message = parseClientMessage(text);
    const attachment = readAttachment(ws);
    if (!message) {
      this.#send(ws, { type: "error", message: "That message could not be read." });
      if (!attachment) {
        ws.close(1003, "bad message");
      }
      return;
    }

    if (!attachment) {
      if (message.type !== "hello") {
        this.#send(ws, { type: "error", message: "Say hello before sending a crawl." });
        ws.close(1008, "hello required");
        return;
      }
      await this.#hello(ws, message.playerId, message.token);
      return;
    }

    if (message.type === "hello") {
      return;
    }
    if (message.type === "pose") {
      await this.#pose(ws, attachment.playerId, message);
      return;
    }
    if (message.type === "ready") {
      await this.#ready(ws, attachment.playerId, message.ready);
      return;
    }
    if (message.type === "start") {
      await this.#start(ws, attachment.playerId);
      return;
    }
    if (message.type === "pickup") {
      await this.#pickup(ws, attachment.playerId, message.orb);
      return;
    }
    if (message.type === "ability") {
      await this.#ability(ws, attachment.playerId, message.ability);
      return;
    }
    if (message.type === "finish") {
      await this.#finish(ws, attachment.playerId);
      return;
    }
    if (message.type === "rematch") {
      await this.#rematch(ws, attachment.playerId);
      return;
    }
    if (message.type === "reset") {
      await this.#reset(attachment.playerId);
      return;
    }
    if (message.type === "shot") {
      await this.#shot(attachment.playerId, message);
      return;
    }
    if (message.type === "struggle") {
      await this.#struggle(attachment.playerId);
      return;
    }
    if (message.type === "body") {
      await this.#body(attachment.playerId, message.maxHealth);
      return;
    }
    if (message.type === "leave") {
      await this.#leave(ws, attachment.playerId);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = readAttachment(ws);
    if (!attachment) {
      return;
    }
    const replaced = this.ctx.getWebSockets().some((socket) => {
      if (socket === ws) {
        return false;
      }
      return readAttachment(socket)?.playerId === attachment.playerId;
    });
    if (replaced) {
      return;
    }
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state || !state.players.some((player) => player.id === attachment.playerId)) {
        return;
      }
      const now = Date.now();
      const settled = advanceRace(disconnectPlayer(state, attachment.playerId, now), now).state;
      await this.#commit(state, settled, now, true);
    });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, "socket error");
  }

  async alarm(): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state) {
        return;
      }
      const now = Date.now();
      const closed = closeIfAbandoned(state, now);
      if (closed.phase === "closed" && state.phase !== "closed") {
        await this.#persist(closed);
        for (const socket of this.ctx.getWebSockets()) {
          this.#send(socket, { type: "error", message: "This room was closed because everyone left." });
          socket.close(1000, "room closed");
        }
        return;
      }
      let advanced = advanceRace(state, now).state;
      if (state.phase !== "racing" && advanced.phase === "racing") {
        advanced = { ...advanced, hazards: createBeachHazards(now) };
      }
      const beach = rollBeach(advanced, now);
      if (!beach.stepped && advanced === state) {
        await this.#schedule(state);
        return;
      }
      await this.#commit(state, beach.state, now, true);
    });
  }

  async #hello(ws: WebSocket, playerId: string, token: string): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      const now = Date.now();
      const current = state ? advanceRace(state, now).state : null;
      const player = current ? authenticate(current, playerId, token) : null;
      if (!current || !player) {
        this.#send(ws, { type: "error", message: "This hatchling is not in that room." });
        ws.close(1008, "unauthorized");
        return;
      }
      const connected = connectPlayer(current, playerId, now);
      if (!connected) {
        this.#send(ws, { type: "error", message: "This hatchling is not in that room." });
        ws.close(1008, "unauthorized");
        return;
      }
      await this.#persist(connected);
      ws.serializeAttachment({ playerId } satisfies SocketAttachment);
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && readAttachment(other)?.playerId === playerId) {
          other.close(4000, "replaced");
        }
      }
      const view = publicView(connected);
      const self = view.players.find((entry) => entry.id === playerId);
      const racer = connected.players.find((entry) => entry.id === playerId);
      this.#send(ws, {
        type: "welcome",
        roomCode: connected.code,
        playerId,
        hostId: view.hostId,
        slot: self?.slot ?? player.slot,
        phase: view.phase,
        x: self?.x ?? player.x,
        z: self?.z ?? player.z,
        heading: self?.heading ?? player.heading,
        speed: self?.speed ?? player.speed,
        players: view.players,
      });
      this.#send(ws, phaseMessage(connected, now, false));
      this.#send(ws, { type: "orbs", orbs: connected.orbs });
      if (racer) {
        this.#send(ws, loadoutMessage(racer));
      }
      this.#broadcast(rosterMessage(connected), ws);
      this.#broadcast(worldMessage(connected, now));
      if (state && connected.phase !== state.phase) {
        this.#broadcast(phaseMessage(connected, now, false), ws);
      }
    });
  }

  async #pose(
    ws: WebSocket,
    playerId: string,
    pose: { x: number; z: number; heading: number; speed: number },
  ): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state) {
        return;
      }
      const now = Date.now();
      let advanced = advanceRace(state, now).state;
      if (state.phase !== "racing" && advanced.phase === "racing") {
        advanced = { ...advanced, hazards: createBeachHazards(now) };
      }
      const carried = beachOf(advanced, now).racers.some((racer) => racer.id === playerId && racer.lift > 0);
      const result = carried
        ? { ok: true as const, state: advanced, pose: poseOfPlayer(advanced, playerId) }
        : applyPose(advanced, playerId, pose, now);
      if (!result.ok) {
        if (advanced !== state) {
          await this.#commit(state, advanced, now, true);
        }
        if ((result.reason === "invalid" || result.reason === "too-fast") && result.pose) {
          const rejected: PoseRejectedMessage = { type: "pose-rejected", reason: result.reason, ...result.pose };
          this.#send(ws, rejected);
        }
        return;
      }
      const beach = rollBeach(result.state, now);
      await this.#persist(beach.state);
      if (advanced.phase !== state.phase || advanced.raceStartedAt !== state.raceStartedAt) {
        this.#broadcast(phaseMessage(beach.state, now, false));
        this.#broadcast(rosterMessage(beach.state));
      }
      const shown = poseOfPlayer(beach.state, playerId) ?? result.pose ?? pose;
      this.#broadcast({ type: "pose", playerId, ...shown }, ws);
      if (beach.stepped) {
        this.#broadcast(worldMessage(beach.state, now));
      }
    });
  }

  async #ready(ws: WebSocket, playerId: string, ready: boolean): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = setReady(state, playerId, ready, now);
      return result.ok ? { state: result.state, roster: true } : { state, failure: result };
    });
  }

  async #start(ws: WebSocket, playerId: string): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = requestStart(state, playerId, now);
      if (!result.ok) {
        return { state, failure: result };
      }
      return {
        state: result.state,
        roster: true,
        extra: [
          { message: { type: "orbs", orbs: result.state.orbs } },
          ...result.state.players.map((player) => ({ message: loadoutMessage(player), to: player.id })),
        ],
      };
    });
  }

  async #pickup(ws: WebSocket, playerId: string, orbId: string): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = claimPickup(state, playerId, orbId, now, randomUnit);
      if (!result.ok) {
        return { state, failure: result };
      }
      const orb = result.state.orbs.find((entry) => entry.id === orbId);
      const player = result.state.players.find((entry) => entry.id === playerId);
      const extra: Notice[] = [
        { message: { type: "orb", id: orbId, at: orb?.at ?? now, playerId, ability: result.ability } },
      ];
      if (player) {
        extra.push({ message: loadoutMessage(player), to: player.id });
      }
      return { state: result.state, extra };
    });
  }

  async #ability(ws: WebSocket, playerId: string, ability: AbilityId): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = activateAbility(state, playerId, ability, now);
      if (!result.ok) {
        return { state, failure: result };
      }
      let next = result.state;
      if (ability === "bubble-shot") {
        const synced = stepBeach(beachOf(next, now), beachPlayers(next, now), now).hazards;
        next = { ...next, hazards: armBubbleGun(synced, playerId, result.activation.until, now) };
      }
      const extra: Notice[] = [{ message: { type: "ability", playerId, ...result.activation } }];
      const touched = new Set([playerId, ...result.activation.slowed, ...result.activation.blocked]);
      for (const id of touched) {
        const player = result.state.players.find((entry) => entry.id === id);
        if (player) {
          extra.push({ message: loadoutMessage(player), to: player.id });
        }
      }
      return { state: next, extra };
    });
  }

  async #shot(
    playerId: string,
    shot: { x: number; y: number; z: number; dirX: number; dirY: number; dirZ: number },
  ): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state || state.phase !== "racing") {
        return;
      }
      const now = Date.now();
      const fired = fireBubble(
        beachOf(state, now),
        playerId,
        { x: shot.x, y: shot.y, z: shot.z },
        { x: shot.dirX, y: shot.dirY, z: shot.dirZ },
        now,
      );
      if (!fired.ok) {
        return;
      }
      await this.#commit(state, { ...state, hazards: fired.hazards }, now, false);
    });
  }

  async #struggle(playerId: string): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state || state.phase !== "racing") {
        return;
      }
      const now = Date.now();
      await this.#commit(state, { ...state, hazards: struggleBeach(beachOf(state, now), playerId) }, now, false);
    });
  }

  async #body(playerId: string, maxHealth: number): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state) {
        return;
      }
      const now = Date.now();
      await this.#commit(state, { ...state, hazards: rememberBody(beachOf(state, now), playerId, maxHealth) }, now, false);
    });
  }

  async #finish(ws: WebSocket, playerId: string): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = claimFinish(state, playerId, now);
      if (!result.ok) {
        return { state, failure: result };
      }
      return {
        state: result.state,
        roster: true,
        extra: [{ message: { type: "finish", playerId, place: result.place, ms: result.ms } }],
      };
    });
  }

  async #rematch(ws: WebSocket, playerId: string): Promise<void> {
    await this.#act(ws, (state, now) => {
      const result = requestRematch(state, playerId, now);
      if (!result.ok) {
        return { state, failure: result };
      }
      return {
        state: { ...result.state, hazards: createBeachHazards(now) },
        roster: true,
        extra: [
          { message: { type: "orbs", orbs: result.state.orbs } },
          ...result.state.players.map((player) => ({ message: loadoutMessage(player), to: player.id })),
        ],
      };
    });
  }

  async #reset(playerId: string): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state) {
        return;
      }
      const now = Date.now();
      const advanced = advanceRace(state, now).state;
      const reset = resetPlayer(advanced, playerId, now);
      if (!reset) {
        if (advanced !== state) {
          await this.#commit(state, advanced, now, true);
        }
        return;
      }
      await this.#persist(reset.state);
      this.#broadcast({ type: "pose", playerId, ...reset.pose });
    });
  }

  async #leave(ws: WebSocket, playerId: string): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (state) {
        const now = Date.now();
        const settled = advanceRace(removePlayer(state, playerId, now), now).state;
        await this.#commit(state, settled, now, true);
      }
      ws.close(1000, "left");
    });
  }

  async #act(
    ws: WebSocket,
    run: (state: RoomState, now: number) => { state: RoomState; roster?: boolean; extra?: Notice[]; failure?: RaceFailure },
  ): Promise<void> {
    await this.#exclusive(async () => {
      const state = this.#read();
      if (!state) {
        return;
      }
      const now = Date.now();
      const advanced = advanceRace(state, now).state;
      const result = run(advanced, now);
      if (result.failure) {
        if (advanced !== state) {
          await this.#commit(state, advanced, now, true);
        }
        if (result.failure.reason !== "rate") {
          this.#send(ws, {
            type: "rejected",
            action: result.failure.action,
            reason: explainRaceRejection(result.failure.reason),
          });
        }
        return;
      }
      await this.#commit(state, result.state, now, result.roster === true);
      for (const notice of result.extra ?? []) {
        if (!notice.to) {
          this.#broadcast(notice.message);
          continue;
        }
        for (const socket of this.ctx.getWebSockets()) {
          if (readAttachment(socket)?.playerId === notice.to) {
            this.#send(socket, notice.message);
          }
        }
      }
    });
  }

  /**
   * One mutation at a time. The object can hibernate between messages;
   * this only orders messages that arrive while it is awake.
   */
  #exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.#tail.then(work, work);
    this.#tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async #commit(previous: RoomState, next: RoomState, now: number, roster: boolean): Promise<void> {
    if (next === previous) {
      return;
    }
    await this.#persist(next);
    if (next.hazards && next.hazards !== previous.hazards) {
      this.#broadcast(worldMessage(next, now));
    }
    if (previous.phase !== next.phase || previous.countdownEndsAt !== next.countdownEndsAt || previous.raceStartedAt !== next.raceStartedAt) {
      const snap = (previous.phase === "lobby" && next.phase === "countdown") || (previous.phase === "finished" && next.phase === "lobby");
      this.#broadcast(phaseMessage(next, now, snap));
    }
    if (roster || previous.phase !== next.phase) {
      this.#broadcast(rosterMessage(next));
    }
  }

  #migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        code TEXT NOT NULL,
        phase TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        empty_since INTEGER,
        host_id TEXT NOT NULL,
        countdown_ends_at INTEGER,
        race_started_at INTEGER,
        orbs TEXT NOT NULL DEFAULT '[]'
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        name TEXT NOT NULL,
        slot INTEGER NOT NULL UNIQUE,
        x REAL NOT NULL,
        z REAL NOT NULL,
        heading REAL NOT NULL,
        speed REAL NOT NULL,
        connected INTEGER NOT NULL,
        last_pose_at INTEGER NOT NULL,
        ready INTEGER NOT NULL DEFAULT 0,
        held TEXT,
        active TEXT,
        active_until INTEGER NOT NULL DEFAULT 0,
        slow_until INTEGER NOT NULL DEFAULT 0,
        finished_at INTEGER,
        place INTEGER NOT NULL DEFAULT 0,
        last_action_at INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.#column("room", "countdown_ends_at", "INTEGER");
    this.#column("room", "race_started_at", "INTEGER");
    this.#column("room", "orbs", "TEXT NOT NULL DEFAULT '[]'");
    this.#column("room", "hazards", "TEXT");
    this.#column("players", "ready", "INTEGER NOT NULL DEFAULT 0");
    this.#column("players", "held", "TEXT");
    this.#column("players", "active", "TEXT");
    this.#column("players", "active_until", "INTEGER NOT NULL DEFAULT 0");
    this.#column("players", "slow_until", "INTEGER NOT NULL DEFAULT 0");
    this.#column("players", "finished_at", "INTEGER");
    this.#column("players", "place", "INTEGER NOT NULL DEFAULT 0");
    this.#column("players", "last_action_at", "INTEGER NOT NULL DEFAULT 0");
  }

  #column(table: "room" | "players", column: string, definition: string): void {
    const rows = this.ctx.storage.sql.exec(`PRAGMA table_info(${table})`).toArray();
    if (rows.some((row) => row.name === column)) {
      return;
    }
    this.ctx.storage.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  #read(): RoomState | null {
    const rows = this.ctx.storage.sql
      .exec("SELECT code, phase, created_at, empty_since, host_id, countdown_ends_at, race_started_at, orbs, hazards FROM room WHERE id = 1")
      .toArray();
    const room = rows[0];
    if (!room) {
      return null;
    }
    const players = this.ctx.storage.sql
      .exec(
        `SELECT id, token, name, slot, x, z, heading, speed, connected, last_pose_at,
                ready, held, active, active_until, slow_until, finished_at, place, last_action_at
         FROM players ORDER BY slot`,
      )
      .toArray();
    return {
      code: text(room.code),
      phase: phaseOf(room.phase),
      createdAt: num(room.created_at),
      emptySince: room.empty_since === null ? null : num(room.empty_since),
      hostId: text(room.host_id),
      countdownEndsAt: room.countdown_ends_at === null ? null : num(room.countdown_ends_at),
      raceStartedAt: room.race_started_at === null ? null : num(room.race_started_at),
      orbs: readOrbList(room.orbs),
      players: players.map((player) => ({
        id: text(player.id),
        token: text(player.token),
        name: text(player.name),
        slot: num(player.slot),
        x: num(player.x),
        z: num(player.z),
        heading: num(player.heading),
        speed: num(player.speed),
        connected: num(player.connected) === 1,
        lastPoseAt: num(player.last_pose_at),
        ready: num(player.ready) === 1,
        held: abilityOf(player.held),
        active: abilityOf(player.active),
        activeUntil: num(player.active_until),
        slowUntil: num(player.slow_until),
        finishedAt: player.finished_at === null ? null : num(player.finished_at),
        place: num(player.place),
        lastActionAt: num(player.last_action_at),
      })),
      hazards: parseHazards(room.hazards, num(room.created_at)),
    };
  }

  async #persist(state: RoomState): Promise<void> {
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO room (id, code, phase, created_at, empty_since, host_id, countdown_ends_at, race_started_at, orbs, hazards)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           code = excluded.code,
           phase = excluded.phase,
           created_at = excluded.created_at,
           empty_since = excluded.empty_since,
           host_id = excluded.host_id,
           countdown_ends_at = excluded.countdown_ends_at,
           race_started_at = excluded.race_started_at,
           orbs = excluded.orbs,
           hazards = excluded.hazards`,
        state.code,
        state.phase,
        state.createdAt,
        state.emptySince,
        state.hostId,
        state.countdownEndsAt,
        state.raceStartedAt,
        JSON.stringify(state.orbs),
        JSON.stringify(state.hazards ?? createBeachHazards(state.createdAt)),
      );
      this.ctx.storage.sql.exec("DELETE FROM players");
      for (const player of state.players) {
        this.ctx.storage.sql.exec(
          `INSERT INTO players (
             id, token, name, slot, x, z, heading, speed, connected, last_pose_at,
             ready, held, active, active_until, slow_until, finished_at, place, last_action_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          player.id,
          player.token,
          player.name,
          player.slot,
          player.x,
          player.z,
          player.heading,
          player.speed,
          player.connected ? 1 : 0,
          player.lastPoseAt,
          player.ready ? 1 : 0,
          player.held,
          player.active,
          player.activeUntil,
          player.slowUntil,
          player.finishedAt,
          player.place,
          player.lastActionAt,
        );
      }
    });
    await this.#schedule(state);
  }

  async #schedule(state: RoomState): Promise<void> {
    const wake = nextWake(state);
    const soon = state.phase === "racing" ? Date.now() + 100 : null;
    const when = wake === null ? soon : soon === null ? wake : Math.min(wake, soon);
    if (when === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(when);
  }

  #send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // The socket can close between the roster check and the send.
    }
  }

  #broadcast(message: ServerMessage, except?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except) {
        this.#send(socket, message);
      }
    }
  }
}

function beachOf(state: RoomState, now: number): BeachHazards {
  return state.hazards ?? createBeachHazards(now);
}

function beachPlayers(state: RoomState, now: number): BeachPlayer[] {
  return state.players.map((player) => ({
    id: player.id,
    x: player.x,
    z: player.z,
    heading: player.heading,
    speed: player.speed,
    connected: player.connected,
    place: player.place,
    guard: player.active === "shell-guard" && player.activeUntil > now,
  }));
}

function rollBeach(state: RoomState, now: number): { state: RoomState; stepped: boolean } {
  if (state.phase !== "racing") {
    return { state, stepped: false };
  }
  const before = beachOf(state, now);
  const result = stepBeach(before, beachPlayers(state, now), now);
  const stepped = result.hazards.steppedAt !== before.steppedAt || result.cleared.length > 0 || result.poses.length > 0;
  if (!stepped) {
    return { state, stepped: false };
  }
  const players = state.players.map((player) => {
    const pose = result.poses.find((item) => item.id === player.id);
    let next = pose ? { ...player, x: pose.x, z: pose.z, speed: 0 } : player;
    if (result.cleared.includes(player.id)) {
      next = { ...next, active: null, activeUntil: 0 };
    }
    return next;
  });
  return { state: { ...state, players, hazards: result.hazards }, stepped: true };
}

function poseOfPlayer(state: RoomState, playerId: string): { x: number; z: number; heading: number; speed: number } | null {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return null;
  }
  return { x: player.x, z: player.z, heading: player.heading, speed: player.speed };
}

function worldMessage(state: RoomState, now: number): ServerMessage {
  return { type: "world", ...worldView(beachOf(state, now), now) };
}

function parseHazards(value: unknown, now: number): BeachHazards {
  if (typeof value !== "string" || value.length === 0) {
    return createBeachHazards(now);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return createBeachHazards(now);
    }
    const hazards = parsed as BeachHazards;
    if (!Array.isArray(hazards.seagulls) || !Array.isArray(hazards.nets) || !Array.isArray(hazards.bubbles) || !Array.isArray(hazards.racers)) {
      return createBeachHazards(now);
    }
    return hazards;
  } catch {
    return createBeachHazards(now);
  }
}

function rosterMessage(state: RoomState): ServerMessage {
  const view = publicView(state);
  return { type: "roster", hostId: view.hostId, phase: view.phase, players: view.players };
}

function phaseMessage(state: RoomState, now: number, snap: boolean): PhaseMessage {
  return {
    type: "phase",
    phase: state.phase,
    endsAt: state.countdownEndsAt,
    startedAt: state.raceStartedAt,
    serverNow: now,
    snap,
  };
}

function loadoutMessage(player: PlayerRecord): ServerMessage {
  return {
    type: "loadout",
    held: player.held,
    active: player.active,
    until: player.activeUntil,
    slowUntil: player.slowUntil,
  };
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function randomUnit(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) / 2 ** 32;
}

function readAttachment(ws: WebSocket): SocketAttachment | null {
  const value: unknown = ws.deserializeAttachment();
  if (!value || typeof value !== "object" || !("playerId" in value)) {
    return null;
  }
  const playerId = (value as { playerId?: unknown }).playerId;
  return typeof playerId === "string" ? { playerId } : null;
}

function readOrbList(value: unknown): OrbState[] {
  if (typeof value !== "string" || value.length === 0) {
    return freshOrbs();
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return freshOrbs();
    }
    const orbs: OrbState[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        return freshOrbs();
      }
      const id = (entry as { id?: unknown }).id;
      const at = (entry as { at?: unknown }).at;
      if (typeof id !== "string" || typeof at !== "number" || !Number.isFinite(at)) {
        return freshOrbs();
      }
      orbs.push({ id, at });
    }
    return orbs;
  } catch {
    return freshOrbs();
  }
}

function abilityOf(value: unknown): AbilityId | null {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(abilityCatalog, value)) {
    return null;
  }
  return value as AbilityId;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function phaseOf(value: unknown): RoomState["phase"] {
  if (value === "lobby" || value === "countdown" || value === "racing" || value === "finished" || value === "closed") {
    return value;
  }
  return "lobby";
}
