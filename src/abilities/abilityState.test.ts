import { describe, expect, it } from "vitest";
import { createTurtleMotion } from "../movement/stepTurtle";
import {
  absorbHit,
  applyCollisionPenalty,
  applySandSlow,
  beginAbility,
  createEffects,
  createLoadout,
  holdAbility,
  isTrailVisible,
  resolveWaveWindow,
  speedModifiers,
  stepEffects,
  stepLoadout,
} from "./abilityState";
import { abilityCatalog, frenzyRules, sandRules, waveRules } from "./catalog";

const frame = 1 / 60;

function advance(effects: ReturnType<typeof createEffects>, seconds: number) {
  let current = effects;
  const steps = Math.round(seconds / frame);
  for (let step = 0; step < steps; step += 1) {
    current = stepEffects(current, frame);
  }
  return current;
}

describe("flipper frenzy", () => {
  it("raises the speed cap only while its duration is left", () => {
    const started = beginAbility(holdAbility(createLoadout(), "flipper-frenzy"), "flipper-frenzy");
    expect(started.started).toBe(true);
    expect(started.loadout.held).toBeNull();
    expect(speedModifiers(started.loadout.effects).maxSpeedMultiplier).toBe(frenzyRules.maxSpeedMultiplier);

    const midway = advance(started.loadout.effects, 1);
    expect(midway.frenzyRemaining).toBeGreaterThan(1);
    expect(speedModifiers(midway).maxSpeedMultiplier).toBe(frenzyRules.maxSpeedMultiplier);

    const expired = advance(started.loadout.effects, abilityCatalog["flipper-frenzy"].duration + 0.05);
    expect(expired.frenzyRemaining).toBe(0);
    expect(speedModifiers(expired).maxSpeedMultiplier).toBe(1);
    expect(speedModifiers(expired).accelerationMultiplier).toBe(1);
  });

  it("does not spend the whole boost on one long frame", () => {
    const started = beginAbility(holdAbility(createLoadout(), "flipper-frenzy"), "flipper-frenzy").loadout;
    const jumped = stepLoadout(started, 10);
    expect(jumped.effects.frenzyRemaining).toBeGreaterThan(abilityCatalog["flipper-frenzy"].duration - 0.1);
  });

  it("drops the boost as soon as the race loadout is created again", () => {
    const racing = beginAbility(holdAbility(createLoadout(), "flipper-frenzy"), "flipper-frenzy").loadout;
    expect(racing.effects.frenzyRemaining).toBeGreaterThan(0);
    const restarted = createLoadout();
    expect(restarted.effects.frenzyRemaining).toBe(0);
    expect(restarted.held).toBeNull();
    expect(speedModifiers(restarted.effects).maxSpeedMultiplier).toBe(1);
  });
});

describe("shell guard", () => {
  function shielded() {
    return beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout.effects;
  }

  it("blocks exactly one ability hit and then lets the next one through", () => {
    const first = applySandSlow(shielded());
    const second = applySandSlow(first.effects);
    expect(first.blocked).toBe(true);
    expect(first.effects.shieldCharges).toBe(0);
    expect(first.effects.slowRemaining).toBe(0);
    expect(second.blocked).toBe(false);
    expect(second.effects.slowRemaining).toBe(sandRules.slowDuration);
  });

  it("blocks exactly one collision and does not spend a charge on the ground itself", () => {
    const moving = { ...createTurtleMotion(), speed: 4 };
    const environment = absorbHit(shielded(), "environment");
    const firstBump = applyCollisionPenalty(moving, environment.effects);
    const secondBump = applyCollisionPenalty(firstBump.motion, firstBump.effects);

    expect(environment.blocked).toBe(false);
    expect(environment.effects.shieldCharges).toBe(1);
    expect(firstBump.blocked).toBe(true);
    expect(firstBump.motion.speed).toBe(4);
    expect(firstBump.effects.shieldCharges).toBe(0);
    expect(secondBump.blocked).toBe(false);
    expect(secondBump.motion.speed).toBeCloseTo(4 * 0.45);
  });

  it("drops an unused shell when the duration ends", () => {
    const expired = advance(shielded(), abilityCatalog["shell-guard"].duration + 0.05);
    const hit = applySandSlow(expired);
    expect(expired.shieldCharges).toBe(0);
    expect(hit.blocked).toBe(false);
    expect(hit.effects.slowRemaining).toBe(sandRules.slowDuration);
  });

  it("refreshes to one charge instead of stacking two", () => {
    const first = beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout;
    const again = beginAbility(holdAbility(first, "shell-guard"), "shell-guard").loadout;
    expect(again.effects.shieldCharges).toBe(1);
  });
});

