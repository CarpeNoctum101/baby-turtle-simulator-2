export interface SamplePose {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface RemoteSample {
  from: SamplePose;
  to: SamplePose;
  elapsed: number;
  duration: number;
}

const blendSeconds = 0.1;

/** Starts a remote hatchling already standing on the latest pose. */
export function createRemoteSample(pose: SamplePose): RemoteSample {
  return { from: pose, to: pose, elapsed: blendSeconds, duration: blendSeconds };
}

/**
 * Blends from where the mesh is now toward the pose that just arrived.
 * Remote turtles are drawn a little behind their latest message so the crawl looks steady.
 */
export function pushRemoteSample(rendered: SamplePose, pose: SamplePose): RemoteSample {
  return { from: rendered, to: pose, elapsed: 0, duration: blendSeconds };
}

export function stepRemoteSample(sample: RemoteSample, dt: number): { sample: RemoteSample; pose: SamplePose } {
  const elapsed = sample.elapsed + Math.max(0, dt);
  const t = sample.duration <= 0 ? 1 : Math.min(1, elapsed / sample.duration);
  return {
    sample: { ...sample, elapsed },
    pose: {
      x: sample.from.x + (sample.to.x - sample.from.x) * t,
      z: sample.from.z + (sample.to.z - sample.from.z) * t,
      heading: lerpAngle(sample.from.heading, sample.to.heading, t),
      speed: sample.to.speed,
    },
  };
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}
