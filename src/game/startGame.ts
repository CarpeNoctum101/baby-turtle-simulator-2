import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { applySandSlow, createEffects, isTrailVisible, resolveWaveWindow, speedModifiers, stepLoadout, type AbilityLoadout, type RacerEffects } from "../abilities/abilityState";
import { abilityCatalog, raceAbilityPool, sandRules, shellRules, type AbilityId } from "../abilities/catalog";
import { exhaustionScale } from "../abilities/health";
import { orbPickupRadius, tideOrbSpots, type TideOrb } from "../abilities/pickups";
import { createAbilityFx } from "../abilities/renderAbilityFx";
import { createSandCloud, stepSandClouds } from "../abilities/sandSpray";
import { lungeExtension } from "../abilities/snap";
import { spinRules } from "../abilities/specials";
import { createAbilityWorld, stepAbilityWorld, type AbilityCue, type AbilityWorld } from "../abilities/stepAbilityWorld";
import { createAbilityCues } from "../audio/abilityCues";
import { createFollowCamera, resetFollowCamera, updateFollowCamera } from "../camera/createThirdPersonCamera";
import { abilityIcon } from "../hud/abilityIcon";
import { formatAbilityHud, formatAbilityLine, formatPlace } from "../hud/formatAbilityHud";
import { formatHealth, formatSpecial } from "../hud/formatHealthHud";
import { formatHud } from "../hud/formatHud";
import { combineMovement, limitInput, parseInputChoice, type InputChoice } from "../input/combineControls";
import { controlSettings, setStickDeadZone } from "../input/controlSettings";
import { createKeyboardState } from "../input/createKeyboardState";
import { createMouseLook } from "../input/createMouseLook";
import { readKeyboard } from "../input/keyboard";
import { pollGamepads } from "../input/pollGamepads";
import { lookSource, stepLook, type LookOffsets } from "../input/stepLook";
import { clampToBeach, clampToCourse, isInFinishZone, isInWaveZone, surfaceAt } from "../movement/course";
import { createTurtleMotion, planFromYaw, stepTurtle, type DriveInput, type TurtleMotion } from "../movement/stepTurtle";
import { createSeagullMobs } from "../mob/createSeagull";
import { seagullSpawns } from "../mob/seagull";
import { compareResults, syncedRemaining } from "../../shared/raceFlow";
import { slotPose } from "../../shared/roomState";
import type { LoadoutMessage, PublicOrb, PublicPlayer, RoomPhase, Ticket } from "../../shared/protocol";
import { normalizeRoomCode } from "../../shared/protocol";
import {
  clearTicket,
  createOnlineRoom,
  joinOnlineRoom,
  loadTicket,
  OnlineSession,
  releaseTicket,
  saveTicket,
} from "../net/onlineClient";
import { createRemoteTurtles } from "../net/remoteTurtles";
import { canDrive, countdownLabel, createRaceState, formatRaceTime, startCountdown, stepRace, type RaceState } from "../race/raceState";
import { createRivalMotion, raceStanding, stepRival } from "../race/stepRival";
import { createBeachScene } from "../scene/createBeachScene";
import { createSpaceEnding } from "../scene/ending/createSpaceEnding";
import { stepTurtleAnimation, type TurtleAnimation } from "../turtle/animateTurtle";
import type { PlaceholderTurtle } from "../turtle/createPlaceholderTurtle";
import { createOceanTurtle } from "../turtle/createOceanTurtle";
import { createSculptedTurtle } from "../turtle/createSculptedTurtle";
import { defaultTurtleType, scaleCrawl, turtleTypeList, turtleTypes, type TurtleTypeId } from "../turtle/turtleTypes";
import { createEndingState, sampleEnding, stepEnding, type EndingPhase, type EndingState } from "./endingState";

