import { describe, expect, it } from "vitest";
import { tideOrbSpots } from "../abilities/pickups";
import { course } from "../movement/course";
import {
  advanceRace,
  activateAbility,
  claimFinish,
  claimPickup,
  compareResults,
  countdownMs,
  nextWake,
  raceLimitMs,
  requestRematch,
  requestStart,
  setReady,
  syncedRemaining,
} from "../../shared/raceFlow";
import { abandonAfterMs, applyPose, canMoveInRoom, connectPlayer, disconnectPlayer, joinRoom, openRoom } from "../../shared/roomState";
import type { RoomState } from "../../shared/roomState";
import { stepTurtle, type TurtleMotion } from "../movement/stepTurtle";

const now = 1_000_000;

function lobby(): RoomState {
  const opened = openRoom({ code: "ABCD", name: "Coral", playerId: "host", token: "host-token", now });
  const joined = joinRoom(opened.state, { name: "Pebble", playerId: "guest", token: "guest-token", now });
  if (!joined.ok) {
    throw new Error("join failed");
  }
  const host = connectPlayer(joined.state, "host", now);
  const both = host ? connectPlayer(host, "guest", now) : null;
  if (!both) {
    throw new Error("connect failed");
  }
  return both;
}

function readyRoom(): RoomState {
  const host = setReady(lobby(), "host", true, now + 200);
  if (!host.ok) {
    throw new Error("host ready failed");
  }
  const guest = setReady(host.state, "guest", true, now + 200);
  if (!guest.ok) {
    throw new Error("guest ready failed");
  }
  return guest.state;
}

function racingRoom(): RoomState {
  const started = requestStart(readyRoom(), "host", now + 400);
  if (!started.ok) {
    throw new Error("start failed");
  }
  return advanceRace(started.state, now + 400 + countdownMs).state;
}

function place(state: RoomState, playerId: string, x: number, z: number): RoomState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, x, z } : player)),
  };
}

