import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { createThirdPersonCamera } from "../camera/createThirdPersonCamera";
import { createBeachScene } from "../scene/createBeachScene";
import { createPlaceholderTurtle } from "../turtle/createPlaceholderTurtle";

export interface RunningGame {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

/** Builds the milestone 1 scene and starts drawing it every frame. */
export function startGame(canvas: HTMLCanvasElement): RunningGame {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = createBeachScene(engine);
  const turtle = createPlaceholderTurtle(scene);
  createThirdPersonCamera(scene, turtle);

  engine.runRenderLoop(() => {
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
      scene.dispose();
      engine.dispose();
    },
  };
}
