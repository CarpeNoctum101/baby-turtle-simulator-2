import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { createEffects, isTrailVisible, speedModifiers } from "../abilities/abilityState";
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
import type { PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createSculptedTurtle } from "../turtle/createSculptedTurtle";
import { createOceanTurtle } from "../turtle/createOceanTurtle";
import { createEndingState, sampleEnding, stepEnding, type EndingPhase, type EndingState } from "./endingState";
import { createSpaceEnding } from "../scene/ending/createSpaceEnding";

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

export interface RunningGame {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

const idleDrive: DriveInput = { throttle: 0, steer: 0, brake: false };

/**
 * Builds the beach once, then runs a single draw loop.
 * Starting again resets the turtle, the rival, the orbs, and any ability that was still running.
 */
export function startGame(canvas: HTMLCanvasElement, ui: GameUi, beachPreview = false, turtleModel: "ocean" | "tmnt" = "ocean"): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine, beachPreview);
  const turtle = turtleModel === "tmnt" ? createSculptedTurtle(scene) : createOceanTurtle(scene);
  const rivalTurtle = turtleModel === "tmnt" ? createSculptedTurtle(scene, { id: "rival", redMask: true })
    : createOceanTurtle(scene, { id: "rival" });
  const camera = createFollowCamera(scene);
  // Keep camera-relative forward aimed at the finish in both course views.
  const initialLook: LookOffsets = { yaw: 0, pitch: beachPreview ? 0.22 : 0 };
  if (beachPreview) camera.radius = camera.camera.radius = 9;
  const keyboard = createKeyboardState(window);
  const mouse = createMouseLook(canvas);
  const cues = createAbilityCues();
  const fx = createAbilityFx(scene, turtle.visual);
  // Capture the rival and ability meshes as part of the beach to restore on rematch.
  const spaceEnding = createSpaceEnding(scene, turtle);
  const inactiveEffects = createEffects();

  let motion = createTurtleMotion();
  let rival = createRivalMotion(motion);
  let look: LookOffsets = { ...initialLook };
  let race = createRaceState();
  let ending: EndingState | null = null;
  let world: AbilityWorld = createAbilityWorld();
  let abilityWasDown = false;
  let blockFlash = 0;
  let clock = 0;
  const animation: TurtleAnimation = { phase: 0 };
  const rivalAnimation: TurtleAnimation = { phase: 0 };
  let hudVisible = !beachPreview;
  const heldEdges = new Set<string>();

  const placeTurtle = (body: PlaceholderTurtle, next: TurtleMotion) => {
    body.root.position.set(next.x, 0, next.z);
    body.root.rotation.y = next.heading;
  };
  placeTurtle(turtle, motion);
  placeTurtle(rivalTurtle, rival);

  const restartRace = () => {
    spaceEnding.reset();
    ending = null;
    motion = createTurtleMotion();
    rival = createRivalMotion(motion);
    look = { ...initialLook };
    resetFollowCamera(camera);
    race = startCountdown(race);
    world = createAbilityWorld();
    blockFlash = 0;
    animation.phase = 0;
    rivalAnimation.phase = 0;
    setHudVisible(!beachPreview);
    mouse.consume();
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
  ui.hudToggle.addEventListener("click", onToggleHud);
  setHudVisible(hudVisible);

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
    if (pressedOnce("Enter") && (!ending || sampleEnding(ending).phase === "space")) {
      beginFromMenu();
    }
    if (pressedOnce("KeyR") && race.phase !== "ready") {
      restartRace();
    }

    const gamepad = pollGamepads(controlSettings.stickDeadZone);
    const movement = combineMovement(readKeyboard(keyboard.keys), gamepad);
    const drive = canDrive(race.phase) ? movement : idleDrive;
    const abilityDown = keyboard.keys.has("KeyX") || gamepad.ability;
    const activate = abilityDown && !abilityWasDown;
    abilityWasDown = abilityDown;
    if (ending) {
      ending = stepEnding(ending, dt);
      mouse.consume();
    } else {
      look = stepLook(look, mouse.consume(), { x: gamepad.lookX, y: gamepad.lookY }, dt);
    }

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
      }
    }

    if (race.phase === "racing" || race.phase === "countdown") {
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw), speedModifiers(world.loadout.effects));
      if (race.phase === "racing") {
        rival = stepRival(rival, motion, dt, speedModifiers(world.rivalEffects));
      }
    }
    const reachedFinish = race.phase === "racing" && isInFinishZone(motion.x, motion.z);
    race = stepRace(race, dt, reachedFinish);
    if (reachedFinish) {
      ending = createEndingState(motion);
      spaceEnding.begin();
    }

    const endingFrame = ending ? sampleEnding(ending) : null;
    if (endingFrame) {
      spaceEnding.update(endingFrame, dt);
    } else {
      placeTurtle(turtle, motion);
      updateFollowCamera(camera, look, motion.x, motion.z);
    }
    placeTurtle(rivalTurtle, rival);
    const playerSpeed = endingFrame?.speed ?? (canDrive(race.phase) ? motion.speed : 0);
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, playerSpeed, dt,
      !endingFrame && world.loadout.effects.frenzyRemaining > 0);
    const tuck = endingFrame?.phase === "boarding" ? 1
      : endingFrame?.phase === "walking" ? Math.max(0, (endingFrame.walkProgress - 0.9) / 0.1) : 0;
    if (tuck > 0) {
      // Fold the arms before reaching the doorway, then hold the pose inside.
      for (const flipper of turtle.flippers) {
        flipper.mesh.rotation.y = flipper.baseY + ((flipper.boardingY ?? flipper.side * 1.4) - flipper.baseY) * tuck;
        flipper.mesh.rotation.z *= 1 - tuck;
        flipper.mesh.rotation.x *= 1 - tuck;
      }
    }
    stepTurtleAnimation(rivalAnimation, rivalTurtle.visual, rivalTurtle.flippers, canDrive(race.phase) ? rival.speed : 0, dt, false);
    fx.sync({
      time: clock,
      orbs: world.orbs,
      clouds: endingFrame ? [] : world.clouds,
      playerEffects: endingFrame ? inactiveEffects : world.loadout.effects,
      rivalEffects: endingFrame ? inactiveEffects : world.rivalEffects,
      blockFlash: endingFrame ? 0 : blockFlash,
      playerX: motion.x,
      playerZ: motion.z,
      trail: !endingFrame && isTrailVisible(world.loadout.effects),
      waveArmed: !endingFrame && world.loadout.effects.waveWindowRemaining > 0,
      waveBoost: !endingFrame && world.loadout.effects.waveBoostRemaining > 0,
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
    syncRaceUi(ui, race, hudVisible, standing, endingFrame?.phase ?? null);
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
      cues.dispose();
      spaceEnding.dispose();
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
  endingPhase: EndingPhase | null,
): void {
  const cinematic = endingPhase !== null && endingPhase !== "space";
  const menuOpen = race.phase === "ready" || (race.phase === "finished" && !cinematic);
  ui.hud.hidden = menuOpen || cinematic || !hudVisible;
  ui.hudToggle.hidden = menuOpen || cinematic;
  ui.abilityHud.hidden = menuOpen || cinematic;
  ui.startScreen.hidden = race.phase !== "ready";
  ui.results.hidden = race.phase !== "finished" || cinematic;
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
