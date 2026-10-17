import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { isTrailVisible, speedModifiers } from "../abilities/abilityState";
import { abilityCatalog, raceAbilityPool } from "../abilities/catalog";
import { createAbilityFx } from "../abilities/renderAbilityFx";
import { stepAbilityWorld, createAbilityWorld, type AbilityWorld } from "../abilities/stepAbilityWorld";
import { createAbilityCues } from "../audio/abilityCues";
import { createFollowCamera, resetFollowCamera, updateFollowCamera } from "../camera/createThirdPersonCamera";
import { abilityIcon } from "../hud/abilityIcon";
import { formatAbilityHud, formatAbilityLine, formatPlace } from "../hud/formatAbilityHud";
import { formatHud } from "../hud/formatHud";
import { combineMovement } from "../input/combineControls";
import { controlSettings, setStickDeadZone } from "../input/controlSettings";
import { createKeyboardState } from "../input/createKeyboardState";
import { createMouseLook } from "../input/createMouseLook";
import { readKeyboard } from "../input/keyboard";
import { pollGamepads } from "../input/pollGamepads";
import { lookSource, stepLook, type LookOffsets } from "../input/stepLook";
import { isInFinishZone, isInWaveZone, surfaceAt } from "../movement/course";
import { createTurtleMotion, planFromYaw, stepTurtle, type DriveInput, type TurtleMotion } from "../movement/stepTurtle";
import { canDrive, countdownLabel, createRaceState, formatRaceTime, startCountdown, stepRace, type RaceState } from "../race/raceState";
import { createRivalMotion, raceStanding, stepRival } from "../race/stepRival";
import { createBeachScene } from "../scene/createBeachScene";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
<<<<<<< HEAD
import { createPlaceholderTurtle, type PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";

export interface GameUi {
  hud: HTMLElement;
  hudToggle: HTMLButtonElement;
  startScreen: HTMLElement;
  startButton: HTMLButtonElement;
  countdown: HTMLElement;
  raceTimer: HTMLElement;
  results: HTMLElement;
  resultsTime: HTMLElement;
  resultsPlace: HTMLElement;
  rematchButton: HTMLButtonElement;
  abilityHud: HTMLElement;
  abilitySlot: HTMLElement;
  abilityIcon: HTMLElement;
  abilityTimer: HTMLElement;
  abilityTimerLabel: HTMLElement;
  abilityMeterFill: HTMLElement;
}
=======
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createDetailedTurtle } from "../turtle/createDetailedTurtle";
import { createEndingState, sampleEnding, stepEnding, type EndingState } from "./endingState";
import { createSpaceEnding } from "../scene/ending/createSpaceEnding";
>>>>>>> graphics

export interface RunningGame {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

<<<<<<< HEAD
const idleDrive: DriveInput = { throttle: 0, steer: 0, brake: false };

/**
 * Builds the beach once, then runs a single draw loop.
 * Starting again resets the turtle, the rival, the orbs, and any ability that was still running.
 */
export function startGame(canvas: HTMLCanvasElement, ui: GameUi): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine);
  const turtle = createPlaceholderTurtle(scene);
  const rivalTurtle = createPlaceholderTurtle(scene, {
    id: "rival",
    skin: new Color3(0.55, 0.62, 0.4),
    shell: new Color3(0.25, 0.4, 0.48),
  });
  const camera = createFollowCamera(scene);
=======
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
>>>>>>> graphics
  const keyboard = createKeyboardState(window);
  const mouse = createMouseLook(canvas);
  const cues = createAbilityCues();
  const fx = createAbilityFx(scene, turtle.visual);

  let motion = createTurtleMotion();
<<<<<<< HEAD
  let rival = createRivalMotion(motion);
  let look: LookOffsets = { yaw: 0, pitch: 0 };
  let race = createRaceState();
  let world: AbilityWorld = createAbilityWorld();
  let abilityWasDown = false;
  let blockFlash = 0;
  let clock = 0;
  const animation: TurtleAnimation = { phase: 0 };
  const rivalAnimation: TurtleAnimation = { phase: 0 };
  let hudVisible = true;
=======
  let look: LookOffsets = { ...initialLook };
  const animation: TurtleAnimation = { phase: 0 };
  let finished = false;
  let ending: EndingState | null = null;
  let hudVisible = !beachPreview;