describe("activation rules", () => {
  it("keeps the next stored ability until the one already running has finished", () => {
    expect(beginAbility(createLoadout(), "flipper-frenzy").started).toBe(false);
    const spent = beginAbility(holdAbility(createLoadout(), "sand-spray"), "sand-spray").loadout;
    const blocked = beginAbility(holdAbility(spent, "flipper-frenzy"), "flipper-frenzy");
    expect(spent.effects.sprayRemaining).toBe(abilityCatalog["sand-spray"].duration);
    expect(blocked.started).toBe(false);
    expect(blocked.loadout.held).toBe("flipper-frenzy");
    expect(blocked.loadout.effects.frenzyRemaining).toBe(0);

    const finished = advance(blocked.loadout.effects, abilityCatalog["sand-spray"].duration + 0.05);
    const next = beginAbility({ ...blocked.loadout, effects: finished }, "flipper-frenzy");
    expect(finished.sprayRemaining).toBe(0);
    expect(next.started).toBe(true);
    expect(next.loadout.effects.frenzyRemaining).toBe(abilityCatalog["flipper-frenzy"].duration);
  });

  it("lets a sand slow end without clearing a different effect", () => {
    const frenzy = beginAbility(holdAbility(createLoadout(), "flipper-frenzy"), "flipper-frenzy").loadout.effects;
    const slowed = applySandSlow(frenzy).effects;
    const recovered = advance(slowed, sandRules.slowDuration + 0.05);
    expect(recovered.slowRemaining).toBe(0);
    expect(recovered.frenzyRemaining).toBeGreaterThan(0);
    expect(speedModifiers(recovered).maxSpeedMultiplier).toBe(frenzyRules.maxSpeedMultiplier);
  });
});

describe("wave rider and magnetic sense clocks", () => {
  it("grants the boost only while the timing window overlaps the wave zone", () => {
    const armed = beginAbility(holdAbility(createLoadout(), "wave-rider"), "wave-rider").loadout.effects;
    const outside = resolveWaveWindow(armed, false);
    const inside = resolveWaveWindow(armed, true);
    const late = resolveWaveWindow(advance(armed, abilityCatalog["wave-rider"].duration + 0.05), true);
    expect(outside.triggered).toBe(false);
    expect(outside.effects.waveBoostRemaining).toBe(0);
    expect(inside.triggered).toBe(true);
    expect(inside.effects.waveWindowRemaining).toBe(0);
    expect(inside.effects.waveBoostRemaining).toBe(waveRules.boostDuration);
    expect(speedModifiers(inside.effects).maxSpeedMultiplier).toBe(waveRules.maxSpeedMultiplier);
    expect(late.triggered).toBe(false);
    expect(late.effects.waveBoostRemaining).toBe(0);
  });

  it("ends the wave boost and hides the trail when their timers run out or the race restarts", () => {
    const boosted = resolveWaveWindow(
      beginAbility(holdAbility(createLoadout(), "wave-rider"), "wave-rider").loadout.effects,
      true,
    ).effects;
    const trail = beginAbility(holdAbility(createLoadout(), "magnetic-sense"), "magnetic-sense").loadout.effects;
    expect(isTrailVisible(trail)).toBe(true);
    const faded = advance(trail, abilityCatalog["magnetic-sense"].duration + 0.05);
    const boostOver = advance(boosted, waveRules.boostDuration + 0.05);
    expect(isTrailVisible(faded)).toBe(false);
    expect(boostOver.waveBoostRemaining).toBe(0);
    expect(speedModifiers(boostOver).maxSpeedMultiplier).toBe(1);
    expect(isTrailVisible(createLoadout().effects)).toBe(false);
    expect(createLoadout().effects.waveBoostRemaining).toBe(0);
    expect(createLoadout().effects.waveWindowRemaining).toBe(0);
  });
});
