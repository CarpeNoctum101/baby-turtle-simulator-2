import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { createFollowCamera, updateFollowCamera } from "../camera/createThirdPersonCamera";
import { formatHud } from "../hud/formatHud";
import { combineMovement } from "../input/combineControls";
import { controlSettings, setStickDeadZone } from "../input/controlSettings";
import { createKeyboardState } from "../input/createKeyboardState";
import { createMouseLook } from "../input/createMouseLook";
import { readKeyboard } from "../input/keyboard";
import { pollGamepads } from "../input/pollGamepads";
import { lookSource, stepLook, type LookOffsets } from "../input/stepLook";
import { isInFinishZone, surfaceAt } from "../movement/course";
import { createTurtleMotion, stepTurtle, type TurtleMotion } from "../movement/stepTurtle";
import { createBeachScene } from "../scene/createBeachScene";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createDetailedTurtle } from "../turtle/createDetailedTurtle";
import { createEndingState, sampleEnding, stepEnding, type EndingState } from "./endingState";
import { createSpaceEnding } from "../scene/ending/createSpaceEnding";

export interface RunningGame {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

/** Builds the beach, then crawls the turtle from the inputs each frame. */
export function startGame(canvas: HTMLCanvasElement, hud: HTMLElement, hudToggle: HTMLButtonElement, beachPreview = false): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine, beachPreview);
  const turtle = beachPreview ? createDetailedTurtle(scene) : createPlaceholderTurtle(scene);
  const camera = createFollowCamera(scene, turtle.root);
  const spaceEnding = createSpaceEnding(scene, turtle);
  // Frame the asset study on entry; the normal course and camera controls are unchanged.
  const initialLook: LookOffsets = beachPreview ? { yaw: 0.35, pitch: 0.22 } : { yaw: 0, pitch: 0 };
  if (beachPreview) {
    camera.radius = camera.camera.radius = 9;
    camera.camera.alpha += initialLook.yaw;
    camera.camera.beta += initialLook.pitch;
  }
  const keyboard = createKeyboardState(window);
  const mouse = createMouseLook(canvas);

  let motion = createTurtleMotion();
  let look: LookOffsets = { ...initialLook };
  const animation: TurtleAnimation = { phase: 0 };
  let finished = false;
  let ending: EndingState | null = null;
  let hudVisible = !beachPreview;
  const heldEdges = new Set<string>();

  const setHudVisible = (visible: boolean) => {
    hudVisible = visible;
    hud.hidden = !visible;
    hudToggle.textContent = visible ? "Hide readout" : "Show readout";
    hudToggle.setAttribute("aria-expanded", String(visible));
  };
  const onToggleHud = () => {
    setHudVisible(!hudVisible);
  };
  hudToggle.addEventListener("click", onToggleHud);
  setHudVisible(hudVisible);

  const placeTurtle = (next: TurtleMotion) => {
    turtle.root.position.set(next.x, 0, next.z);
    turtle.root.rotation.y = next.heading;
  };
  placeTurtle(motion);

  const pressedOnce = (code: string) => {
    if (!keyboard.keys.has(code)) {
      heldEdges.delete(code);
      return false;
    }
    if (heldEdges.has(code)) {
      return false;
    }
    heldEdges.add(code);
    return true;
  };

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;
    if (pressedOnce("BracketLeft")) {
      setStickDeadZone(controlSettings.stickDeadZone - 0.01);
    }
    if (pressedOnce("BracketRight")) {
      setStickDeadZone(controlSettings.stickDeadZone + 0.01);
    }
    if (pressedOnce("KeyH")) {
      setHudVisible(!hudVisible);
    }

    const gamepad = pollGamepads(controlSettings.stickDeadZone);
    const movement = combineMovement(readKeyboard(keyboard.keys), gamepad);
    if (pressedOnce("KeyR")) {
      spaceEnding.reset();
      ending = null;
      motion = createTurtleMotion();
      look = { ...initialLook };
      finished = false;
      animation.phase = 0;
      setHudVisible(!beachPreview);
      mouse.consume();
    } else if (ending) {
      ending = stepEnding(ending, dt);
      // Discard look deltas while the cinematic owns the camera.
      mouse.consume();
    } else {
      motion = stepTurtle(motion, movement, dt);
      if (!finished && isInFinishZone(motion.x, motion.z)) {
        finished = true;
        ending = createEndingState(motion);
        spaceEnding.begin();
        setHudVisible(false);
      }
      look = stepLook(look, mouse.consume(), { x: gamepad.lookX, y: gamepad.lookY }, dt);
    }

    const endingFrame = ending ? sampleEnding(ending) : null;
    if (endingFrame) {
      spaceEnding.update(endingFrame, dt);
    } else {
      placeTurtle(motion);
      updateFollowCamera(camera, motion.heading, look, dt);
    }
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, endingFrame?.speed ?? motion.speed, dt);
    if (endingFrame?.phase === "boarding") {
      // Fold the broad paddles back so the turtle fits through the hatch.
      const tuck = Math.min(1, endingFrame.phaseTime / 0.5);
      for (const flipper of turtle.flippers) {
        flipper.mesh.rotation.y = flipper.baseY + (flipper.side * 1.4 - flipper.baseY) * tuck;
        flipper.mesh.rotation.z *= 1 - tuck;
      }
    }
    hud.textContent = formatHud({
      finished,
      surfaceLabel: surfaceAt(motion.z).label,
      speed: motion.speed,
      x: motion.x,
      z: motion.z,
      movementSource: movement.source,
      lookSource: lookSource(gamepad.lookX, gamepad.lookY),
      pointerLocked: mouse.pointerLocked,
      deadZone: controlSettings.stickDeadZone,
      gamepad,
    });
    scene.render();
  });

  const onResize = () => {
    engine.resize();
  };
  window.addEventListener("resize", onResize);

  return {
    engine,
    scene,
    dispose() {
      window.removeEventListener("resize", onResize);
      hudToggle.removeEventListener("click", onToggleHud);
      keyboard.dispose();
      mouse.dispose();
      spaceEnding.dispose();
      camera.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
