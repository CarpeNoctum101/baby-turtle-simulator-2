import { describe, expect, it } from "vitest";
import { createTurtleMotion, stepTurtle } from "../movement/stepTurtle";
import { course } from "../movement/course";
import { catchInNet, createNetHazards, netRules, netSpeedScale, netThrowerSpawns, stepNetHazards, struggleInNet, type NetHazards, type NetTick } from "./netThrower";

const player = { ...createTurtleMotion(), z: -9 };
const tick: NetTick = { dt: 0.05, racing: true, player, rival: { ...player, x: 8 }, playerGrounded: true };
function run(state: NetHazards, seconds: number, overrides: Partial<NetTick> = {}) {
  let next = state;
  const hits: string[] = [];
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) {
    const result = stepNetHazards(next, { ...tick, ...overrides });
    next = result.state; hits.push(...result.hits);
  }
  return { state: next, hits };
}

describe("beach net hazards", () => {
  it("keeps the humans outside the lane and waits for a nearby grounded racer", () => {
    expect(netThrowerSpawns.every(spawn => Math.abs(spawn.x) > course.halfWidth + 1)).toBe(true);
    const state = createNetHazards(netThrowerSpawns);
    expect(run(state, 2, { player: createTurtleMotion() }).state.throwers.every(t => t.phase === "idle")).toBe(true);
    expect(run(state, 2, { playerGrounded: false }).state.throwers.every(t => t.phase === "idle")).toBe(true);
    expect(stepNetHazards(state, { ...tick, racing: false }).state).toBe(state);
  });

  it("winds up, predicts motion, locks at release and lets the racer dodge", () => {
    let state = run(createNetHazards(netThrowerSpawns), 1, { player: { ...player, speed: 4 } }).state;
    expect(state.throwers[0].phase).toBe("flight");
    const target = { ...state.throwers[0].target };
    expect(target.z).toBeCloseTo(player.z + 4 * netRules.flightSeconds);
    const dodged = run(state, 1.4, { player: { ...player, x: 8, z: target.z } });
    state = dodged.state;
    expect(state.throwers[0].target).toEqual(target);
    expect(state.throwers[0].phase).toBe("ground");
    expect(dodged.hits).not.toContain("player");
  });

  it("hits each racer only once, clears landed nets and respects a cooldown", () => {
    const landed = run(createNetHazards(netThrowerSpawns), 2.1);
    expect(landed.hits).toEqual(["player"]);
    expect(run(landed.state, 1).hits).toEqual([]);
    const clear = run(landed.state, 2).state;
    expect(clear.throwers[0].phase).toBe("rest");
    expect(run(clear, 3).state.throwers[0].phase).toBe("rest");
    expect(run(clear, 6).state.throwers[0].phase).not.toBe("rest");
  });

  it("slows movement without stopping steering, expires and grants catch immunity", () => {
    const caught = catchInNet(createNetHazards(netThrowerSpawns), "player");
    const scale = netSpeedScale(caught, "player");
    expect(scale).toBe(netRules.slowMultiplier);
    const moved = stepTurtle(player, { throttle: 0, steer: 1, brake: false }, 0.05, undefined,
      { maxSpeedMultiplier: scale, accelerationMultiplier: scale });
    expect(moved.x).toBeGreaterThan(player.x);
    expect(moved.heading).toBeCloseTo(Math.PI / 2);
    const expired = run(caught, netRules.slowSeconds + 0.15).state;
    expect(netSpeedScale(expired, "player")).toBe(1);
    expect(expired.grace.player).toBeGreaterThan(1);
    expect(run(expired, 0.5).hits).not.toContain("player");
    const fresh = createNetHazards(netThrowerSpawns);
    expect(fresh.slow.player).toBe(0);
    expect(fresh.throwers.every(t => t.phase === "idle")).toBe(true);
  });

  it("can catch a rival inside the same net and cancels aiming if the turtle leaves", () => {
    expect(run(createNetHazards(netThrowerSpawns), 2.1, { rival: player }).hits).toEqual(["player", "rival"]);
    const aimed = run(createNetHazards(netThrowerSpawns), 0.2).state;
    const cancelled = stepNetHazards(aimed, { ...tick, player: { ...player, z: -30 } }).state;
    expect(cancelled.throwers[0].phase).toBe("rest");
  });

  it("shortens the slow each time the turtle struggles", () => {
    let state = catchInNet(createNetHazards(), "player");
    const once = struggleInNet(state, "player");
    expect(once.slow.player).toBeCloseTo(netRules.slowSeconds - netRules.struggleSeconds);
    expect(once.grace.player).toBeCloseTo(state.grace.player - netRules.struggleSeconds);
    let presses = 0;
    while (state.slow.player > 0 && presses < 100) {
      state = struggleInNet(state, "player");
      presses += 1;
    }
    expect(presses).toBe(netRules.escapePresses);
    expect(state.slow.player).toBe(0);
    expect(netSpeedScale(state, "player")).toBe(1);
    expect(struggleInNet(state, "player")).toBe(state);
  });

  it("ignores invalid time deltas and caps long frames", () => {
    const state = catchInNet(createNetHazards(), "player");
    for (const dt of [NaN, Infinity, -1]) expect(stepNetHazards(state, { ...tick, dt }).state.slow.player).toBe(netRules.slowSeconds);
    expect(stepNetHazards(state, { ...tick, dt: 10 }).state.slow.player).toBeCloseTo(netRules.slowSeconds - 0.05);
  });
});
