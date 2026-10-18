import { describe, expect, it } from "vitest";
import { beginAbility, createEffects, createLoadout, holdAbility } from "./abilityState";
import { createSnap, lungeExtension, snapRules, stepSnap, trySnap } from "./snap";
import { damageRules } from "./health";
import { createTurtleMotion } from "../movement/stepTurtle";

const attacker = { x: 0, z: 0 };
const near = { ...createTurtleMotion(), x: 1, z: -1, speed: 2 };
const far = { ...createTurtleMotion(), x: 0, z: -10, speed: 2 };

describe("snap", () => {
  it("bites a rival in reach for damage and a speed cut, then goes on cooldown", () => {
    const bite = trySnap(createSnap(), attacker, near, createEffects());
    expect(bite.started).toBe(true);
    expect(bite.hit).toBe(true);
    expect(bite.damage).toBe(damageRules.snap);
    expect(bite.target.speed).toBeLessThan(near.speed);
    expect(bite.state.cooldownRemaining).toBe(snapRules.cooldown);
  });

  it("still goes on cooldown when it misses", () => {
    const bite = trySnap(createSnap(), attacker, far, createEffects());
    expect(bite).toMatchObject({ started: true, hit: false, damage: 0 });
    expect(bite.state.cooldownRemaining).toBe(snapRules.cooldown);
    expect(bite.target.speed).toBe(far.speed);
  });

  it("cannot snap again until the cooldown ends", () => {
    const first = trySnap(createSnap(), attacker, near, createEffects()).state;
    const early = trySnap(first, attacker, near, createEffects());
    expect(early.started).toBe(false);
    const ready = stepSnap({ cooldownRemaining: 0.01, lungeRemaining: 0 }, 0.05);
    expect(trySnap(ready, attacker, near, createEffects()).started).toBe(true);
  });

  it("is stopped by a live Shell Guard, which is then spent", () => {
    const guarded = beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout.effects;
    const bite = trySnap(createSnap(), attacker, near, guarded);
    expect(bite).toMatchObject({ started: true, hit: false, blocked: true, damage: 0 });
    expect(bite.targetEffects.shieldCharges).toBe(0);
    expect(bite.target.speed).toBe(near.speed);
  });

  it("lunges out and back over the lunge time", () => {
    const start = trySnap(createSnap(), attacker, far, createEffects()).state;
    expect(lungeExtension(createSnap())).toBe(0);
    // stepSnap limits one step to 0.05s, so walk through the lunge in small slices.
    const advance = (state: typeof start, seconds: number) => {
      let next = state;
      for (let t = 0; t < seconds - 1e-9; t += 0.01) next = stepSnap(next, 0.01);
      return next;
    };
    expect(lungeExtension(advance(start, snapRules.lungeDuration / 2))).toBeCloseTo(snapRules.lungeDistance, 1);
    expect(lungeExtension(advance(start, snapRules.lungeDuration + 0.02))).toBe(0);
  });
});