describe("race transitions", () => {
  it("starts a shared countdown only when the host and every connected hatchling are ready", () => {
    const early = requestStart(lobby(), "host", now + 400);
    expect(early).toMatchObject({ ok: false, reason: "ready" });

    const guestStart = requestStart(readyRoom(), "guest", now + 400);
    expect(guestStart).toMatchObject({ ok: false, reason: "host" });

    const started = requestStart(readyRoom(), "host", now + 400);
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.state.phase).toBe("countdown");
    expect(started.state.countdownEndsAt).toBe(now + 400 + countdownMs);
    expect(started.state.players.every((player) => player.place === 0 && player.held === null)).toBe(true);

    const again = requestStart(started.state, "host", now + 1_000);
    expect(again).toMatchObject({ ok: false, reason: "phase" });
    const during = advanceRace(started.state, (started.state.countdownEndsAt ?? 0) - 1);
    expect(during.changed).toBe(false);
    expect(during.state.phase).toBe("countdown");
    const gone = advanceRace(started.state, started.state.countdownEndsAt ?? 0);
    expect(gone.state.phase).toBe("racing");
    expect(gone.state.raceStartedAt).toBe(started.state.countdownEndsAt);
  });

  it("rejects ready checks and movement once the countdown has begun", () => {
    const started = requestStart(readyRoom(), "host", now + 400);
    if (!started.ok) {
      throw new Error("start failed");
    }
    expect(setReady(started.state, "guest", false, now + 1_000)).toMatchObject({ ok: false, reason: "phase" });
    const crawled = applyPose(started.state, "host", { x: 0, z: -20, heading: 0, speed: 1 }, now + 1_000);
    expect(crawled.ok).toBe(false);
    if (!crawled.ok) {
      expect(crawled.reason).toBe("phase");
    }
  });

  it("holds both clients on their pads with movement held until the server starts racing", () => {
    const started = requestStart(readyRoom(), "host", now + 400);
    if (!started.ok) throw new Error("start failed");
    const deadline = started.state.countdownEndsAt!;
    for (const player of started.state.players) {
      let motion: TurtleMotion = { x: player.x, z: player.z, heading: player.heading, speed: 0, steer: 0 };
      const home = { ...motion };
      // Even a locally expired timer cannot unlock prediction before the server's racing phase.
      for (let frame = 0; frame < 200; frame++) {
        if (canMoveInRoom(started.state.phase, player.place)) {
          motion = stepTurtle(motion, { throttle: 1, steer: 1, brake: false }, 1 / 60);
        }
      }
      expect(motion).toEqual(home);
      const rejected = applyPose(started.state, player.id, { ...motion, z: motion.z + 1 }, deadline - 1);
      expect(rejected).toMatchObject({ ok: false, reason: "phase" });
      const racing = advanceRace(started.state, deadline).state;
      expect(canMoveInRoom(racing.phase, player.place)).toBe(true);
      motion = stepTurtle(motion, { throttle: 1, steer: 0, brake: false }, 1 / 60);
      expect(motion.z).toBeGreaterThan(home.z);
      expect(applyPose(racing, player.id, motion, deadline + 50).ok).toBe(true);
    }
  });

  it("keeps lobby movement available and stops finished racers", () => {
    expect(canMoveInRoom("lobby", 0)).toBe(true);
    expect(canMoveInRoom("racing", 1)).toBe(false);
    expect(canMoveInRoom("finished", 0)).toBe(false);
    expect(canMoveInRoom("closed", 0)).toBe(false);
  });

  it("lets a disconnected hatchling leave without freezing the others", () => {
    const racing = racingRoom();
    const guestLeft = advanceRace(disconnectPlayer(racing, "guest", now + 5_000), now + 5_000);
    expect(guestLeft.state.phase).toBe("racing");

    const atOcean = place(guestLeft.state, "host", 0, course.finish.minZ);
    const hostFinish = claimFinish(atOcean, "host", now + 6_000);
    expect(hostFinish.ok).toBe(true);
    if (!hostFinish.ok) {
      return;
    }
    expect(hostFinish.place).toBe(1);
    expect(hostFinish.state.phase).toBe("finished");
    expect(hostFinish.state.players.find((player) => player.id === "guest")?.place).toBe(0);
  });

  it("ends a race that nobody is still crawling, and a race that runs out of time", () => {
    const racing = racingRoom();
    const startedAt = racing.raceStartedAt ?? 0;
    const quiet = advanceRace(racing, startedAt + raceLimitMs - 1);
    expect(quiet.state.phase).toBe("racing");
    const timedOut = advanceRace(racing, startedAt + raceLimitMs);
    expect(timedOut.state.phase).toBe("finished");
    expect(nextWake(racing)).toBe(startedAt + raceLimitMs);
    expect(nextWake(timedOut.state)).toBeNull();

    const empty = disconnectPlayer(disconnectPlayer(racing, "host", startedAt + 10), "guest", startedAt + 10);
    const stillOpen = advanceRace(empty, startedAt + 10);
    expect(stillOpen.state.phase).toBe("racing");
    expect(nextWake(stillOpen.state)).toBe(startedAt + raceLimitMs);
    const afterLimit = advanceRace(stillOpen.state, startedAt + raceLimitMs);
    expect(afterLimit.state.phase).toBe("finished");
    expect(nextWake(afterLimit.state)).toBe((afterLimit.state.emptySince ?? 0) + abandonAfterMs);
  });

  it("returns to the lobby only from a finished race, and only for the host", () => {
    const racing = racingRoom();
    expect(requestRematch(racing, "host", now + 5_000)).toMatchObject({ ok: false, reason: "phase" });
    const finished = advanceRace(racing, (racing.raceStartedAt ?? 0) + raceLimitMs).state;
    expect(requestRematch(finished, "guest", (racing.raceStartedAt ?? 0) + raceLimitMs + 200)).toMatchObject({
      ok: false,
      reason: "host",
    });
    const again = requestRematch(finished, "host", (racing.raceStartedAt ?? 0) + raceLimitMs + 200);
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.state.phase).toBe("lobby");
    expect(again.state.players.every((player) => player.place === 0 && !player.ready && player.held === null)).toBe(true);
    expect(again.state.orbs.every((orb) => orb.at === 0)).toBe(true);
  });

  it("sorts finishers by the server place and leaves did-not-finish last", () => {
    const rows = [
      { place: 0, name: "Coral" },
      { place: 2, name: "Pebble" },
      { place: 1, name: "Drift" },
    ].sort(compareResults);
    expect(rows.map((row) => row.name)).toEqual(["Drift", "Pebble", "Coral"]);
  });

  it("measures the countdown from the server clock", () => {
    const localNow = 5_000;
    const offset = 40;
    expect(syncedRemaining(8_000, offset, localNow)).toBeCloseTo(2.96);
  });
});

