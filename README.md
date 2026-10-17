# baby-turtle-simulator-2
DubHacks 2026 Submission

Browser-based turtle racing prototype built with Babylon.js, TypeScript and Vite.

## Run locally

Install Node.js 22.12+ with npm. Open a terminal in your copy of this project
(the folder containing `package.json`). On this Mac:

```sh
cd /baby-turtle-simulator-2
npm ci
npm run dev -- --host 127.0.0.1
```

Wait for `npm ci` to finish successfully before starting the server. Keep the
server terminal open while playing; press **Ctrl+C** in that terminal to stop it.
On another computer, replace the `cd` path with your project's location.

Open the **Local** URL printed by Vite, normally http://127.0.0.1:5173/.
Open
http://127.0.0.1:5173/?beachPreview=1 (or select **Explore the beach preview**)
for the tropical beach asset study. Both use the same movement and finish logic.

If port 5173 is already in use, choose another port:

```sh
npm run dev -- --host 127.0.0.1 --port 5175
```

Then open http://127.0.0.1:5175/ (add `?beachPreview=1` for the beach preview).

If installation reports an npm cache permission error (`EACCES`), use a temporary
cache on macOS/Linux:

```sh
npm ci --cache /tmp/baby-turtle-npm-cache
```

If the browser reports a missing module inside `node_modules/vite`, stop the
server and wait for any running install to finish. Run `npm ci` again (with the
temporary cache option above if needed), restart the server, and reload its
printed **Local** URL. Run only one dependency installation at a time.

- Select **Start race** or press Enter for a three-second countdown.
- W / Up: crawl in the camera's direction. S / Down: move the opposite way.
  A / D or Left / Right: move sideways relative to the camera.
- Space: brake. X: use the stored Tide Orb ability. R: restart at the nest with a new countdown.
  H: show or hide the readout.
- Hold the right mouse button and drag to look around; the camera stays still while you crawl.
- Scroll to zoom. The beach preview starts facing the palms with the readout hidden;
  use H or **Show readout** for controls/status. The cinematic takes over at the finish.
- Xbox-compatible gamepad mapping remains available; press a controller button to expose it to the browser.

Both course views include the start screen, race timer, local practice rival, Tide Orbs,
ability HUD and rematch. The preview contains natural dunes, five palms sharing geometry/materials, dune grass,
weathered stones and driftwood, fine sand and reflective wet sand. A procedural sky
adds clouds and a sunrise; the ocean has animated waves, shoreline foam, reflected
sky and sunlight. The preview turtle has a patterned shell, scaled skin and tapered
flippers, using the same movement and animation controls as the placeholder.

Models, textures and sky reflections are created locally; there are no asset downloads,
new dependencies, paid services or API keys. These are browser-friendly raster effects,
not a reproduction of GTA V Enhanced's rendering system. Water animation is cosmetic:
it does not add swimming physics or change the finish coordinates.

![Production beach preview](docs/beach-realistic.jpg)

## Starship ending

Race through the pale gate in the ocean, then release the controls. In both course views:

1. Starship, its launch pad and a connected walkway rise from beneath the sea over 4.8 seconds.
2. The turtle waits for the walkway, then crawls across it and up the boarding ramp automatically.
3. The turtle folds its flippers, enters the hatch, and boards the ship.
4. A three-second countdown starts the engines, followed by liftoff.
5. The camera follows Starship into space, with Earth, clouds and stars below/behind it.

Movement, braking and look input do not drive the cinematic. **R** restarts from any
stage, including orbit, restoring the beach, turtle, normal camera and lighting.
The result screen appears after reaching space. Select **Rematch** or press Enter
to start the countdown again.
The sequence takes roughly 27 seconds after the finish and needs no further input.
There are no action descriptions or story captions; only the numeric countdown and
a small restart hint remain on screen.
The rocket, fictional boarding hatch, dock, exhaust and Earth are original procedural
artwork. There are no additional dependencies, downloaded models or paid services.

![Raised launch pad and connected boarding walkway](docs/starship-walkway.jpg)

## Seagull

Four seagulls guard the course: two on the dry sand (z = -8 and 4), one on the wet sand (z = 18) and one near the shore (z = 30). Their spots are listed in `seagullSpawns`. Rules live in `src/mob/seagull.ts`, drawing in `src/mob/createSeagull.ts`.

- It stays put until you come within 10 metres, then chases at 90% of the regular turtle's top speed on the ground under it. It gives up and flies home if it ends up 18 metres from its perch.
- A touch costs 14 health and knocks the turtle and the gull apart. Shell Guard stops the damage and the turtle's knock-back (the gull still bounces off).
- At 0 health the gull swoops in, grabs the turtle, carries it up to 22 metres back toward the nest (never past the back of the beach), sets it down, and the turtle gets 40% of its health back. The gull then ignores you for a few seconds. Controls are locked during the carry.
- Snappy's snap stuns any gull within reach for 2.5 seconds: it drops to the sand, is pushed back and cannot attack. A stunned gull also can't answer the rescue call, so a worn-out turtle waits until a gull recovers.
- The model is `public/models/seagull.glb`. It has no animation, so the gull glides rather than flapping.
- Loading it needs the official `@babylonjs/loaders` package (free, Apache-2.0, same version as Babylon core).

Credit: "Seagull" by Bwinji Shamutete (https://sketchfab.com/MangyMedusa), CC BY 4.0,
https://sketchfab.com/3d-models/seagull-dd79fddb754f47caa3145e7d184e3e58

## Milestones

The merged prototype includes scene/input/movement/finish detection, local race flow,
Tide Orb pickups and ability implementations. The optional beach study previews
environment assets without marking the complete visual or performance milestones
finished. Multiplayer and deployment remain separate work; the rival is local.

## Automated checks and production preview

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Open http://127.0.0.1:4173/?beachPreview=1 to inspect the built preview.
Tests cover input, movement, finish detection, HUD formatting, palm/hatchling geometry
budgets and validity, animation compatibility and keeping dunes out of the playable lane.
The ending tests cover automatic paths from the left/center/right of the finish,
waiting for the platform to finish rising, boarding before launch, stage order,
continuous movement, restart state and frame-time guards.
They do not prove visual quality or physical controller behavior.

For manual browser checks: inspect the palm from both sides, crawl across dry sand,
wet sand and water into the pale finish gate, watch the platform rise and automatic
boarding/countdown/launch/orbit, use R during emergence or in orbit to reset, try mouse look and
scroll zoom, and follow **Back to course** to compare with the default scene.
Physical controller and slower-device performance testing remain manual checks.
The build currently reports Vite's large-chunk warning for the Babylon.js bundle;
it succeeds, but download size and performance on lower-end devices still need work.

See MODLOG.md for the asset recipe and verification record.
