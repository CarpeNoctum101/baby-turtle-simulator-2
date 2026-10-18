import { describe, expect, it } from "vitest";
import { bubbleRules } from "../abilities/bubble";
import { seagullSpawns } from "../mob/seagull";
import { bubbleShotRules } from "../abilities/catalog";
import {
  armBubbleGun,
  createBeachHazards,
  fireBubble,
  stepBeach,
  struggleBeach,
  worldView,
  type BeachPlayer,
} from "../../shared/beachHazards";

function player(id: string, x: number, z: number): BeachPlayer {
  return { id, x, z, heading: 0, speed: 0, connected: true, place: 0, guard: false };
}

function run(players: BeachPlayer[], seconds: number) {
  let hazards = createBeachHazards(0);
  let now = 0;
  const steps = Math.round(seconds * 1000 / 50);
  for (let step = 0; step < steps; step += 1) {
    now += 50;
    hazards = stepBeach(hazards, players, now).hazards;
  }
  return hazards;
}

describe("shared beach hazards", () => {
  it("lets each seagull lock a different turtle when both are in reach", () => {
    const [first, second] = seagullSpawns;
    if (!first || !second) throw new Error("expected two flying gulls");
    const hazards = run([
      player("a", first.home.x, first.home.z),
      player("b", second.home.x, second.home.z),
    ], 0.4);
    const targets = hazards.seagulls.map((gull) => gull.targetId).filter((id): id is string => id !== null);
    expect(targets.length).toBeGreaterThan(1);
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).toContain("a");
    expect(targets).toContain("b");
  });

  it("catches only the turtle a net locked, even if another turtle stands in the circle", () => {
    const hazards = run([player("a", -2, -5), player("b", -2, -5)], 3);
    const slowed = hazards.racers.filter((racer) => racer.netSlow > 0).map((racer) => racer.id);
    expect(slowed).toHaveLength(1);
  });

  it("puts a bubble into the shared world so every screen can draw it", () => {
    let hazards = stepBeach(createBeachHazards(0), [player("a", 0, 0), player("b", 0, 2)], 0).hazards;
    hazards = armBubbleGun(hazards, "a", 8_000, 0);
    const fired = fireBubble(hazards, "a", { x: 0, y: 0.55, z: 0 }, { x: 0, y: 0, z: 1 }, 0);
    expect(fired.ok).toBe(true);
    if (!fired.ok) {
      return;
    }
    expect(fired.hazards.bubbles).toHaveLength(1);
    expect(fired.hazards.racers.find((racer) => racer.id === "a")?.gunShots).toBe(bubbleShotRules.shots - 1);
    const flown = stepBeach(fired.hazards, [player("a", 0, 0), player("b", 0, 2)], 100).hazards;
    const view = worldView(flown, 100);
    const trapped = flown.racers.some((racer) => racer.bubble > 0);
    expect(view.bubbles.length > 0 || trapped).toBe(true);
  });

  it("traps the other turtle and ignores the shooter", () => {
    let hazards = stepBeach(createBeachHazards(0), [player("a", 0, 0), player("b", 0, 1.2)], 0).hazards;
    hazards = armBubbleGun(hazards, "a", 8_000, 0);
    const fired = fireBubble(hazards, "a", { x: 0, y: 0.55, z: 0 }, { x: 0, y: 0, z: 1 }, 0);
    if (!fired.ok) {
      throw new Error("expected a shot");
    }
    let current = fired.hazards;
    let now = 0;
    for (let step = 0; step < 20 && (current.racers.find((racer) => racer.id === "b")?.bubble ?? 0) === 0; step += 1) {
      now += 50;
      current = stepBeach(current, [player("a", 0, 0), player("b", 0, 1.2)], now).hazards;
    }
    expect(current.racers.find((racer) => racer.id === "a")?.bubble ?? 0).toBe(0);
    expect(current.racers.find((racer) => racer.id === "b")?.bubble ?? 0).toBeGreaterThan(0);
    expect(current.racers.find((racer) => racer.id === "b")?.bubble).toBeCloseTo(bubbleRules.trapSeconds, 0);
  });

  it("shortens a net on the server when the caught turtle struggles", () => {
    const caught = run([player("a", -2, -5), player("b", 8, 40)], 3);
    const slowed = caught.racers.find((racer) => racer.netSlow > 0);
    expect(slowed).toBeDefined();
    if (!slowed) {
      return;
    }
    const struggled = struggleBeach(caught, slowed.id);
    const after = struggled.racers.find((racer) => racer.id === slowed.id);
    expect(after?.netSlow).toBeLessThan(slowed.netSlow);
  });
});
