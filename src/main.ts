import { startGame, type GameUi } from "./game/startGame";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const hud = document.querySelector<HTMLElement>("#hud");
const hudToggle = document.querySelector<HTMLButtonElement>("#hudToggle");
const startScreen = document.querySelector<HTMLElement>("#startScreen");
const homeStep = document.querySelector<HTMLElement>("#homeStep");
const modeStep = document.querySelector<HTMLElement>("#modeStep");
const onlineStep = document.querySelector<HTMLElement>("#onlineStep");
const joinStep = document.querySelector<HTMLElement>("#joinStep");
const setupStep = document.querySelector<HTMLElement>("#setupStep");
const lobbySetup = document.querySelector<HTMLElement>("#lobbySetup");
const roomCodeBlock = document.querySelector<HTMLElement>("#roomCodeBlock");
const roomCodeLabel = document.querySelector<HTMLElement>("#roomCodeLabel");
const playButton = document.querySelector<HTMLButtonElement>("#playButton");
const chooseLocalButton = document.querySelector<HTMLButtonElement>("#chooseLocal");
const chooseOnlineButton = document.querySelector<HTMLButtonElement>("#chooseOnline");
const openJoinButton = document.querySelector<HTMLButtonElement>("#openJoin");
const backToHomeButton = document.querySelector<HTMLButtonElement>("#backToHome");
const backFromOnlineButton = document.querySelector<HTMLButtonElement>("#backFromOnline");
const backFromJoinButton = document.querySelector<HTMLButtonElement>("#backFromJoin");
const backToModeButton = document.querySelector<HTMLButtonElement>("#backToMode");
const startButton = document.querySelector<HTMLButtonElement>("#startRace");
const countdown = document.querySelector<HTMLElement>("#countdown");
const raceTimer = document.querySelector<HTMLElement>("#raceTimer");
const results = document.querySelector<HTMLElement>("#results");
const resultsTitle = document.querySelector<HTMLElement>("#resultsTitle");
const resultsTime = document.querySelector<HTMLElement>("#resultsTime");
const resultsPlace = document.querySelector<HTMLElement>("#resultsPlace");
const resultsTable = document.querySelector<HTMLElement>("#resultsTable");
const rematchButton = document.querySelector<HTMLButtonElement>("#rematch");
const abilityHud = document.querySelector<HTMLElement>("#abilityHud");
const abilitySlot = document.querySelector<HTMLElement>("#abilitySlot");
const abilityIconBox = document.querySelector<HTMLElement>("#abilityIcon");
const abilityTimer = document.querySelector<HTMLElement>("#abilityTimer");
const abilityTimerLabel = document.querySelector<HTMLElement>("#abilityTimerLabel");
const abilityMeterFill = document.querySelector<HTMLElement>("#abilityMeterFill");
const playerName = document.querySelector<HTMLInputElement>("#playerName");
const createRoomButton = document.querySelector<HTMLButtonElement>("#createRoom");
const roomCodeInput = document.querySelector<HTMLInputElement>("#roomCode");
const joinRoomButton = document.querySelector<HTMLButtonElement>("#joinRoom");
const gateStatus = document.querySelector<HTMLElement>("#gateStatus");
const joinStatus = document.querySelector<HTMLElement>("#joinStatus");
const onlineStatus = document.querySelector<HTMLElement>("#onlineStatus");
const lobbyBar = document.querySelector<HTMLElement>("#lobbyBar");
const lobbySummary = document.querySelector<HTMLElement>("#lobbySummary");
const readyToggle = document.querySelector<HTMLButtonElement>("#readyToggle");
const startOnlineButton = document.querySelector<HTMLButtonElement>("#startOnline");
const leaveRoomButton = document.querySelector<HTMLButtonElement>("#leaveRoom");
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton");
const settingsMenu = document.querySelector<HTMLElement>("#settingsMenu");
const closeSettingsButton = document.querySelector<HTMLButtonElement>("#closeSettings");
const inputDevices = document.querySelector<HTMLFieldSetElement>("#inputChoice");

