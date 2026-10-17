import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { createFollowCamera, resetFollowCamera, updateFollowCamera } from "../camera/createThirdPersonCamera";
import { formatHud } from "../hud/formatHud";
import { combineMovement } from "../input/combineControls";
import { controlSettings, setStickDeadZone } from "../input/controlSettings";
import { createKeyboardState } from "../input/createKeyboardState";
import { createMouseLook } from "../input/createMouseLook";
import { readKeyboard } from "../input/keyboard";
import { pollGamepads } from "../input/pollGamepads";
import { lookSource, stepLook, type LookOffsets } from "../input/stepLook";
import { isInFinishZone, surfaceAt } from "../movement/course";
import { createTurtleMotion, planFromYaw, stepTurtle, type DriveInput, type TurtleMotion } from "../movement/stepTurtle";
import { canDrive, countdownLabel, createRaceState, formatRaceTime, startCountdown, stepRace, type RaceState } from "../race/raceState";
import { createBeachScene } from "../scene/createBeachScene";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";

export interface GameUi {
  hud: HTMLElement;
  hudToggle: HTMLButtonElement;
  startScreen: HTMLElement;
  startButton: HTMLButtonElement;
  countdown: HTMLElement;
  raceTimer: HTMLElement;
  results: HTMLElement;
  resultsTime: HTMLElement;
  rematchButton: HTMLButtonElement;
}

export interface RunningGame {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

const idleDrive: DriveInput = { throttle: 0, steer: 0, brake: false };

/**
 * Builds the beach once, then runs a single draw loop.
 * Starting again resets the turtle and the clock. It does not create another scene.
 */
export function startGame(canvas: HTMLCanvasElement, ui: GameUi): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine);
  const turtle = createPlaceholderTurtle(scene);
  const camera = createFollowCamera(scene);
  const keyboard = createKeyboardState(window);
  const mouse = createMouseLook(canvas);

  let motion = createTurtleMotion();
  let look: LookOffsets = { yaw: 0, pitch: 0 };
  let race = createRaceState();
  const animation: TurtleAnimation = { phase: 0 };
  let hudVisible = true;
  const heldEdges = new Set<string>();

  const placeTurtle = (next: TurtleMotion) => {
    turtle.root.position.set(next.x, 0, next.z);
    turtle.root.rotation.y = next.heading;
  };
  placeTurtle(motion);

  const restartRace = () => {
    motion = createTurtleMotion();
    look = { yaw: 0, pitch: 0 };
    resetFollowCamera(camera);
    race = startCountdown(race);
    placeTurtle(motion);
    canvas.focus();
  };
  const beginFromMenu = () => {
    if (race.phase !== "ready" && race.phase !== "finished") {
      return;
    }
    restartRace();
  };

  ui.startButton.addEventListener("click", beginFromMenu);
  ui.rematchButton.addEventListener("click", beginFromMenu);

  const setHudVisible = (visible: boolean) => {
    hudVisible = visible;
    ui.hud.hidden = !visible;
    ui.hudToggle.textContent = visible ? "Hide readout" : "Show readout";
    ui.hudToggle.setAttribute("aria-expanded", String(visible));
  };
  const onToggleHud = () => {
    setHudVisible(!hudVisible);
  };
  ui.hudToggle.addEventListener("click", onToggleHud);

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
    if (pressedOnce("Enter")) {
      beginFromMenu();
    }
    if (pressedOnce("KeyR") && race.phase !== "ready") {
      restartRace();
    }

    const gamepad = pollGamepads(controlSettings.stickDeadZone);
    const movement = combineMovement(readKeyboard(keyboard.keys), gamepad);
    const drive = canDrive(race.phase) ? movement : idleDrive;
    look = stepLook(look, mouse.consume(), { x: gamepad.lookX, y: gamepad.lookY }, dt);
    if (race.phase === "racing" || race.phase === "countdown") {
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw));
    }
    const reachedFinish = race.phase === "racing" && isInFinishZone(motion.x, motion.z);
    race = stepRace(race, dt, reachedFinish);

    placeTurtle(motion);
    updateFollowCamera(camera, look, motion.x, motion.z);
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, canDrive(race.phase) ? motion.speed : 0, dt);
    syncRaceUi(ui, race, hudVisible);
    ui.hud.textContent = formatHud({
      phase: race.phase,
      elapsed: race.elapsed,
      finishTime: race.finishTime,
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
      ui.hudToggle.removeEventListener("click", onToggleHud);
      ui.startButton.removeEventListener("click", beginFromMenu);
      ui.rematchButton.removeEventListener("click", beginFromMenu);
      keyboard.dispose();
      mouse.dispose();
      camera.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}

function syncRaceUi(ui: GameUi, race: RaceState, hudVisible: boolean): void {
  const menuOpen = race.phase === "ready" || race.phase === "finished";
  ui.hud.hidden = menuOpen || !hudVisible;
  ui.hudToggle.hidden = menuOpen;
  ui.startScreen.hidden = race.phase !== "ready";
  ui.results.hidden = race.phase !== "finished";
  const label = countdownLabel(race);
  ui.countdown.hidden = label === null;
  if (label) {
    ui.countdown.textContent = label;
  }
  ui.raceTimer.hidden = race.phase !== "racing";
  if (race.phase === "racing") {
    ui.raceTimer.textContent = formatRaceTime(race.elapsed);
  }
  if (race.phase === "finished" && race.finishTime !== null) {
    ui.resultsTime.textContent = `Time ${formatRaceTime(race.finishTime)}`;
  }
}