describe("ability validation", () => {
  it("rejects a Tide Orb that is missing, far away, already taken, or picked up while one is held", () => {
    const racing = racingRoom();
    const when = racing.raceStartedAt ?? 0;
    const missing = claimPickup(racing, "host", "orb-nope", when, () => 0);
    expect(missing).toMatchObject({ ok: false, reason: "orb" });

    const far = claimPickup(racing, "host", "orb-water", when, () => 0);
    expect(far).toMatchObject({ ok: false, reason: "range" });

    const spot = tideOrbSpots[0];
    if (!spot) {
      throw new Error("missing orb");
    }
    const near = place(racing, "host", spot.x, spot.z);
    const first = claimPickup(near, "host", spot.id, when, () => 0);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.ability).toBe("flipper-frenzy");
    expect(first.state.orbs.find((orb) => orb.id === spot.id)?.at).toBe(when + 9_000);
    expect(first.state.players.find((player) => player.id === "host")?.held).toBe("flipper-frenzy");

    const guestGrab = claimPickup(place(first.state, "guest", spot.x, spot.z), "guest", spot.id, when + 200, () => 0);
    expect(guestGrab).toMatchObject({ ok: false, reason: "orb" });

    const other = tideOrbSpots[1];
    if (!other) {
      throw new Error("missing orb");
    }
    const second = claimPickup(place(first.state, "host", other.x, other.z), "host", other.id, when + 200, () => 0);
    expect(second).toMatchObject({ ok: false, reason: "held" });
  });

  it("rejects an ability the hatchling does not hold, and a second press of one that was spent", () => {
    const racing = racingRoom();
    const when = racing.raceStartedAt ?? 0;
    expect(activateAbility(racing, "host", "sand-spray", when)).toMatchObject({ ok: false, reason: "empty" });

    const holding = {
      ...racing,
      players: racing.players.map((player) => (player.id === "host" ? { ...player, held: "sand-spray" as const } : player)),
    };
    const first = activateAbility(holding, "host", "sand-spray", when);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.state.players.find((player) => player.id === "host")?.held).toBeNull();
    const again = activateAbility(first.state, "host", "sand-spray", when + 200);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe("running");
    }

    const refilled = {
      ...first.state,
      players: first.state.players.map((player) =>
        player.id === "host" ? { ...player, held: "flipper-frenzy" as const, lastActionAt: 0 } : player,
      ),
    };
    expect(activateAbility(refilled, "host", "flipper-frenzy", when + 300)).toMatchObject({ ok: false, reason: "running" });
  });

  it("slows a hatchling in the sand cloud and spends a shell instead of slowing it", () => {
    const racing = racingRoom();
    const when = racing.raceStartedAt ?? 0;
    const armed = {
      ...racing,
      players: racing.players.map((player) => {
        if (player.id === "host") {
          return { ...player, held: "sand-spray" as const, x: 0, z: 0, heading: 0 };
        }
        return { ...player, x: 0, z: -2, heading: 0 };
      }),
    };
    const sprayed = activateAbility(armed, "host", "sand-spray", when);
    expect(sprayed.ok).toBe(true);
    if (!sprayed.ok) {
      return;
    }
    expect(sprayed.activation.slowed).toEqual(["guest"]);
    expect(sprayed.state.players.find((player) => player.id === "guest")?.slowUntil).toBeGreaterThan(when);

    const shielded = {
      ...armed,
      players: armed.players.map((player) =>
        player.id === "guest" ? { ...player, active: "shell-guard" as const, activeUntil: when + 5_000 } : player,
      ),
    };
    const blocked = activateAbility(shielded, "host", "sand-spray", when);
    expect(blocked.ok).toBe(true);
    if (!blocked.ok) {
      return;
    }
    expect(blocked.activation.blocked).toEqual(["guest"]);
    expect(blocked.activation.slowed).toEqual([]);
    expect(blocked.state.players.find((player) => player.id === "guest")?.active).toBeNull();
  });

  it("assigns finishing places itself and rejects a finish from outside the ocean", () => {
    const racing = racingRoom();
    const when = racing.raceStartedAt ?? 0;
    const tooSoon = claimFinish(racing, "host", when);
    expect(tooSoon).toMatchObject({ ok: false, reason: "zone" });

    const hostThere = place(racing, "host", 0, course.finish.minZ);
    const first = claimFinish(hostThere, "host", when + 1_000);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.place).toBe(1);
    expect(first.ms).toBe(1_000);
    expect(first.state.phase).toBe("racing");
    expect(claimFinish(first.state, "host", when + 1_500)).toMatchObject({ ok: false, reason: "done" });

    const bothThere = place(first.state, "guest", 1, course.finish.minZ);
    const second = claimFinish(bothThere, "guest", when + 4_000);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.place).toBe(2);
    expect(second.ms).toBe(4_000);
    expect(second.state.phase).toBe("finished");
    expect(second.state.players.map((player) => player.place).sort()).toEqual([1, 2]);
  });
});
