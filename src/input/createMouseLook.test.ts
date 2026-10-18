import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controlSettings } from "./controlSettings";
import { createMouseLook, type MouseLook } from "./createMouseLook";

/** Exercise the real event listeners without adding a DOM dependency. */
class TestCanvas extends EventTarget {
  focus = vi.fn();
  captured = new Set<number>();
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
}

function pointer(target: EventTarget, type: string, values: Partial<PointerEvent> = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, button: 0, buttons: 1, clientX: 100, clientY: 100,
    // Firefox/trackpad look must also work without relative movement readings.
    movementX: 0, movementY: 0,
    ...values,
  });
  target.dispatchEvent(event);
  return event;
}

describe("mouse and trackpad camera dragging", () => {
  let canvas: TestCanvas;
  let target: EventTarget;
  let mouse: MouseLook;

  beforeEach(() => {
    target = new EventTarget();
    vi.stubGlobal("window", target);
    canvas = new TestCanvas();
    mouse = createMouseLook(canvas as unknown as HTMLCanvasElement);
  });

  afterEach(() => {
    mouse.dispose();
    vi.unstubAllGlobals();
  });

  it.each([0, 2])("turns horizontally and vertically with button %i", (button) => {
    const buttons = button === 0 ? 1 : 2;
    const down = pointer(canvas, "pointerdown", { button, buttons });
    expect(down.defaultPrevented).toBe(true);
    expect(canvas.focus).toHaveBeenCalledOnce();
    expect(canvas.hasPointerCapture(1)).toBe(true);
    pointer(target, "pointermove", { buttons, clientX: 120, clientY: 90 });
    const delta = mouse.consume();
    expect(delta.yawDelta).toBeCloseTo(-20 * controlSettings.mouseYawSensitivity);
    expect(delta.pitchDelta).toBeCloseTo(-10 * controlSettings.mousePitchSensitivity);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
    expect(mouse.shooting).toBe(button === 0);
  });

  it("preserves a quick drag between frames, then stops on release outside the canvas", () => {
    pointer(canvas, "pointerdown");
    pointer(target, "pointermove", { clientX: 110 });
    pointer(target, "pointerup", { buttons: 0 });
    expect(mouse.consume().yawDelta).toBeCloseTo(-10 * controlSettings.mouseYawSensitivity);
    expect(mouse.shooting).toBe(false);
    expect(canvas.hasPointerCapture(1)).toBe(false);
    pointer(target, "pointermove", { buttons: 0, clientX: 130 });
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });

  it.each(["pointercancel", "lostpointercapture"])("stops looking and shooting after %s", (type) => {
    pointer(canvas, "pointerdown");
    pointer(type === "lostpointercapture" ? canvas : target, type);
    pointer(target, "pointermove", { clientX: 120 });
    expect(mouse.pointerLocked).toBe(false);
    expect(mouse.shooting).toBe(false);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });

  it("clears held buttons and pending camera movement when the window loses focus", () => {
    pointer(canvas, "pointerdown");
    pointer(target, "pointermove", { clientX: 120 });
    target.dispatchEvent(new Event("blur"));
    expect(mouse.pointerLocked).toBe(false);
    expect(mouse.shooting).toBe(false);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });

  it("ignores hovering, middle clicks and unrelated pointers", () => {
    pointer(target, "pointermove", { buttons: 0, clientX: 120 });
    pointer(canvas, "pointerdown", { button: 1, buttons: 4 });
    pointer(target, "pointermove", { buttons: 4, clientX: 140 });
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
    pointer(canvas, "pointerdown");
    pointer(target, "pointermove", { pointerId: 2, clientX: 150 });
    pointer(target, "pointerup", { pointerId: 2, buttons: 0 });
    expect(mouse.pointerLocked).toBe(true);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });

  it("recovers when a pointer-up was missed", () => {
    pointer(canvas, "pointerdown");
    pointer(target, "pointermove", { buttons: 0, clientX: 140 });
    expect(mouse.pointerLocked).toBe(false);
    expect(mouse.shooting).toBe(false);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });

  it("removes its listeners and capture when disposed", () => {
    pointer(canvas, "pointerdown");
    mouse.dispose();
    pointer(canvas, "pointerdown");
    pointer(target, "pointermove", { clientX: 120 });
    expect(canvas.hasPointerCapture(1)).toBe(false);
    expect(mouse.shooting).toBe(false);
    expect(mouse.consume()).toEqual({ yawDelta: 0, pitchDelta: 0 });
  });
});