export interface GameUi {
  hud: HTMLElement;
  hudToggle: HTMLButtonElement;
  startScreen: HTMLElement;
  startButton: HTMLButtonElement;
  countdown: HTMLElement;
  raceTimer: HTMLElement;
  results: HTMLElement;
  resultsTitle: HTMLElement;
  resultsTime: HTMLElement;
  resultsPlace: HTMLElement;
  resultsTable: HTMLElement;
  rematchButton: HTMLButtonElement;
  abilityHud: HTMLElement;
  abilitySlot: HTMLElement;
  abilityIcon: HTMLElement;
  abilityTimer: HTMLElement;
  abilityTimerLabel: HTMLElement;
  abilityMeterFill: HTMLElement;
  playerName: HTMLInputElement;
  createRoomButton: HTMLButtonElement;
  roomCodeInput: HTMLInputElement;
  joinRoomButton: HTMLButtonElement;
  onlineStatus: HTMLElement;
  lobbyBar: HTMLElement;
  lobbySummary: HTMLElement;
  readyToggle: HTMLButtonElement;
  startOnlineButton: HTMLButtonElement;
  leaveRoomButton: HTMLButtonElement;
  inputDevices: HTMLFieldSetElement;
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
const inputChoiceKey = "baby-turtle-input";

/**
 * Builds the beach once, then runs a single draw loop.
 * A local race uses turtle types, health, specials and seagulls on this computer.
 * An online race lets the server own the countdown, Tide Orbs, abilities and finish order.
 */
export function startGame(canvas: HTMLCanvasElement, ui: GameUi, beachPreview = false, turtleModel: "ocean" | "tmnt" = "ocean"): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine, beachPreview);
  const turtle = turtleModel === "tmnt" ? createSculptedTurtle(scene) : createOceanTurtle(scene);
  const rivalTurtle = turtleModel === "tmnt" ? createSculptedTurtle(scene, { id: "rival", redMask: true }) : createOceanTurtle(scene, { id: "rival" });
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
  let specialWasDown = false;
  let controlsLocked = false;
  let spinAngle = 0;
  let hurtFlash = 0;
  let lastHealth = world.playerHealth.current;
  let blockFlash = 0;
  let clock = 0;
  const animation: TurtleAnimation = { phase: 0 };
  const rivalAnimation: TurtleAnimation = { phase: 0 };
  let hudVisible = !beachPreview;
  const heldEdges = new Set<string>();
  let online = false;

  const freshWorld = () => createAbilityWorld(turtleType.maxHealth, seagullSpawns);

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
      if (button && !online && (race.phase === "ready" || race.phase === "finished")) {
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

  const resetCombat = () => {
    world = freshWorld();
    rescuing = false;
    controlsLocked = false;
    spinAngle = 0;
    playerLift = 0;
    lastHealth = world.playerHealth.current;
    hurtFlash = 0;
    blockFlash = 0;
  };

  const restartRace = () => {
    spaceEnding.reset();
    ending = null;
    motion = createTurtleMotion();
    rival = createRivalMotion(motion);
    look = { ...initialLook };
    resetFollowCamera(camera);
    race = startCountdown(race);
    resetCombat();
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
    if (online || (race.phase !== "ready" && race.phase !== "finished")) {
      return;
    }
    const previous = loadTicket();
    if (previous) {
      void releaseTicket(previous);
      clearTicket();
    }
    restartRace();
  };

  ui.startButton.addEventListener("click", beginFromMenu);
  const onRematch = () => {
    if (online) {
      session?.sendRematch();
      return;
    }
    beginFromMenu();
  };
  ui.rematchButton.addEventListener("click", onRematch);

  const remotes = createRemoteTurtles(scene);
  let session: OnlineSession | null = null;
  let poseTimer = 0;
  let selfId = "";
  let roomCode = "";
  let onlineHostId = "";
  let onlinePlayers: PublicPlayer[] = [];
  let onlinePhase: RoomPhase = "lobby";
  let clockOffset = 0;
  let endsAt: number | null = null;
  let startedAt: number | null = null;
  let serverOrbs: PublicOrb[] = [];
  let selfPlace = 0;
  let selfMs = 0;
  let mySlot = 0;
  let finishAttemptAt = 0;
  let pendingOrb = "";
  let pendingOrbAt = 0;
  let raceNotice = "";
  let home = slotPose(0);

  const renderResults = () => {
    ui.resultsTitle.textContent = online ? "Race results" : "You reached the sea";
    ui.resultsTable.hidden = !online;
    ui.resultsTable.replaceChildren();
    if (!online) {
      return;
    }
    const rows = onlinePlayers.slice().sort(compareResults);
    for (const row of rows) {
      const item = document.createElement("li");
      item.textContent = row.place > 0
        ? `${row.place}. ${row.name}  ${formatRaceTime(row.ms / 1000)}`
        : `— ${row.name}  DNF`;
      ui.resultsTable.append(item);
    }
  };

  const renderLobby = () => {
    const names = onlinePlayers.map((player) => {
      const tags = [
        player.id === selfId ? "you" : "",
        player.id === onlineHostId ? "host" : "",
        player.connected ? "" : "away",
        onlinePhase === "lobby" && player.ready ? "ready" : "",
        player.place > 0 ? `${player.place}` : "",
      ].filter((tag) => tag.length > 0);
      return tags.length > 0 ? `${player.name} (${tags.join(", ")})` : player.name;
    });
    const connected = onlinePlayers.filter((player) => player.connected);
    const me = onlinePlayers.find((player) => player.id === selfId);
    if (onlinePhase === "countdown") {
      ui.lobbySummary.textContent = `Room ${roomCode}. The countdown is shared. ${names.join(", ")}.`;
    } else if (onlinePhase === "racing") {
      ui.lobbySummary.textContent = `Room ${roomCode}. Racing. The server decides the finish order. ${names.join(", ")}.`;
    } else if (onlinePhase === "finished") {
      const rematch = onlineHostId === selfId ? "Rematch returns everyone to the lobby." : "Waiting for the host to rematch.";
      ui.lobbySummary.textContent = `Room ${roomCode}. Finished. ${rematch}`;
    } else {
      ui.lobbySummary.textContent = `Room ${roomCode}. ${connected.length} connected. ${names.join(", ")}. Ready up, then the host starts the countdown.`;
    }
    ui.readyToggle.hidden = onlinePhase !== "lobby";
    ui.readyToggle.textContent = me?.ready ? "Not ready" : "Ready";
    ui.startOnlineButton.hidden = onlinePhase !== "lobby" || onlineHostId !== selfId;
    ui.startOnlineButton.disabled = connected.length === 0 || connected.some((player) => !player.ready);
    ui.rematchButton.disabled = onlineHostId !== selfId;
    renderResults();
  };

  const snapHome = () => {
    const pad = slotPose(mySlot);
    motion = { x: pad.x, z: pad.z, heading: pad.heading, speed: 0, steer: 0 };
    placeTurtle(turtle, motion);
    ending = null;
    spaceEnding.reset();
    resetCombat();
    selfPlace = 0;
    selfMs = 0;
    finishAttemptAt = 0;
    pendingOrb = "";
    race = createRaceState();
  };

  const syncOnlineClock = (dt: number) => {
    const local = Date.now();
    if (onlinePhase === "countdown" && endsAt !== null) {
      race = {
        phase: "countdown",
        countdown: Math.max(0, syncedRemaining(endsAt, clockOffset, local)),
        elapsed: 0,
        finishTime: null,
        goBanner: 0,
      };
      return;
    }
    if (onlinePhase === "racing" && startedAt !== null) {
      race = {
        phase: "racing",
        countdown: 0,
        elapsed: Math.max(0, (local + clockOffset - startedAt) / 1000),
        finishTime: selfPlace > 0 ? selfMs / 1000 : null,
        goBanner: Math.max(0, race.goBanner - dt),
      };
      return;
    }
    if (onlinePhase === "finished") {
      race = {
        phase: "finished",
        countdown: 0,
        elapsed: race.elapsed,
        finishTime: selfPlace > 0 ? selfMs / 1000 : null,
        goBanner: 0,
      };
      return;
    }
    race = createRaceState();
  };

  const noteSelfFinish = (place: number, ms: number) => {
    if (place <= selfPlace) {
      return;
    }
    selfPlace = place;
    selfMs = ms;
    race = { ...race, finishTime: ms / 1000 };
    if (!ending && onlinePhase !== "lobby" && onlinePhase !== "countdown") {
      ending = createEndingState(motion);
      spaceEnding.begin();
    }
  };

  const stopOnline = (status: string, forget: boolean) => {
    const current = session;
    session = null;
    online = false;
    selfId = "";
    if (current) {
      if (forget) {
        current.leave();
      } else {
        current.drop();
      }
    }
    remotes.clear();
    rivalTurtle.root.setEnabled(true);
    if (forget) {
      clearTicket();
    }
    spaceEnding.reset();
    ending = null;
    motion = createTurtleMotion();
    rival = createRivalMotion(motion);
    race = createRaceState();
    resetCombat();
    placeTurtle(turtle, motion);
    placeTurtle(rivalTurtle, rival);
    ui.onlineStatus.textContent = status;
    ui.lobbyBar.hidden = true;
    ui.startScreen.hidden = false;
    ui.rematchButton.disabled = false;
    ui.resultsTitle.textContent = "You reached the sea";
    ui.resultsTable.hidden = true;
    ui.resultsTable.replaceChildren();
    onlinePhase = "lobby";
    selfPlace = 0;
    selfMs = 0;
    finishAttemptAt = 0;
    raceNotice = "";
  };

  const attachOnline = (ticket: Ticket) => {
    saveTicket(ticket);
    selfId = ticket.playerId;
    roomCode = ticket.roomCode;
    home = slotPose(ticket.slot);
    remotes.setSelf(ticket.playerId);
    motion = { x: ticket.x, z: ticket.z, heading: ticket.heading, speed: 0, steer: 0 };
    placeTurtle(turtle, motion);
    rivalTurtle.root.setEnabled(false);
    ending = null;
    spaceEnding.reset();
    resetCombat();
    ui.onlineStatus.textContent = `Joining room ${ticket.roomCode}…`;
    session?.drop();
    session = new OnlineSession({
      onWelcome: (message) => {
        online = true;
        poseTimer = 0;
        selfId = message.playerId;
        roomCode = message.roomCode;
        onlineHostId = message.hostId;
        onlinePhase = message.phase;
        onlinePlayers = message.players;
        mySlot = message.slot;
        home = slotPose(message.slot);
        motion = { x: message.x, z: message.z, heading: message.heading, speed: 0, steer: 0 };
        placeTurtle(turtle, motion);
        remotes.setSelf(message.playerId);
        remotes.applyRoster(message.players);
        const me = message.players.find((player) => player.id === message.playerId);
        if (me) {
          noteSelfFinish(me.place, me.ms);
        }
        ui.startScreen.hidden = true;
        ui.lobbyBar.hidden = false;
        ui.onlineStatus.textContent = "";
        renderLobby();
        canvas.focus();
      },
      onRoster: (message) => {
        onlineHostId = message.hostId;
        onlinePhase = message.phase;
        onlinePlayers = message.players;
        remotes.applyRoster(message.players);
        const me = message.players.find((player) => player.id === selfId);
        if (me) {
          noteSelfFinish(me.place, me.ms);
        }
        renderLobby();
        if (message.phase === "closed") {
          stopOnline("This room was closed because everyone left.", true);
        }
      },
      onPhase: (message) => {
        clockOffset = message.serverNow - Date.now();
        onlinePhase = message.phase;
        endsAt = message.endsAt;
        startedAt = message.startedAt;
        if (message.snap) {
          snapHome();
        }
        if (message.phase === "racing") {
          race = {
            ...race,
            phase: "racing",
            countdown: 0,
            elapsed: 0,
            finishTime: selfPlace > 0 ? selfMs / 1000 : null,
            goBanner: selfPlace > 0 ? 0 : 0.8,
          };
        } else if (message.phase === "countdown") {
          race = { ...createRaceState(), phase: "countdown" };
        } else if (message.phase === "finished") {
          race = { ...race, phase: "finished", goBanner: 0, finishTime: selfPlace > 0 ? selfMs / 1000 : null };
        } else if (message.phase === "lobby") {
          race = createRaceState();
        }
        renderLobby();
      },
      onOrbs: (message) => {
        serverOrbs = message.orbs;
      },
      onOrb: (message) => {
        const next = serverOrbs.filter((orb) => orb.id !== message.id);
        serverOrbs = [...next, { id: message.id, at: message.at }];
        if (message.playerId === selfId) {
          world = { ...world, loadout: { ...world.loadout, held: message.ability } };
          cues.play("pickup");
          pendingOrb = "";
        }
      },
      onLoadout: (message) => {
        world = { ...world, loadout: applyServerLoadout(world.loadout, message, Date.now() + clockOffset) };
      },
      onAbility: (message) => {
        const remaining = Math.max(0, (message.until - (Date.now() + clockOffset)) / 1000);
        const untilLocal = message.until - clockOffset;
        if (message.playerId === selfId) {
          world = {
            ...world,
            loadout: showServerAbility(world.loadout, message.ability, remaining),
          };
          cues.play(cueForAbility(message.ability));
        } else {
          remotes.showAbility(message.playerId, message.ability, untilLocal);
        }
        if (message.ability === "sand-spray" && remaining > 0) {
          world = {
            ...world,
            clouds: [
              ...world.clouds,
              createSandCloud(world.nextCloudId, message.playerId === selfId ? "player" : message.playerId, message, remaining),
            ],
            nextCloudId: world.nextCloudId + 1,
          };
        }
        for (const id of message.blocked) {
          if (id === selfId) {
            world = {
              ...world,
              loadout: {
                ...world.loadout,
                effects: { ...world.loadout.effects, shieldCharges: 0, shieldRemaining: 0 },
              },
            };
            blockFlash = 0.28;
            cues.play("block");
          } else {
            remotes.clearShield(id);
          }
        }
        const slowUntil = Date.now() + sandRules.slowDuration * 1000;
        for (const id of message.slowed) {
          if (id === selfId) {
            const slowed = applySandSlow(world.loadout.effects);
            world = { ...world, loadout: { ...world.loadout, effects: slowed.effects } };
          } else {
            remotes.showSlow(id, slowUntil);
          }
        }
      },
      onFinish: (message) => {
        if (message.playerId === selfId) {
          noteSelfFinish(message.place, message.ms);
        } else {
          remotes.remove(message.playerId);
        }
        renderResults();
      },
      onRejectedAction: (message) => {
        raceNotice = message.reason;
        if (message.action === "pickup") {
          pendingOrb = "";
        }
      },
      onPose: (message) => {
        if (message.playerId === selfId) {
          motion = { ...motion, x: message.x, z: message.z, heading: message.heading, speed: message.speed };
          placeTurtle(turtle, motion);
          return;
        }
        remotes.applyPose(message);
      },
      onRejected: (message) => {
        motion = { ...motion, x: message.x, z: message.z, heading: message.heading, speed: message.speed, steer: 0 };
        placeTurtle(turtle, motion);
      },
      onError: (message) => {
        stopOnline(message, true);
      },
      onClose: () => {
        stopOnline("The room connection closed. Join again with the same code, or start a local race.", false);
      },
    });
    session.connect(ticket);
  };

  const runOnlineAction = async (action: () => Promise<void>) => {
    ui.createRoomButton.disabled = true;
    ui.joinRoomButton.disabled = true;
    try {
      await action();
    } catch (error) {
      ui.onlineStatus.textContent = error instanceof Error ? error.message : "Could not reach the online lobby.";
    } finally {
      ui.createRoomButton.disabled = false;
      ui.joinRoomButton.disabled = false;
    }
  };

  const onCreateRoom = () => {
    void runOnlineAction(async () => {
      const previous = loadTicket();
      if (previous) {
        await releaseTicket(previous);
        clearTicket();
      }
      attachOnline(await createOnlineRoom(ui.playerName.value));
    });
  };

  const onJoinRoom = () => {
    void runOnlineAction(async () => {
      const code = normalizeRoomCode(ui.roomCodeInput.value);
      if (!code) {
        throw new Error("Enter the 4-character room code.");
      }
      const previous = loadTicket();
      if (previous?.roomCode === code) {
        attachOnline(previous);
        return;
      }
      if (previous) {
        await releaseTicket(previous);
        clearTicket();
      }
      attachOnline(await joinOnlineRoom(code, ui.playerName.value));
    });
  };

  const onLeaveRoom = () => {
    stopOnline("", true);
  };

  ui.createRoomButton.addEventListener("click", onCreateRoom);
  ui.joinRoomButton.addEventListener("click", onJoinRoom);
  ui.leaveRoomButton.addEventListener("click", onLeaveRoom);
  const onReady = () => {
    const me = onlinePlayers.find((player) => player.id === selfId);
    session?.sendReady(!me?.ready);
  };
  const onStartOnline = () => {
    session?.sendStart();
  };
  ui.readyToggle.addEventListener("click", onReady);
  ui.startOnlineButton.addEventListener("click", onStartOnline);

  const presetRoom = new URLSearchParams(window.location.search).get("room");
  if (presetRoom) {
    ui.roomCodeInput.value = presetRoom;
  } else {
    const saved = loadTicket();
    if (saved) {
      ui.playerName.value = saved.name;
      ui.roomCodeInput.value = saved.roomCode;
      attachOnline(saved);
    }
  }

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

  let inputChoice: InputChoice = loadInputChoice();
  const choiceRadios = [...ui.inputDevices.querySelectorAll<HTMLInputElement>('input[name="inputDevice"]')];
  for (const radio of choiceRadios) {
    radio.checked = radio.value === inputChoice;
  }
  const onInputChoice = () => {
    const selected = choiceRadios.find((radio) => radio.checked);
    inputChoice = parseInputChoice(selected?.value ?? null);
    sessionStorage.setItem(inputChoiceKey, inputChoice);
  };
  ui.inputDevices.addEventListener("change", onInputChoice);

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
    if (pressedOnce("Enter") && !online && (!ending || sampleEnding(ending).phase === "space")) {
      beginFromMenu();
    }
    const restartPressed = pressedOnce("KeyR");
    if (restartPressed && online && onlinePhase === "lobby") {
      motion = { x: home.x, z: home.z, heading: home.heading, speed: 0, steer: 0 };
      placeTurtle(turtle, motion);
      session?.sendReset();
    } else if (restartPressed && !online && race.phase !== "ready") {
      restartRace();
    }

    const gamepad = pollGamepads(controlSettings.stickDeadZone);
    const limited = limitInput(inputChoice, readKeyboard(keyboard.keys), gamepad);
    const movement = combineMovement(limited.keyboard, limited.gamepad);
    const canOnlineDrive = onlinePhase === "lobby" || (onlinePhase === "racing" && selfPlace === 0);
    const localDrive = canDrive(race.phase) && !controlsLocked;
    const drive = !ending && (online ? canOnlineDrive : localDrive) ? movement : idleDrive;
    const abilityDown = (inputChoice !== "gamepad" && keyboard.keys.has("KeyX")) || limited.gamepad.ability;
    const activate = abilityDown && !abilityWasDown;
    abilityWasDown = abilityDown;
    const specialDown = (inputChoice !== "gamepad" && keyboard.keys.has("KeyE")) || limited.gamepad.snap;
    const specialPressed = specialDown && !specialWasDown;
    specialWasDown = specialDown;
    if (ending) {
      ending = stepEnding(ending, dt);
      mouse.consume();
    } else {
      const pointer = mouse.consume();
      look = stepLook(
        look,
        limited.listenToMouse ? pointer : { yawDelta: 0, pitchDelta: 0 },
        { x: limited.gamepad.lookX, y: limited.gamepad.lookY },
        dt,
      );
    }

    let shift = { x: 0, z: 0 };
    if (race.phase === "racing" && !online) {
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
        special: turtleType.special,
        specialPressed,
      });
      world = ticked.world;
      rescuing = ticked.rescuing;
      controlsLocked = ticked.controlsLocked;
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

    if (!online && (race.phase === "racing" || race.phase === "countdown")) {
      const playerPace = turtleType.speedScale * exhaustionScale(world.playerHealth);
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw), scaleCrawl(speedModifiers(world.loadout.effects), playerPace));
      motion = {
        ...motion,
        x: clampToBeach(motion.x + shift.x),
        z: clampToCourse(motion.z + shift.z),
      };
      if (race.phase === "racing") {
        rival = stepRival(rival, motion, dt, scaleCrawl(speedModifiers(world.rivalEffects), exhaustionScale(world.rivalHealth)));
      }
    } else if (online && canOnlineDrive && !ending) {
      motion = stepTurtle(motion, drive, dt, planFromYaw(look.yaw), speedModifiers(world.loadout.effects));
    }
    if (online && !ending) {
      const serverNow = Date.now() + clockOffset;
      const wave = onlinePhase === "racing" && selfPlace === 0
        ? resolveWaveWindow(world.loadout.effects, isInWaveZone(motion.x, motion.z))
        : { effects: world.loadout.effects, triggered: false };
      if (wave.triggered) {
        cues.play("wave-boost");
      }
      world = {
        ...world,
        loadout: stepLoadout({ ...world.loadout, effects: wave.effects }, dt),
        orbs: visualOrbs(serverOrbs, serverNow),
        clouds: stepSandClouds(world.clouds, dt),
      };
      if (onlinePhase === "racing" && selfPlace === 0 && session) {
        if (activate && world.loadout.held) {
          session.sendAbility(world.loadout.held);
        }
        if (!world.loadout.held) {
          for (const spot of tideOrbSpots) {
            const row = serverOrbs.find((orb) => orb.id === spot.id);
            if ((row?.at ?? 0) > serverNow) {
              continue;
            }
            if (Math.hypot(spot.x - motion.x, spot.z - motion.z) > orbPickupRadius) {
              continue;
            }
            if (pendingOrb === spot.id && serverNow - pendingOrbAt < 500) {
              break;
            }
            pendingOrb = spot.id;
            pendingOrbAt = serverNow;
            session.sendPickup(spot.id);
            break;
          }
        }
        if (isInFinishZone(motion.x, motion.z) && serverNow - finishAttemptAt > 250) {
          finishAttemptAt = serverNow;
          session.sendFinish();
        }
      }
    }
    if (!online) {
      const reachedFinish = race.phase === "racing" && isInFinishZone(motion.x, motion.z);
      race = stepRace(race, dt, reachedFinish);
      if (reachedFinish) {
        ending = createEndingState(motion);
        spaceEnding.begin();
      }
    } else {
      syncOnlineClock(dt);
    }

    const endingFrame = ending ? sampleEnding(ending) : null;
    if (endingFrame) {
      spaceEnding.update(endingFrame, dt);
    } else {
      placeTurtle(turtle, motion, playerLift);
      updateFollowCamera(camera, look, motion.x, motion.z, playerLift);
    }
    placeTurtle(rivalTurtle, rival);
    if (online) {
      if (session && canOnlineDrive) {
        poseTimer += dt;
        if (poseTimer >= 0.05) {
          poseTimer = 0;
          session.sendPose({ x: motion.x, z: motion.z, heading: motion.heading, speed: motion.speed });
        }
      }
      remotes.step(dt);
    }
    const playerSpeed = endingFrame?.speed ?? (rescuing ? 4 : online || canDrive(race.phase) ? motion.speed : 0);
    // Kempy's shell whirls while the spin dash is on, then snaps back to facing forward.
    const spinning = !endingFrame && world.loadout.effects.spinRemaining > 0;
    spinAngle = spinning ? spinAngle + spinRules.turnsPerSecond * Math.PI * 2 * dt : 0;
    turtle.visual.rotation.y = spinAngle;
    turtle.setHeadReach(turtleType.neckLength + (endingFrame ? 0 : lungeExtension(world.snap)));
    stepTurtleAnimation(animation, turtle.visual, turtle.flippers, playerSpeed, dt,
      !endingFrame && world.loadout.effects.frenzyRemaining > 0);
    const tuck = endingFrame?.phase === "boarding" ? 1
      : endingFrame?.phase === "walking" ? Math.max(0, (endingFrame.walkProgress - 0.9) / 0.1) : 0;
    if (tuck > 0) {
      for (const flipper of turtle.flippers) {
        flipper.mesh.rotation.y = flipper.baseY + ((flipper.boardingY ?? flipper.side * 1.4) - flipper.baseY) * tuck;
        flipper.mesh.rotation.z *= 1 - tuck;
        flipper.mesh.rotation.x *= 1 - tuck;
      }
    }
    stepTurtleAnimation(rivalAnimation, rivalTurtle.visual, rivalTurtle.flippers, canDrive(race.phase) ? rival.speed : 0, dt, false);
    const showOnlineFx = online && !endingFrame && (onlinePhase === "countdown" || onlinePhase === "racing");
    mobs.sync(world.seagulls, clock);
    fx.sync({
      time: clock,
      orbs: endingFrame ? [] : online ? (showOnlineFx ? world.orbs : []) : world.orbs,
      clouds: endingFrame ? [] : world.clouds,
      playerEffects: endingFrame ? inactiveEffects : world.loadout.effects,
      rivalEffects: endingFrame || online ? inactiveEffects : world.rivalEffects,
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

    const standing = online
      ? selfPlace > 0
        ? { place: selfPlace, field: Math.max(1, onlinePlayers.length) }
        : liveStanding(onlinePlayers, selfId, motion.z)
      : raceStanding(motion.z, rival.z);
    const abilityView = formatAbilityHud({
      held: world.loadout.held,
      spare: online ? null : world.loadout.spare,
      effects: world.loadout.effects,
    });
    syncAbilityHud(ui, abilityView);
    syncHealthHud(ui, world, turtleType, hurtFlash > 0, online);
    syncRaceUi(ui, race, hudVisible, standing, endingFrame?.phase ?? null, online);
    const readout = formatHud({
      phase: race.phase,
      elapsed: race.elapsed,
      finishTime: race.finishTime,
      surfaceLabel: surfaceAt(motion.z).label,
      speed: motion.speed,
      x: motion.x,
      z: motion.z,
      movementSource: movement.source,
      lookSource: lookSource(limited.gamepad.lookX, limited.gamepad.lookY),
      pointerLocked: mouse.pointerLocked,
      deadZone: controlSettings.stickDeadZone,
      gamepad,
      place: standing.place,
      field: standing.field,
      abilityLine: formatAbilityLine(abilityView),
    });
    const choiceNote = inputChoice === "keyboard"
      ? "This window listens to the keyboard only.\n"
      : inputChoice === "gamepad"
        ? "This window listens to the controller only.\n"
        : "";
    const onlineNote = online
      ? `Online room ${roomCode}. The server keeps the countdown, Tide Orbs and finish order.${raceNotice ? ` ${raceNotice}` : ""}\n`
      : "";
    ui.hud.textContent = `${onlineNote}${choiceNote}${readout}`;
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
      ui.rematchButton.removeEventListener("click", onRematch);
      ui.createRoomButton.removeEventListener("click", onCreateRoom);
      ui.joinRoomButton.removeEventListener("click", onJoinRoom);
      ui.leaveRoomButton.removeEventListener("click", onLeaveRoom);
      ui.readyToggle.removeEventListener("click", onReady);
      ui.startOnlineButton.removeEventListener("click", onStartOnline);
      ui.inputDevices.removeEventListener("change", onInputChoice);
      session?.drop();
      remotes.clear();
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

function loadInputChoice(): InputChoice {
  const params = new URLSearchParams(window.location.search);
  if (params.has("input")) {
    const choice = parseInputChoice(params.get("input"));
    sessionStorage.setItem(inputChoiceKey, choice);
    return choice;
  }
  return parseInputChoice(sessionStorage.getItem(inputChoiceKey));
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
  onlineMode: boolean,
): void {
  const cinematic = endingPhase !== null && endingPhase !== "space";
  const menuOpen = !onlineMode && (race.phase === "ready" || (race.phase === "finished" && !cinematic));
  ui.hud.hidden = menuOpen || cinematic || !hudVisible;
  ui.hudToggle.hidden = menuOpen || cinematic;
  ui.abilityHud.hidden = menuOpen || cinematic || (onlineMode && race.phase !== "racing");
  ui.healthHud.hidden = menuOpen || cinematic || onlineMode;
  ui.startScreen.hidden = onlineMode || race.phase !== "ready";
  ui.lobbyBar.hidden = !onlineMode;
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
  } else if (race.phase === "finished" && onlineMode) {
    ui.resultsPlace.textContent = "Did not finish";
    ui.resultsTime.textContent = "The server closed the race.";
  }
}

function liveStanding(players: readonly PublicPlayer[], selfId: string, z: number): { place: number; field: number } {
  const field = Math.max(1, players.length);
  const ahead = players.filter((player) => player.id !== selfId && player.z > z).length;
  return { place: ahead + 1, field };
}

function visualOrbs(orbs: readonly PublicOrb[], now: number): TideOrb[] {
  return tideOrbSpots.map((spot) => {
    const row = orbs.find((orb) => orb.id === spot.id);
    const at = row?.at ?? 0;
    return {
      id: spot.id,
      x: spot.x,
      z: spot.z,
      respawnIn: at > now ? (at - now) / 1000 : 0,
    };
  });
}

function applyServerLoadout(loadout: AbilityLoadout, message: LoadoutMessage, serverNow: number): AbilityLoadout {
  const remaining = Math.max(0, (message.until - serverNow) / 1000);
  const effects: RacerEffects = { ...loadout.effects };
  effects.frenzyRemaining = message.active === "flipper-frenzy" ? remaining : 0;
  effects.shieldRemaining = message.active === "shell-guard" ? remaining : 0;
  effects.shieldCharges = message.active === "shell-guard" && remaining > 0 ? shellRules.charges : 0;
  effects.sprayRemaining = message.active === "sand-spray" ? remaining : 0;
  effects.waveWindowRemaining = message.active === "wave-rider" ? remaining : 0;
  effects.trailRemaining = message.active === "magnetic-sense" ? remaining : 0;
  effects.slowRemaining = message.slowUntil > serverNow ? (message.slowUntil - serverNow) / 1000 : 0;
  effects.spinRemaining = 0;
  effects.stunRemaining = 0;
  return { held: message.held, spare: null, effects };
}

function showServerAbility(loadout: AbilityLoadout, ability: AbilityId, remaining: number): AbilityLoadout {
  const seconds = Math.max(0, remaining);
  const effects: RacerEffects = { ...loadout.effects };
  effects.frenzyRemaining = ability === "flipper-frenzy" ? seconds : 0;
  effects.shieldRemaining = ability === "shell-guard" ? seconds : 0;
  effects.shieldCharges = ability === "shell-guard" && seconds > 0 ? shellRules.charges : 0;
  effects.sprayRemaining = ability === "sand-spray" ? seconds : 0;
  effects.waveWindowRemaining = ability === "wave-rider" ? seconds : 0;
  effects.trailRemaining = ability === "magnetic-sense" ? seconds : 0;
  effects.spinRemaining = 0;
  effects.stunRemaining = 0;
  return { held: null, spare: null, effects };
}

function cueForAbility(ability: AbilityId): AbilityCue {
  if (ability === "flipper-frenzy") {
    return "frenzy";
  }
  if (ability === "shell-guard") {
    return "shield";
  }
  if (ability === "sand-spray") {
    return "spray";
  }
  if (ability === "wave-rider") {
    return "wave-arm";
  }
  return "trail";
}

function syncHealthHud(
  ui: GameUi,
  world: AbilityWorld,
  type: (typeof turtleTypes)[TurtleTypeId],
  hurt: boolean,
  onlineMode: boolean,
): void {
  const player = formatHealth(world.playerHealth, type.name);
  ui.healthLabel.textContent = player.label;
  ui.healthFill.style.width = `${player.fraction * 100}%`;
  ui.healthHud.dataset.tone = player.tone;
  ui.healthHud.dataset.hurt = String(hurt);
  const rival = formatHealth(world.rivalHealth, "Rival");
  ui.rivalHealthLabel.textContent = rival.label;
  ui.rivalHealthFill.style.width = `${rival.fraction * 100}%`;

  ui.abilitySpare.hidden = onlineMode || type.itemSlots < 2;
  const spare = onlineMode ? null : world.loadout.spare;
  ui.abilitySpare.dataset.ability = spare ?? "empty";
  ui.abilitySpare.setAttribute("aria-label", spare ? `Next: ${abilityCatalog[spare].name}` : "Second slot empty");
  ui.abilitySpareIcon.innerHTML = spare ? abilityIcon(spare) : "";

  ui.snapHud.hidden = onlineMode || type.special === null;
  if (!onlineMode && type.special) {
    const special = formatSpecial({
      kind: type.special,
      snap: world.snap,
      slam: world.slam,
      spin: world.spin,
      effects: world.loadout.effects,
    });
    ui.snapLabel.textContent = special.label;
    ui.snapFill.style.width = `${special.meter * 100}%`;
  }
}
