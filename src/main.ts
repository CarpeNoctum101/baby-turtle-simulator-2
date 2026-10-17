import { startGame } from "./game/startGame";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const hud = document.querySelector<HTMLElement>("#hud");
const hudToggle = document.querySelector<HTMLButtonElement>("#hudToggle");

if (!canvas || !hud || !hudToggle) {
  throw new Error("The page is missing the render canvas or the control readout.");
}

try {
  const game = startGame(canvas, hud, hudToggle);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  hud.textContent = `Could not start the 3D scene. ${message}`;
  console.error(error);
}
