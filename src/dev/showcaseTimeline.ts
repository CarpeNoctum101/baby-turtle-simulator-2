/** Directed shots of the actual game scene; durations can be retimed once song audio is supplied. */
export const showcaseShots = [
  { id: "hero", label: "Fixed three-quarter portrait", duration: 2.4, movingCamera: false },
  { id: "eyes", label: "Fixed eye detail", duration: 1.6, movingCamera: false },
  { id: "shell", label: "Fixed shell detail", duration: 1.2, movingCamera: false },
  { id: "orbit", label: "Low orbit reveal", duration: 3.2, movingCamera: true },
  { id: "pass", label: "Fixed camera crawl past", duration: 2.4, movingCamera: false },
  { id: "chase", label: "Low chase with speed ramp", duration: 3.2, movingCamera: true },
  { id: "side", label: "Side tracking shot", duration: 2.6, movingCamera: true },
  { id: "overhead", label: "Fixed overhead race shot", duration: 2, movingCamera: false },
  { id: "item", label: "Fixed spinning item detail", duration: 1.5, movingCamera: false },
  { id: "shore", label: "Shoreline tracking pass", duration: 3, movingCamera: true },
  { id: "reveal", label: "Fixed rocket reveal", duration: 2.8, movingCamera: false },
  { id: "launch", label: "Launch tracking shot", duration: 3, movingCamera: true },
  { id: "orbit-end", label: "Orbital hero and title", duration: 3.1, movingCamera: true },
] as const;

export const showcaseDuration = showcaseShots.reduce((total, shot) => total + shot.duration, 0);

export function sampleShowcase(seconds: number) {
  const time = Math.min(showcaseDuration - 0.000001, Math.max(0, seconds));
  let start = 0;
  for (const [index, shot] of showcaseShots.entries()) {
    if (time < start + shot.duration) {
      return { ...shot, index, local: time - start, progress: (time - start) / shot.duration };
    }
    start += shot.duration;
  }
  throw new Error("The showcase needs at least one shot.");
}
