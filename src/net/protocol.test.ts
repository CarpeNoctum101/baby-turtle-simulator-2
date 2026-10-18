import { describe, expect, it } from "vitest";
import { displayName, isRoomCode, normalizeRoomCode, parseClientMessage, parseServerMessage, roomCodeFromBytes } from "../../shared/protocol";

describe("room codes and names", () => {
  it("builds a four-character code and rejects ambiguous letters", () => {
    expect(roomCodeFromBytes(new Uint8Array([0, 1, 2, 3]))).toBe("ABCD");
    expect(isRoomCode("ABCD")).toBe(true);
    expect(normalizeRoomCode(" ab3d ")).toBe("AB3D");
    expect(normalizeRoomCode("A0CD")).toBeNull();
    expect(normalizeRoomCode("AOCD")).toBeNull();
    expect(normalizeRoomCode("AICD")).toBeNull();
    expect(normalizeRoomCode("ABC")).toBeNull();
  });

  it("keeps display names short and plain", () => {
    expect(displayName("  Little   Shell!! ")).toBe("Little Shell");
    expect(displayName("<script>")).toBe("script");
    expect(displayName("this name is far too long")).toBe("this name is far");
    expect(displayName("   ")).toBe("Hatchling");
    expect(displayName(4)).toBe("Hatchling");
  });
});

describe("lobby messages", () => {
  it("reads hello, pose, race actions, reset and leave", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hello", playerId: "p1", token: "secret" }))).toEqual({
      type: "hello",
      playerId: "p1",
      token: "secret",
    });
    expect(parseClientMessage(JSON.stringify({ type: "pose", x: 1, z: 2, heading: 0, speed: 1 }))).toMatchObject({
      type: "pose",
      x: 1,
      z: 2,
    });
    expect(parseClientMessage(JSON.stringify({ type: "ready", ready: true }))).toEqual({ type: "ready", ready: true });
    expect(parseClientMessage(JSON.stringify({ type: "start" }))).toEqual({ type: "start" });
    expect(parseClientMessage(JSON.stringify({ type: "pickup", orb: "orb-water" }))).toEqual({ type: "pickup", orb: "orb-water" });
    expect(parseClientMessage(JSON.stringify({ type: "ability", ability: "sand-spray" }))).toEqual({
      type: "ability",
      ability: "sand-spray",
    });
    expect(parseClientMessage(JSON.stringify({ type: "ability", ability: "fly" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "finish" }))).toEqual({ type: "finish" });
    expect(parseClientMessage(JSON.stringify({ type: "finish", place: 1 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "finish", ms: 10 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "rematch" }))).toEqual({ type: "rematch" });
    expect(parseClientMessage(JSON.stringify({ type: "reset" }))).toEqual({ type: "reset" });
    expect(parseClientMessage(JSON.stringify({ type: "leave" }))).toEqual({ type: "leave" });
    expect(parseClientMessage("nope")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "pose", x: Number.POSITIVE_INFINITY, z: 0, heading: 0, speed: 0 }))).toBeNull();
  });

  it("does not accept a roster that smuggles a token", () => {
    const raw = JSON.stringify({
      type: "roster",
      hostId: "p1",
      phase: "lobby",
      players: [{ id: "p1", token: "secret", name: "Coral", slot: 0, connected: true, ready: false, place: 0, ms: 0, x: 0, z: -24, heading: 0, speed: 0 }],
    });
    expect(parseServerMessage(raw)).toBeNull();
  });

  it("accepts a welcome that only carries public fields", () => {
    const message = parseServerMessage(JSON.stringify({
      type: "welcome",
      roomCode: "ABCD",
      playerId: "p1",
      hostId: "p1",
      slot: 0,
      phase: "lobby",
      x: -8.4,
      z: -24,
      heading: 0,
      speed: 0,
      players: [{ id: "p1", name: "Coral", slot: 0, connected: true, ready: true, place: 0, ms: 0, x: -8.4, z: -24, heading: 0, speed: 0 }],
    }));
    expect(message?.type).toBe("welcome");
    expect(message && "players" in message ? message.players[0] : null).not.toHaveProperty("token");
  });
});