const byId = (id: string) => document.querySelector<HTMLElement>(`#${id}`);
const healthHud = byId("healthHud");
const netStatus = byId("netStatus");
const healthLabel = byId("healthLabel");
const healthFill = byId("healthFill");
const rivalHealthLabel = byId("rivalHealthLabel");
const rivalHealthFill = byId("rivalHealthFill");
const abilitySpare = byId("abilitySpare");
const abilitySpareIcon = byId("abilitySpareIcon");
const snapHud = byId("snapHud");
const snapLabel = byId("snapLabel");
const snapFill = byId("snapFill");
const crosshair = byId("crosshair");
const typePickers = Array.from(document.querySelectorAll<HTMLElement>(".typePicker"));

const ui: GameUi | null =
  canvas &&
  hud &&
  hudToggle &&
  startScreen &&
  homeStep &&
  modeStep &&
  onlineStep &&
  joinStep &&
  setupStep &&
  lobbySetup &&
  roomCodeBlock &&
  roomCodeLabel &&
  playButton &&
  chooseLocalButton &&
  chooseOnlineButton &&
  openJoinButton &&
  backToHomeButton &&
  backFromOnlineButton &&
  backFromJoinButton &&
  backToModeButton &&
  startButton &&
  countdown &&
  raceTimer &&
  results &&
  resultsTitle &&
  resultsTime &&
  resultsPlace &&
  resultsTable &&
  rematchButton &&
  abilityHud &&
  abilitySlot &&
  abilityIconBox &&
  abilityTimer &&
  abilityTimerLabel &&
  abilityMeterFill &&
  playerName &&
  createRoomButton &&
  roomCodeInput &&
  joinRoomButton &&
  gateStatus &&
  joinStatus &&
  onlineStatus &&
  lobbyBar &&
  lobbySummary &&
  readyToggle &&
  startOnlineButton &&
  leaveRoomButton &&
  settingsButton &&
  settingsMenu &&
  closeSettingsButton &&
  inputDevices &&
  healthHud &&
  netStatus &&
  healthLabel &&
  healthFill &&
  rivalHealthLabel &&
  rivalHealthFill &&
  abilitySpare &&
  abilitySpareIcon &&
  snapHud &&
  snapLabel &&
  snapFill &&
  crosshair
    ? {
        hud,
        hudToggle,
        startScreen,
        homeStep,
        modeStep,
        onlineStep,
        joinStep,
        setupStep,
        lobbySetup,
        roomCodeBlock,
        roomCodeLabel,
        playButton,
        chooseLocalButton,
        chooseOnlineButton,
        openJoinButton,
        backToHomeButton,
        backFromOnlineButton,
        backFromJoinButton,
        backToModeButton,
        startButton,
        countdown,
        raceTimer,
        results,
        resultsTitle,
        resultsTime,
        resultsPlace,
        resultsTable,
        rematchButton,
        abilityHud,
        abilitySlot,
        abilityIcon: abilityIconBox,
        abilityTimer,
        abilityTimerLabel,
        abilityMeterFill,
        playerName,
        createRoomButton,
        roomCodeInput,
        joinRoomButton,
        gateStatus,
        joinStatus,
        onlineStatus,
        lobbyBar,
        lobbySummary,
        readyToggle,
        startOnlineButton,
        leaveRoomButton,
        settingsButton,
        settingsMenu,
        closeSettingsButton,
        inputDevices,
        healthHud,
        netStatus,
        healthLabel,
        healthFill,
        rivalHealthLabel,
        rivalHealthFill,
        abilitySpare,
        abilitySpareIcon,
        snapHud,
        snapLabel,
        snapFill,
        crosshair,
        typePickers,
      }
    : null;

if (!canvas || !ui) {
  throw new Error("The page is missing the race screen.");
}

try {
  const params = new URLSearchParams(window.location.search);
  const beachPreview = params.get("beachPreview") !== "0";
  const turtleModel = params.get("turtle") === "tmnt" ? "tmnt" : "ocean";
  const previewLink = document.querySelector<HTMLAnchorElement>("#beachPreviewLink");
  if (previewLink) {
    if (beachPreview) {
      previewLink.hidden = true;
    } else {
      previewLink.textContent = "Good graphics";
      previewLink.href = turtleModel === "tmnt" ? "?turtle=tmnt" : "?";
    }
  }
  const game = startGame(canvas, ui, beachPreview, turtleModel);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  ui.hud.hidden = false;
  ui.hud.textContent = `Could not start the 3D scene. ${message}`;
  console.error(error);
}
