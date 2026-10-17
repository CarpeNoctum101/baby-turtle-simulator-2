import { startGame } from "./game/startGame";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const hud = document.querySelector<HTMLElement>("#hud");
const hudToggle = document.querySelector<HTMLButtonElement>("#hudToggle");

if (!canvas || !hud || !hudToggle) {
  throw new Error("The page is missing the render canvas or the control readout.");
}

try {
  const beachPreview = new URLSearchParams(window.location.search).get("beachPreview") === "1";
  const previewLink = document.querySelector<HTMLAnchorElement>("#beachPreviewLink");
  if (beachPreview && previewLink) {
    previewLink.textContent = "Beach study · Back to course";
    previewLink.href = "?";
  }
  const game = startGame(canvas, hud, hudToggle, beachPreview);

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
