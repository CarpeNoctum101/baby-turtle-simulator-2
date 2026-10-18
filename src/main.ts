import { startGame, type GameUi } from "./game/startGame";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const hud = document.querySelector<HTMLElement>("#hud");
const hudToggle = document.querySelector<HTMLButtonElement>("#hudToggle");
const startScreen = document.querySelector<HTMLElement>("#startScreen");
const startButton = document.querySelector<HTMLButtonElement>("#startRace");
const countdown = document.querySelector<HTMLElement>("#countdown");
const raceTimer = document.querySelector<HTMLElement>("#raceTimer");
const results = document.querySelector<HTMLElement>("#results");
const resultsTime = document.querySelector<HTMLElement>("#resultsTime");
const resultsPlace = document.querySelector<HTMLElement>("#resultsPlace");
const rematchButton = document.querySelector<HTMLButtonElement>("#rematch");
const abilityHud = document.querySelector<HTMLElement>("#abilityHud");
const abilitySlot = document.querySelector<HTMLElement>("#abilitySlot");
const abilityIconBox = document.querySelector<HTMLElement>("#abilityIcon");
const abilityTimer = document.querySelector<HTMLElement>("#abilityTimer");
const abilityTimerLabel = document.querySelector<HTMLElement>("#abilityTimerLabel");
const abilityMeterFill = document.querySelector<HTMLElement>("#abilityMeterFill");

const byId = (id: string) => document.querySelector<HTMLElement>(`#${id}`);
const healthHud = byId("healthHud");
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
  startButton &&
  countdown &&
  raceTimer &&
  results &&
  resultsTime &&
  resultsPlace &&
  rematchButton &&
  abilityHud &&
  abilitySlot &&
  abilityIconBox &&
  abilityTimer &&
  abilityTimerLabel &&
  abilityMeterFill &&
  healthHud &&
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
        startButton,
        countdown,
        raceTimer,
        results,
        resultsTime,
        resultsPlace,
        rematchButton,
        abilityHud,
        abilitySlot,
        abilityIcon: abilityIconBox,
        abilityTimer,
        abilityTimerLabel,
        abilityMeterFill,
        healthHud,
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
  const beachPreview = new URLSearchParams(window.location.search).get("beachPreview") === "1";
  const previewLink = document.querySelector<HTMLAnchorElement>("#beachPreviewLink");
  if (beachPreview && previewLink) {
    previewLink.textContent = "Beach study · Back to course";
    previewLink.href = "?";
  }
  const game = startGame(canvas, ui, beachPreview);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  ui.hud.textContent = `Could not start the 3D scene. ${message}`;
  console.error(error);
}
