import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createSeagullMobs } from "../mob/createSeagull";
import { createSeagull } from "../mob/seagull";

// Developer-only close-up using the exact same model and animation as the race.
const engine = new Engine(document.querySelector<HTMLCanvasElement>("#wings")!, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.72, 0.79, 0.84, 1);
const camera = new FreeCamera("wingCheckCamera", new Vector3(0, 1.5, 3.1), scene);
camera.setTarget(new Vector3(0, 1.05, 0));
new HemisphericLight("wingCheckLight", Vector3.Up(), scene).intensity = 1.3;
const gull = { ...createSeagull("wing-check", { x: 0, z: 0 }, true), y: 1.1, heading: 0 };
const birds = createSeagullMobs(scene, [gull]);
document.querySelector("#flight")!.addEventListener("click", () => { gull.y = 1.1; gull.phase = "chase"; });
document.querySelector("#perch")!.addEventListener("click", () => { gull.y = 0.56; gull.phase = "perched"; });
document.querySelector("#dive")!.addEventListener("click", () => { gull.y = 1.1; gull.phase = "dive"; });
let time = 0;
engine.runRenderLoop(() => { time += Math.min(engine.getDeltaTime() / 1000, 0.05); birds.sync([gull], time); scene.render(); });
window.addEventListener("resize", () => engine.resize());
