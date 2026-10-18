import { describe, expect, it } from "vitest";
import { clampToBeach } from "../movement/course";
import {
  abandonAfterMs,
  applyPose,
  authenticate,
  closeIfAbandoned,
  connectPlayer,
  disconnectPlayer,
  joinRoom,
  maxPlayers,
  openRoom,
  publicView,
  removePlayer,
  resetPlayer,
  slotPose,
} from "../../shared/roomState";

const now = 1_000_000;

function lobby() {
  return openRoom({ code: "ABCD", name: "Coral", playerId: "host", token: "host-token", now });
}

describe("starting pads", () => {
  it("gives eight distinct pads on the nest, inside the beach", () => {
    const pads = Array.from({ length: maxPlayers }, (_, slot) => slotPose(slot));
    const xs = new Set(pads.map((pad) => pad.x));
    expect(xs.size).toBe(maxPlayers);
    for (const pad of pads) {
      expect(pad.z).toBe(-24);
      expect(pad.heading).toBe(0);
      expect(pad.x).toBe(clampToBeach(pad.x));
    }
    expect(pads[1].x - pads[0].x).toBeGreaterThan(1.5);
  });
});

describe("lobby membership", () => {
  it("opens a room for the host and joins until the room is full", () => {
    let { state } = lobby();
    expect(state.players[0]).toMatchObject({ id: "host", slot: 0, connected: false });
    for (let index = 1; index < maxPlayers; index += 1) {
      const joined = joinRoom(state, { name: `Racer ${index}`, playerId: `p${index}`, token: `t${index}`, now });
      expect(joined.ok).toBe(true);
      if (joined.ok) {
        state = joined.state;
        expect(joined.ticket.slot).toBe(index);
        expect(joined.ticket).not.toHaveProperty("players");
      }
    }
    const extra = joinRoom(state, { name: "Late", playerId: "late", token: "late-token", now });
    expect(extra).toMatchObject({ ok: false, status: 409 });
  });

  it("keeps a pad reserved after a disconnect and frees it when the player leaves", () => {
    const opened = lobby();
    const joined = joinRoom(opened.state, { name: "Pebble", playerId: "guest", token: "guest-token", now });
    if (!joined.ok) {
      throw new Error("join failed");
    }
    const away = disconnectPlayer(connectPlayer(joined.state, "guest", now) ?? joined.state, "guest", now + 10);
    expect(authenticate(away, "guest", "guest-token")?.slot).toBe(1);
    const stillFullEnough = joinRoom(away, { name: "Other", playerId: "other", token: "other-token", now });
    expect(stillFullEnough.ok).toBe(true);
    if (stillFullEnough.ok) {
      expect(stillFullEnough.ticket.slot).toBe(2);
    }
    const left = removePlayer(away, "guest", now + 20);
    const reused = joinRoom(left, { name: "Next", playerId: "next", token: "next-token", now });
    expect(reused.ok && reused.ticket.slot).toBe(1);
  });

  it("hands the host role to the next connected player", () => {
    const opened = lobby();
    const joined = joinRoom(opened.state, { name: "Pebble", playerId: "guest", token: "guest-token", now });
    if (!joined.ok) {
      throw new Error("join failed");
    }
    const both = connectPlayer(connectPlayer(joined.state, "host", now) ?? joined.state, "guest", now);
    const hostLeft = removePlayer(both ?? joined.state, "host", now + 5);
    expect(hostLeft.hostId).toBe("guest");
  });

  it("hides the secret token from the roster", () => {
    const view = publicView(lobby().state);
    expect(JSON.stringify(view)).not.toContain("host-token");
    expect(view.players[0]).not.toHaveProperty("token");
  });

  it("closes a room only after it has been empty for two minutes", () => {
    const { state } = lobby();
    expect(closeIfAbandoned(state, now + abandonAfterMs - 1).phase).toBe("lobby");
    const closed = closeIfAbandoned(state, now + abandonAfterMs);
    expect(closed.phase).toBe("closed");
    expect(closed.players).toEqual([]);
    expect(joinRoom(closed, { name: "Late", playerId: "late", token: "t", now })).toMatchObject({
      ok: false,
      status: 404,
    });
    const occupied = connectPlayer(state, "host", now);
    expect(closeIfAbandoned(occupied ?? state, now + abandonAfterMs).phase).toBe("lobby");
  });

  it("rejects a wrong token", () => {
    expect(authenticate(lobby().state, "host", "nope")).toBeNull();
  });
});

describe("shared crawl", () => {
  it("accepts a short crawl and rejects a teleport", () => {
    const connected = connectPlayer(lobby().state, "host", now);
    if (!connected) {
      throw new Error("connect failed");
    }
    const home = connected.players[0];
    const step = applyPose(connected, "host", { x: home.x, z: home.z + 0.2, heading: 0.1, speed: 3, }, now + 50);
    expect(step.ok).toBe(true);
    const jump = applyPose(connected, "host", { x: home.x, z: home.z + 30, heading: 0, speed: 3 }, now + 50);
    expect(jump.ok).toBe(false);
    if (!jump.ok) {
      expect(jump.reason).toBe("too-fast");
      expect(jump.pose?.z).toBe(home.z);
    }
    const offBeach = applyPose(connected, "host", { x: 100, z: home.z, heading: 0, speed: 1 }, now + 50);
    expect(offBeach.ok).toBe(false);
    if (!offBeach.ok) {
      expect(offBeach.reason).toBe("invalid");
    }
  });

  it("drops poses that arrive too quickly without moving the turtle", () => {
    const connected = connectPlayer(lobby().state, "host", now);
    if (!connected) {
      throw new Error("connect failed");
    }
    const burst = applyPose(connected, "host", { x: 0, z: -23.8, heading: 0, speed: 1 }, now + 10);
    expect(burst.ok).toBe(false);
    if (!burst.ok) {
      expect(burst.reason).toBe("rate");
    }
  });

  it("returns a player to their own pad", () => {
    const connected = connectPlayer(lobby().state, "host", now);
    if (!connected) {
      throw new Error("connect failed");
    }
    const moved = applyPose(connected, "host", { x: -8, z: -20, heading: 1, speed: 4 }, now + 400);
    if (!moved.ok) {
      throw new Error("pose failed");
    }
    const reset = resetPlayer(moved.state, "host", now + 500);
    expect(reset?.pose).toMatchObject({ x: slotPose(0).x, z: -24, speed: 0 });
  });
});
