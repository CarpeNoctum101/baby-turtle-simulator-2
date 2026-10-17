export type RacePhase = "ready" | "countdown" | "racing" | "finished";

export interface RaceState {
  phase: RacePhase;
  /** Seconds left before the crawl is allowed. */
  countdown: number;
  /** Seconds since "Go", including the finishing frame. */
  elapsed: number;
  finishTime: number | null;
  /** How long the "Go!" banner stays up after the countdown. */
  goBanner: number;
}

const countdownLength = 3;
const goBannerLength = 0.8;

export function createRaceState(): RaceState {
  return {
    phase: "ready",
    countdown: countdownLength,
    elapsed: 0,
    finishTime: null,
    goBanner: 0,
  };
}

/** Puts the turtle back on the starting grid and begins 3, 2, 1. */
export function startCountdown(state: RaceState = createRaceState()): RaceState {
  return {
    ...state,
    phase: "countdown",
    countdown: countdownLength,
    elapsed: 0,
    finishTime: null,
    goBanner: 0,
  };
}

export function canDrive(phase: RacePhase): boolean {
  return phase === "racing";
}

/**
 * Advances the race clock. A finish is recorded once, the first frame the turtle
 * is in the ocean zone while the race is running. Later frames keep that time.
 */
export function stepRace(state: RaceState, dt: number, reachedFinish: boolean): RaceState {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  if (state.phase === "countdown") {
    const countdown = state.countdown - safeDt;
    if (countdown > 0) {
      return { ...state, countdown };
    }
    return {
      phase: "racing",
      countdown: 0,
      elapsed: 0,
      finishTime: null,
      goBanner: goBannerLength,
    };
  }

  if (state.phase !== "racing") {
    return state;
  }

  const elapsed = state.elapsed + safeDt;
  if (reachedFinish) {
    return {
      phase: "finished",
      countdown: 0,
      elapsed,
      finishTime: elapsed,
      goBanner: 0,
    };
  }

  return {
    ...state,
    elapsed,
    goBanner: Math.max(0, state.goBanner - safeDt),
  };
}

export function countdownLabel(state: RaceState): string | null {
  if (state.phase === "countdown") {
    return String(Math.ceil(state.countdown));
  }
  if (state.goBanner > 0) {
    return "Go!";
  }
  return null;
}

export function formatRaceTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  const wholeSeconds = Math.floor(remainder);
  const tenths = Math.floor((remainder - wholeSeconds) * 10);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${tenths}`;
}
