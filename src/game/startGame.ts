import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { createEffects, isTrailVisible, speedModifiers } from "../abilities/abilityState";
import { exhaustionScale } from "../abilities/health";
import { lungeExtension } from "../abilities/snap";
import { abilityCatalog, raceAbilityPool } from "../abilities/catalog";
import { createAbilityFx } from "../abilities/renderAbilityFx";
import { stepAbilityWorld, createAbilityWorld, type AbilityWorld } from "../abilities/stepAbilityWorld";
import { createAbilityCues } from "../audio/abilityCues";
import { createSeagullMobs } from "../mob/createSeagull";
import { seagullSpawns } from "../mob/seagull";
import { createFollowCamera, resetFollowCamera, updateFollowCamera } from "../camera/createThirdPersonCamera";
import { abilityIcon } from "../hud/abilityIcon";
import { formatAbilityHud, formatAbilityLine, formatPlace } from "../hud/formatAbilityHud";
import { formatHealth, formatSnap } from "../hud/formatHealthHud";
import { formatHud } from "../hud/formatHud";
import { combineMovement } from "../input/combineControls";
import { controlSettings, setStickDeadZone } from "../input/controlSettings";
import { createKeyboardState } from "../input/createKeyboardState";
import { createMouseLook } from "../input/createMouseLook";
import { readKeyboard } from "../input/keyboard";
import { pollGamepads } from "../input/pollGamepads";
import { lookSource, stepLook, type LookOffsets } from "../input/stepLook";
import { clampToBeach, clampToCourse, isInFinishZone, isInWaveZone, surfaceAt } from "../movement/course";
import { createTurtleMotion, planFromYaw, stepTurtle, type DriveInput, type TurtleMotion } from "../movement/stepTurtle";
import { canDrive, countdownLabel, createRaceState, formatRaceTime, startCountdown, stepRace, type RaceState } from "../race/raceState";
import { createRivalMotion, raceStanding, stepRival } from "../race/stepRival";
import { createBeachScene } from "../scene/createBeachScene";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
import { createPlaceholderTurtle, type PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createDetailedTurtle } from "../turtle/createDetailedTurtle";
import { defaultTurtleType, scaleCrawl, turtleTypeList, turtleTypes, type TurtleTypeId } from "../turtle/turtleTypes";
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
  healthHud: HTMLElement;
  healthLabel: HTMLElement;
  healthFill: HTMLElement;
  rivalHealthLabel: HTMLElement;
  rivalHealthFill: HTMLElement;
  abilitySpare: HTMLElement;
  abilitySpareIcon: HTMLElement;
  snapHud: HTMLElement;
  snapLabel: HTMLElement;
  snapFill: HTMLElement;
  /** Containers that get one button per turtle type. */
  typePickers: HTMLElement[];
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
export function startGame(canvas: HTMLCanvasElement, ui: GameUi, beachPreview = false): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine, beachPreview);
  const turtle = beachPreview ? createDetailedTurtle(scene) : createPlaceholderTurtle(scene);
  const rivalTurtle = createPlaceholderTurtle(scene, {
    id: "rival",
    skin: new Color3(0.55, 0.62, 0.4),
    shell: new Color3(0.25, 0.4, 0.48),
  });
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
  let turtleType = turtleTypes[defaultTurtleType];
  let world: AbilityWorld = createAbilityWorld(turtleType.maxHealth, seagullSpawns);
  const mobs = createSeagullMobs(scene, world.seagulls);
  let rescuing = false;
  let playerLift = 0;
  let abilityWasDown = false;
  let snapWasDown = false;
  let hurtFlash = 0;
  let lastHealth = world.playerHealth.current;
  let blockFlash = 0;
  let clock = 0;
  const animation: TurtleAnimation = { phase: 0 };
  const rivalAnimation: TurtleAnimation = { phase: 0 };
  let hudVisible = !beachPreview;
  const heldEdges = new Set<string>();

  const placeTurtle = (body: PlaceholderTurtle, next: TurtleMotion, lift = 0) => {
    body.root.position.set(next.x, lift, next.z);
    body.root.rotation.y = next.heading;
  };
  placeTurtle(turtle, motion);
  placeTurtle(rivalTurtle, rival);

  const applyTurtleType = (id: TurtleTypeId) => {
    turtleType = turtleTypes[id];
    turtle.root.scaling.setAll(turtleType.bodyScale);
    turtle.setHeadReach(turtleType.neckLength);
    for (const picker of ui.typePickers) {
      for (const button of picker.querySelectorAll<HTMLButtonElement>("button")) {
        button.setAttribute("aria-checked", String(button.dataset.turtleType === id));
      }
    }
  };
  const pickerCleanups = ui.typePickers.map((picker) => {
    picker.replaceChildren();
    const onPick = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-turtle-type]");
      if (button && (race.phase === "ready" || race.phase === "finished")) {
        applyTurtleType(button.dataset.turtleType as TurtleTypeId);
      }
    };
    for (const type of turtleTypeList) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.dataset.turtleType = type.id;
      button.textContent = type.name;
      const detail = document.createElement("small");
      detail.textContent = type.summary;
      button.append(detail);
      picker.append(button);
    }
    picker.addEventListener("click", onPick);
    return () => picker.removeEventListener("click", onPick);
  });
  applyTurtleType(defaultTurtleType);

  const restartRace = () => {
    spaceEnding.reset();
    ending = null;
    motion = createTurtleMotion();
    rival = createRivalMotion(motion);
    look = { ...initialLook };
    resetFollowCamera(camera);
    race = startCountdown(race);
    world = createAbilityWorld(turtleType.maxHealth, seagullSpawns);
    rescuing = false;
    playerLift = 0;
    lastHealth = world.playerHealth.current;
    hurtFlash = 0;
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
    hurtFlash = Math.max(0, hurtFlash - dt);
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
    const drive = canDrive(race.phase) && !rescuing ? movement : idleDrive;
    const abilityDown = keyboard.keys.has("KeyX") || gamepad.ability;
    const activate = abilityDown && !abilityWasDown;
    abilityWasDown = abilityDown;
    const snapDown = keyboard.keys.has("KeyE") || gamepad.snap;
    const snapPressed = snapDown && !snapWasDown;
    snapWasDown = snapDown;
    if (ending) {
      ending = stepEnding(ending, dt);
      mouse.consume();
    } else {
      look = stepLook(look, mouse.consume(), { x: gamepad.lookX, y: gamepad.lookY }, dt);
    }

    let shift = { x: 0, z: 0 };
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
        itemSlots: turtleType.itemSlots,
        canSnap: turtleType.canSnap,
        snapPressed,
      });
      world = ticked.world;
      rescuing = ticked.rescuing;
      shift = ticked.playerShift;
      playerLift = ticked.playerLift;
      motion = ticked.player;
      rival = ticked.rival;
      for (const cue of ticked.cues) {
        cues.play(cue);
      }
      if (ticked.cues.includes("block")) {
        blockFlash = 0.28;
      }
      if (world.playerHealth.current < lastHealth) {
        hurtFlash = 0.4;
      }
      lastHealth = world.playerHealth.current;
    }

    if (race.phase === "racing" || race.phase === "countdown") {
      const playerPace = turtleType.speedScale * exhaustionScale(world.playerHealth);
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw), scaleCrawl(speedModifiers(world.loadout.effects), playerPace));
      motion = {
        ...motion,
        x: clampToBeach(motion.x + (shift.x)),
        z: clampToCourse(motion.z + (shift.z)),
      };
      if (race.phase === "racing") {
        rival = stepRival(rival, motion, dt, scaleCrawl(speedModifiers(world.rivalEffects), exhaustionScale(world.rivalHealth)));
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
      placeTurtle(turtle, motion, playerLift);
      updateFollowCamera(camera, look, motion.x, motion.z, playerLift);
    }
    placeTurtle(rivalTurtle, rival);
    const playerSpeed = endingFrame?.speed ?? (rescuing ? 4 : canDrive(race.phase) ? motion.speed : 0);
    turtle.setHeadReach(turtleType.neckLength + (endingFrame ? 0 : lungeExtension(world.snap)));
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, playerSpeed, dt,
      !endingFrame && world.loadout.effects.frenzyRemaining > 0);
    if (endingFrame?.phase === "boarding") {
      const tuck = Math.min(1, endingFrame.phaseTime / 0.5);
      for (const flipper of turtle.flippers) {
        flipper.mesh.rotation.y = flipper.baseY + (flipper.side * 1.4 - flipper.baseY) * tuck;
        flipper.mesh.rotation.z *= 1 - tuck;
      }
    }
    stepTurtleAnimation(rivalAnimation, rivalTurtle.visual, rivalTurtle.flippers, canDrive(race.phase) ? rival.speed : 0, dt, false);
    mobs.sync(world.seagulls, clock);
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
      spare: world.loadout.spare,
      effects: world.loadout.effects,
    });
    syncAbilityHud(ui, abilityView);
    syncHealthHud(ui, world, turtleType, hurtFlash > 0);
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
      for (const cleanup of pickerCleanups) cleanup();
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
  ui.healthHud.hidden = menuOpen || cinematic;
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

