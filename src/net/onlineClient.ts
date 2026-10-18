import type { AbilityId } from "../abilities/catalog";
import { parseServerMessage, type ClientMessage, type ServerMessage, type Ticket } from "../../shared/protocol";

const storageKey = "baby-turtle-room";

export function saveTicket(ticket: Ticket): void {
  sessionStorage.setItem(storageKey, JSON.stringify(ticket));
}

export function loadTicket(): Ticket | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return isTicket(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearTicket(): void {
  sessionStorage.removeItem(storageKey);
}

export function roomSocketUrl(roomCode: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${roomCode}/ws`;
}

export async function createOnlineRoom(name: string): Promise<Ticket> {
  return postTicket("/api/rooms", name);
}

export async function joinOnlineRoom(roomCode: string, name: string): Promise<Ticket> {
  return postTicket(`/api/rooms/${encodeURIComponent(roomCode)}/join`, name);
}

export interface OnlineEvents {
  onWelcome: (message: Extract<ServerMessage, { type: "welcome" }>) => void;
  onRoster: (message: Extract<ServerMessage, { type: "roster" }>) => void;
  onPose: (message: Extract<ServerMessage, { type: "pose" }>) => void;
  onRejected: (message: Extract<ServerMessage, { type: "pose-rejected" }>) => void;
  onPhase?: (message: Extract<ServerMessage, { type: "phase" }>) => void;
  onOrbs?: (message: Extract<ServerMessage, { type: "orbs" }>) => void;
  onOrb?: (message: Extract<ServerMessage, { type: "orb" }>) => void;
  onLoadout?: (message: Extract<ServerMessage, { type: "loadout" }>) => void;
  onAbility?: (message: Extract<ServerMessage, { type: "ability" }>) => void;
  onFinish?: (message: Extract<ServerMessage, { type: "finish" }>) => void;
  onRejectedAction?: (message: Extract<ServerMessage, { type: "rejected" }>) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/** One browser tab's connection to a race room. */
export class OnlineSession {
  private socket: WebSocket | null = null;
  private welcomed = false;
  private closing = false;

  constructor(private readonly events: OnlineEvents) {}

  connect(ticket: Ticket): void {
    this.closing = false;
    this.welcomed = false;
    this.socket?.close();
    const socket = new WebSocket(roomSocketUrl(ticket.roomCode));
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      socket.send(JSON.stringify({ type: "hello", playerId: ticket.playerId, token: ticket.token }));
    });
    socket.addEventListener("message", (event) => {
      if (this.socket !== socket) {
        return;
      }
      const message = parseServerMessage(String(event.data));
      if (!message) {
        return;
      }
      if (message.type === "welcome") {
        this.welcomed = true;
        this.events.onWelcome(message);
        return;
      }
      if (message.type === "roster") {
        this.events.onRoster(message);
        return;
      }
      if (message.type === "pose") {
        this.events.onPose(message);
        return;
      }
      if (message.type === "pose-rejected") {
        this.events.onRejected(message);
        return;
      }
      if (message.type === "phase") {
        this.events.onPhase?.(message);
        return;
      }
      if (message.type === "orbs") {
        this.events.onOrbs?.(message);
        return;
      }
      if (message.type === "orb") {
        this.events.onOrb?.(message);
        return;
      }
      if (message.type === "loadout") {
        this.events.onLoadout?.(message);
        return;
      }
      if (message.type === "ability") {
        this.events.onAbility?.(message);
        return;
      }
      if (message.type === "finish") {
        this.events.onFinish?.(message);
        return;
      }
      if (message.type === "rejected") {
        this.events.onRejectedAction?.(message);
        return;
      }
      this.events.onError(message.message);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.welcomed = false;
      if (!this.closing) {
        this.events.onClose();
      }
    });
  }

  sendPose(pose: { x: number; z: number; heading: number; speed: number }): void {
    this.send({ type: "pose", ...pose });
  }

  sendReset(): void {
    this.send({ type: "reset" });
  }

  sendReady(ready: boolean): void {
    this.send({ type: "ready", ready });
  }

  sendStart(): void {
    this.send({ type: "start" });
  }

  sendPickup(orb: string): void {
    this.send({ type: "pickup", orb });
  }

  sendAbility(ability: AbilityId): void {
    this.send({ type: "ability", ability });
  }

  sendFinish(): void {
    this.send({ type: "finish" });
  }

  sendRematch(): void {
    this.send({ type: "rematch" });
  }

  leave(): void {
    this.closing = true;
    this.send({ type: "leave" });
    this.socket?.close();
    this.socket = null;
  }

  /** Closes the socket without giving up the pad, so a later hello can reconnect. */
  drop(): void {
    this.closing = true;
    this.socket?.close();
    this.socket = null;
  }

  private send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!this.welcomed && message.type !== "hello") {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }
}

/**
 * Tells the previous room that this hatchling is leaving before a different room is opened.
 * Gives up after a second so a stopped server cannot trap the player on the menu.
 */
export function releaseTicket(ticket: Ticket): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    const session = new OnlineSession({
      onWelcome: () => {
        session.leave();
        finish();
      },
      onRoster: () => undefined,
      onPose: () => undefined,
      onRejected: () => undefined,
      onError: finish,
      onClose: finish,
    });
    session.connect(ticket);
    window.setTimeout(() => {
      session.drop();
      finish();
    }, 1000);
  });
}

async function postTicket(path: string, name: string): Promise<Ticket> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new Error("The online lobby is not running. Start the local multiplayer server, or use Start race to play on this computer.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "The online lobby could not open that room.";
    throw new Error(message);
  }
  if (!isTicket(body)) {
    throw new Error("The online lobby sent an incomplete reply.");
  }
  return body;
}

function isTicket(value: unknown): value is Ticket {
  if (!value || typeof value !== "object") {
    return false;
  }
  const ticket = value as Partial<Ticket>;
  return typeof ticket.roomCode === "string"
    && typeof ticket.playerId === "string"
    && typeof ticket.token === "string"
    && typeof ticket.name === "string"
    && typeof ticket.slot === "number"
    && typeof ticket.x === "number"
    && typeof ticket.z === "number"
    && typeof ticket.heading === "number";
}