>>>>>>> graphics
  const heldEdges = new Set<string>();

  const placeTurtle = (body: PlaceholderTurtle, next: TurtleMotion) => {
    body.root.position.set(next.x, 0, next.z);
    body.root.rotation.y = next.heading;
  };
  placeTurtle(turtle, motion);
  placeTurtle(rivalTurtle, rival);

  const restartRace = () => {
    motion = createTurtleMotion();
    rival = createRivalMotion(motion);
    look = { yaw: 0, pitch: 0 };
    resetFollowCamera(camera);
    race = startCountdown(race);
    world = createAbilityWorld();
    blockFlash = 0;
    placeTurtle(turtle, motion);
    placeTurtle(rivalTurtle, rival);
    canvas.focus();
  };
  const beginFromMenu = () => {
    cues.unlock();
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
<<<<<<< HEAD
  ui.hudToggle.addEventListener("click", onToggleHud);
=======
  hudToggle.addEventListener("click", onToggleHud);
  setHudVisible(hudVisible);

  const placeTurtle = (next: TurtleMotion) => {
    turtle.root.position.set(next.x, 0, next.z);
    turtle.root.rotation.y = next.heading;
  };
  placeTurtle(motion);
>>>>>>> graphics

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
    clock += dt;
    blockFlash = Math.max(0, blockFlash - dt);
    if (keyboard.keys.size > 0) {
      cues.unlock();
    }
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
<<<<<<< HEAD
    const drive = canDrive(race.phase) ? movement : idleDrive;
    const abilityDown = keyboard.keys.has("KeyX") || gamepad.ability;
    const activate = abilityDown && !abilityWasDown;
    abilityWasDown = abilityDown;
    look = stepLook(look, mouse.consume(), { x: gamepad.lookX, y: gamepad.lookY }, dt);

    if (race.phase === "racing") {
      const ticked = stepAbilityWorld(world, {
        dt,
        racing: true,
        activate,
        player: motion,
        rival,
        inWaveZone: isInWaveZone(motion.x, motion.z),
        random: Math.random,
        pool: raceAbilityPool,
      });
      world = ticked.world;
      motion = ticked.player;
      rival = ticked.rival;
      for (const cue of ticked.cues) {
        cues.play(cue);
      }
      if (ticked.cues.includes("block")) {
        blockFlash = 0.28;
=======
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
>>>>>>> graphics
      }
    }

<<<<<<< HEAD
    if (race.phase === "racing" || race.phase === "countdown") {
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw), speedModifiers(world.loadout.effects));
      if (race.phase === "racing") {
        rival = stepRival(rival, motion, dt, speedModifiers(world.rivalEffects));
      }
    }
    const reachedFinish = race.phase === "racing" && isInFinishZone(motion.x, motion.z);
    race = stepRace(race, dt, reachedFinish);

    placeTurtle(turtle, motion);
    placeTurtle(rivalTurtle, rival);
    updateFollowCamera(camera, look, motion.x, motion.z);
    const playerSpeed = canDrive(race.phase) ? motion.speed : 0;
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, playerSpeed, dt, world.loadout.effects.frenzyRemaining > 0);
    stepTurtleAnimation(rivalAnimation, rivalTurtle.visual, rivalTurtle.flippers, canDrive(race.phase) ? rival.speed : 0, dt, false);
    fx.sync({
      time: clock,
      orbs: world.orbs,
      clouds: world.clouds,
      playerEffects: world.loadout.effects,
      rivalEffects: world.rivalEffects,
      blockFlash,
      playerX: motion.x,
      playerZ: motion.z,
      trail: isTrailVisible(world.loadout.effects),
      waveArmed: world.loadout.effects.waveWindowRemaining > 0,
      waveBoost: world.loadout.effects.waveBoostRemaining > 0,
      playerSkin: turtle.skin,
      playerShell: turtle.shell,
      rivalSkin: rivalTurtle.skin,
      rivalShell: rivalTurtle.shell,
    });

    const standing = raceStanding(motion.z, rival.z);
    const abilityView = formatAbilityHud({
      held: world.loadout.held,
      effects: world.loadout.effects,
    });
    syncAbilityHud(ui, abilityView);
    syncRaceUi(ui, race, hudVisible, standing);
    ui.hud.textContent = formatHud({
      phase: race.phase,
      elapsed: race.elapsed,
      finishTime: race.finishTime,
=======
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
>>>>>>> graphics
      surfaceLabel: surfaceAt(motion.z).label,
      speed: motion.speed,
      x: motion.x,
      z: motion.z,
      movementSource: movement.source,
      lookSource: lookSource(gamepad.lookX, gamepad.lookY),
      pointerLocked: mouse.pointerLocked,
      deadZone: controlSettings.stickDeadZone,
      gamepad,
      place: standing.place,
      field: standing.field,
      abilityLine: formatAbilityLine(abilityView),
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
<<<<<<< HEAD
      cues.dispose();
=======
      spaceEnding.dispose();
>>>>>>> graphics
      camera.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}

function syncAbilityHud(ui: GameUi, view: ReturnType<typeof formatAbilityHud>): void {
  const stored = view.stored ?? "empty";
  const ready = view.stored !== null && view.timer === null;
  ui.abilitySlot.dataset.ability = stored;
  ui.abilitySlot.dataset.ready = String(ready);
  ui.abilitySlot.setAttribute(
    "aria-label",
    view.stored ? (ready ? `${abilityCatalog[view.stored].name}. Press X.` : abilityCatalog[view.stored].name) : "No ability stored",
  );
  ui.abilityIcon.innerHTML = view.stored ? abilityIcon(view.stored) : "";
  ui.abilityTimer.hidden = view.timer === null;
  ui.abilityHud.dataset.tone = view.timer?.tone ?? "empty";
  if (view.timer) {
    ui.abilityTimerLabel.textContent = view.timer.label;
    ui.abilityMeterFill.style.width = `${view.timer.meter * 100}%`;
  }
}

function syncRaceUi(
  ui: GameUi,
  race: RaceState,
  hudVisible: boolean,
  standing: { place: number; field: number },
): void {
  const menuOpen = race.phase === "ready" || race.phase === "finished";
  ui.hud.hidden = menuOpen || !hudVisible;
  ui.hudToggle.hidden = menuOpen;
  ui.abilityHud.hidden = menuOpen;
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
    ui.resultsPlace.textContent = formatPlace(standing.place, standing.field);
    ui.resultsTime.textContent = `Time ${formatRaceTime(race.finishTime)}`;
  }
}