function syncHealthHud(ui: GameUi, world: AbilityWorld, type: (typeof turtleTypes)[TurtleTypeId], hurt: boolean): void {
  const player = formatHealth(world.playerHealth, type.name);
  ui.healthLabel.textContent = player.label;
  ui.healthFill.style.width = `${player.fraction * 100}%`;
  ui.healthHud.dataset.tone = player.tone;
  ui.healthHud.dataset.hurt = String(hurt);
  const rival = formatHealth(world.rivalHealth, "Rival");
  ui.rivalHealthLabel.textContent = rival.label;
  ui.rivalHealthFill.style.width = `${rival.fraction * 100}%`;

  ui.abilitySpare.hidden = type.itemSlots < 2;
  const spare = world.loadout.spare;
  ui.abilitySpare.dataset.ability = spare ?? "empty";
  ui.abilitySpare.setAttribute("aria-label", spare ? `Next: ${abilityCatalog[spare].name}` : "Second slot empty");
  ui.abilitySpareIcon.innerHTML = spare ? abilityIcon(spare) : "";

  ui.snapHud.hidden = !type.canSnap;
  if (type.canSnap) {
    const snap = formatSnap(world.snap);
    ui.snapLabel.textContent = snap.label;
    ui.snapFill.style.width = `${snap.meter * 100}%`;
  }
}
