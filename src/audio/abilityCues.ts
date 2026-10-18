import type { AbilityCue } from "../abilities/stepAbilityWorld";

export interface AbilityCues {
  unlock: () => void;
  play: (cue: AbilityCue) => void;
  dispose: () => void;
}

/** Short synthesized cues. The game does not download audio files. */
export function createAbilityCues(): AbilityCues {
  let context: AudioContext | null = null;

  const audio = (): AudioContext | null => {
    if (context) {
      return context;
    }
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    context = new AudioContextClass();
    return context;
  };

  return {
    unlock() {
      const ctx = audio();
      if (ctx?.state === "suspended") {
        void ctx.resume();
      }
    },
    play(cue) {
      const ctx = audio();
      if (!ctx || ctx.state !== "running") {
        return;
      }
      playCue(ctx, cue);
    },
    dispose() {
      void context?.close();
      context = null;
    },
  };
}

function playCue(ctx: AudioContext, cue: AbilityCue): void {
  const now = ctx.currentTime;
  if (cue === "net-catch") {
    noise(ctx, now, 0.13);
    tone(ctx, 180, now, 0.16, "triangle", 0.04);
    return;
  }
  if (cue === "pickup") {
    tone(ctx, 520, now, 0.08, "sine", 0.06);
    tone(ctx, 780, now + 0.09, 0.12, "sine", 0.06);
    return;
  }
  if (cue === "frenzy") {
    tone(ctx, 180, now, 0.16, "square", 0.03);
    tone(ctx, 280, now + 0.04, 0.14, "square", 0.02);
    return;
  }
  if (cue === "shield") {
    tone(ctx, 440, now, 0.16, "sine", 0.05);
    tone(ctx, 660, now + 0.08, 0.14, "triangle", 0.04);
    return;
  }
  if (cue === "block") {
    tone(ctx, 880, now, 0.07, "triangle", 0.06);
    tone(ctx, 1320, now + 0.06, 0.1, "sine", 0.05);
    return;
  }
  if (cue === "spray") {
    noise(ctx, now, 0.18);
    return;
  }
  if (cue === "bump") {
    tone(ctx, 90, now, 0.12, "sawtooth", 0.04);
    return;
  }
  if (cue === "wave-arm") {
    tone(ctx, 420, now, 0.1, "sine", 0.05);
    return;
  }
  if (cue === "wave-boost") {
    tone(ctx, 523, now, 0.1, "triangle", 0.05);
    tone(ctx, 659, now + 0.08, 0.1, "triangle", 0.05);
    tone(ctx, 784, now + 0.16, 0.14, "sine", 0.05);
    return;
  }
  if (cue === "wave-miss") {
    tone(ctx, 196, now, 0.12, "sine", 0.04);
    return;
  }
  if (cue === "gull-hit") {
    tone(ctx, 1400, now, 0.08, "sawtooth", 0.05);
    tone(ctx, 900, now + 0.07, 0.12, "sawtooth", 0.05);
    return;
  }
  if (cue === "gull-swoop") {
    tone(ctx, 1100, now, 0.1, "sawtooth", 0.04);
    tone(ctx, 1500, now + 0.09, 0.14, "sawtooth", 0.04);
    tone(ctx, 1000, now + 0.22, 0.18, "sawtooth", 0.04);
    return;
  }
  if (cue === "slam") {
    tone(ctx, 70, now, 0.2, "sawtooth", 0.07);
    return;
  }
  if (cue === "slam-hit") {
    tone(ctx, 110, now, 0.1, "square", 0.07);
    tone(ctx, 55, now + 0.05, 0.18, "sawtooth", 0.07);
    return;
  }
  if (cue === "spin") {
    tone(ctx, 300, now, 0.1, "triangle", 0.05);
    tone(ctx, 600, now + 0.08, 0.14, "triangle", 0.05);
    tone(ctx, 900, now + 0.16, 0.16, "triangle", 0.04);
    return;
  }
  if (cue === "snap") {
    tone(ctx, 300, now, 0.05, "square", 0.04);
    return;
  }
  if (cue === "snap-hit") {
    tone(ctx, 140, now, 0.1, "sawtooth", 0.06);
    return;
  }
  if (cue === "bubble") {
    tone(ctx, 620, now, 0.08, "sine", 0.05);
    tone(ctx, 880, now + 0.05, 0.1, "sine", 0.04);
    return;
  }
  if (cue === "bubble-trap") {
    tone(ctx, 480, now, 0.12, "triangle", 0.05);
    tone(ctx, 360, now + 0.08, 0.16, "sine", 0.04);
    return;
  }
  tone(ctx, 660, now, 0.08, "sine", 0.04);
  tone(ctx, 880, now + 0.1, 0.12, "sine", 0.03);
}

function tone(
  ctx: AudioContext,
  frequency: number,
  when: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function noise(ctx: AudioContext, when: number, duration: number): void {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, when);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(when);
  source.stop(when + duration + 0.02);
}
