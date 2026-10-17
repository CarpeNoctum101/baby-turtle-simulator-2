import { describe, expect, it } from "vitest";
import { beginAbility, createEffects, createLoadout, holdAbility, resolveWaveWindow } from "../abilities/abilityState";
import { abilityCatalog } from "../abilities/catalog";
import { formatAbilityHud, formatAbilityLine, formatPlace } from "./formatAbilityHud";

const quiet = {
  held: null,
  effects: createEffects(),
};

describe("ability HUD", () => {
  it("leaves the item box empty until a Tide Orb is stored", () => {
    const view = formatAbilityHud(quiet);
    expect(view.stored).toBeNull();
    expect(view.timer).toBeNull();
    expect(formatAbilityLine(view)).toBe("Item box: empty");
  });

  it("stores the next ability in the box without a timer", () => {
    const view = formatAbilityHud({ ...quiet, held: "sand-spray" });
    expect(view.stored).toBe("sand-spray");
    expect(view.timer).toBeNull();
    expect(formatAbilityLine(view)).toBe("Item box: Sand Spray");
  });

  it("times only the effect that is already running", () => {
    const frenzy = beginAbility(holdAbility(createLoadout(), "flipper-frenzy"), "flipper-frenzy").loadout;
    const view = formatAbilityHud({
      ...quiet,
      held: "shell-guard",
      effects: frenzy.effects,
    });
    expect(view.stored).toBe("shell-guard");
    expect(view.timer?.label).toContain("Flipper Frenzy");
    expect(view.timer?.label).toContain("s");
    expect(view.timer?.label).not.toContain("Shell Guard");
    expect(view.timer?.label).not.toContain("ready");
    expect(view.timer?.meter).toBeCloseTo(1);
    expect(view.timer?.tone).toBe("active");
  });

  it("shows the shell and sand durations on their own bars", () => {
    const shell = beginAbility(holdAbility(createLoadout(), "shell-guard"), "shell-guard").loadout;
    const view = formatAbilityHud({ ...quiet, effects: shell.effects, held: "flipper-frenzy" });
    const spray = formatAbilityHud({
      ...quiet,
      effects: { ...createEffects(), sprayRemaining: abilityCatalog["sand-spray"].duration / 2 },
    });
    expect(view.stored).toBe("flipper-frenzy");
    expect(view.timer?.label).toContain("Shell Guard");
    expect(view.timer?.tone).toBe("shield");
    expect(spray.stored).toBeNull();
    expect(spray.timer?.label).toContain("Sand Spray");
    expect(spray.timer?.meter).toBeCloseTo(0.5);
    expect(spray.timer?.tone).toBe("spray");
  });

  it("shows the wave window, the boost, and the trail timer", () => {
    const armed = beginAbility(holdAbility(createLoadout(), "wave-rider"), "wave-rider").loadout;
    const boosted = resolveWaveWindow(armed.effects, true).effects;
    const trail = beginAbility(holdAbility(createLoadout(), "magnetic-sense"), "magnetic-sense").loadout;
    const windowView = formatAbilityHud({ ...quiet, effects: armed.effects });
    const boostView = formatAbilityHud({ ...quiet, effects: boosted });
    const trailView = formatAbilityHud({ ...quiet, effects: trail.effects });
    expect(windowView.timer?.label).toContain("Enter the waves");
    expect(windowView.timer?.tone).toBe("wave");
    expect(boostView.timer?.label).toContain("Wave boost");
    expect(trailView.timer?.label).toContain("Magnetic Sense");
    expect(trailView.timer?.tone).toBe("trail");
    expect(trailView.timer?.meter).toBeCloseTo(1);
  });

  it("formats the race place", () => {
    expect(formatPlace(1, 2)).toBe("1st of 2");
    expect(formatPlace(2, 2)).toBe("2nd of 2");
  });
});
