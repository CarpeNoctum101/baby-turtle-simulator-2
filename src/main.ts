import { startGame } from "./game/startGame";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const status = document.querySelector<HTMLElement>("#status");

if (!canvas || !status) {
  throw new Error("The page is missing the render canvas or status message.");
}

try {
  const game = startGame(canvas);
  status.textContent =
    "Prototype scene is running. Drag to orbit the turtle. Scroll to zoom. The turtle does not move yet.";

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  status.textContent = `Could not start the 3D scene. ${message}`;
  console.error(error);
}
