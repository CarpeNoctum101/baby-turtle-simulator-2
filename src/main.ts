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
const rematchButton = document.querySelector<HTMLButtonElement>("#rematch");

const ui: GameUi | null =
  canvas && hud && hudToggle && startScreen && startButton && countdown && raceTimer && results && resultsTime && rematchButton
    ? { hud, hudToggle, startScreen, startButton, countdown, raceTimer, results, resultsTime, rematchButton }
    : null;

if (!canvas || !ui) {
  throw new Error("The page is missing the race screen.");
}

try {
  const game = startGame(canvas, ui);

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
