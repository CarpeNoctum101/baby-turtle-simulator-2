# Tropical beach asset study

## Scope and milestone status

The existing prototype covers the scene, input, movement and finish detection (milestones 1–3).
Race flow/pickups (4) and initial abilities (5) are still pending. This is an opt-in asset
study at `?beachPreview=1`, not completion of milestones 6 or 8. The default course is retained.

## Asset contract (Universal Modder asset-pipeline guidance)

- Inspected existing course ground, nest/pebbles and placeholder turtle before creating assets.
- Native format: Babylon.js meshes and materials created in TypeScript, not raster sprites.
- Coordinates: Y up, +Z toward the ocean, metre-scale scene. Palm pivot is at ground level.
- Palm: one 5.6-metre curved trunk, 13 arched fronds with paired geometric leaflets.
  Base sits outside the course at x = -9.4, z = -10; no new gameplay collision.
- Original texture data: 512×512 RGB tiled sand color and tangent-space normal maps,
  plus a 256×256 RGB bark map. Mipmaps enabled; sand uses four-metre world-aligned tiles.
- Leaf silhouettes use opaque, double-sided geometry. No alpha sorting or sprite conversion.
- Style: warm dawn, fine rippled dry sand, darker smoother wet sand, muted green foliage.
- No downloaded assets, new dependencies, generation APIs, credentials or costs.

## Reproducible recipe

`src/scene/beachPreview/` contains the complete source recipe. Textures are generated once
at scene creation. Ribs, leaflets, grass and coconuts are batched into shared meshes; static
world matrices are frozen. Lighting uses one shadow map (up to 2048×2048) and no postprocess chain.
Scene disposal owns the generated meshes, textures, materials and shadow generator.

## Verification

Baseline before editing: 7 Vitest files / 34 tests passed. Browser showed the original
flat-color course and moving-input HUD.

Final automated checks: 8 Vitest files / 35 tests pass, including finite palm vertices/normals,
valid indices, no collision, at most 8 palm meshes and fewer than 12,000 palm triangles.
TypeScript checking and the Vite production build pass. Vite reports a large-chunk warning
(main bundle approximately 1.42 MB / 361 kB gzip); no lower-end-device benchmark is claimed.

Actual browser checks: development preview at 598×820 and production preview at 1280×720.
Inspected trunk curve/rings, layered fronds, base position, sand tiling, wet-sand contrast,
lighting and shadows. The preview starts with a wider view toward the palm (radius 9,
yaw offset 0.35, pitch offset 0.22); default camera setup and camera control code are retained.
Keyboard crawling crossed dry sand, wet sand and shallow water. Finish text appeared, and
R returned the turtle to x=0, z=-24. The production Back to course / Explore links were
checked in both directions; the default flat-color course is preserved.

Fixed during browser QA: added Babylon's required shadow-generator scene-component import,
enabled two-sided leaf lighting, and disabled self-shadow reception on the placeholder turtle
to avoid stripes on its thin flippers. It still casts a shadow onto the sand.

The final production preview has no console errors/warnings. Screenshot: `docs/beach-preview.jpg`.
Physical controller input, multiplayer, publishing and lower-end-device performance were not tested.
Mouse capture/drag behavior still needs a hands-on check; camera control implementation is unchanged.

## Second visual study: more realistic beach

Continues the same opt-in study after the user requested a more realistic visual direction.
Milestones 4/5 are still pending; no main gameplay milestone is marked complete.

- Replaced preview-only rectangular strips, box berms and raised nest with one 128×128
  subdivided beach mesh. Dunes are outside the playable lane, with a shallow nest depression.
  Dry/wet color blends use vertex colors and a 128×128 roughness map on a second UV channel.
- Added an original procedural atmosphere (clouds, low sun, haze) and 64×64-per-face sky
  cubemap for material reflections. Sand uses a dielectric PBR material, with smoother wet sand.
- Added one opaque water mesh/shader: time-driven wave geometry/normals, sky reflections,
  sunlight glitter, shore wash and breaking foam. Water is cosmetic; movement remains unchanged.
- Four additional palms reuse the original palm's geometry/materials through instances.
  Foliage uses two-sided PBR lighting and tinted translucency. Grass and stones also use
  instances, and driftwood is merged. All artwork remains original and generated locally.
- Added an opt-in detailed hatchling with original Voronoi scute/skin color and normal maps,
  a shell rim, eyes, tapered paddle flippers and a tail. The existing root/visual/four-flipper
  interface and animation are retained. Default course still uses the original turtle.
- Readout starts hidden in the preview and opens automatically on finishing. It remains
  available through H/the button. The original course retains its readout behavior.

Current verification: 10 test files / 37 tests pass; TypeScript and production build pass.
New tests bound hatchling triangles below 35,000, check finite geometry/indices/normals and
animation compatibility, and keep dune displacement out of the playable lane. The production
bundle is approximately 1.46 MB / 375 kB gzip and still produces Vite's large-chunk warning.
No device-wide frame-rate target or GTA V Enhanced visual parity is claimed.

Actual browser QA: development preview at 598×820, built preview at 1280×720. Inspected
the beach, shell detail, lighting/shadows, wet sand, ocean reflection and animation.
Completed a keyboard run to the finish in the production build; finish feedback appeared,
R returned to x=0/z=-24, and Back to course showed the original scene and turtle.
The production console has no errors or warnings. Fixed instance shadow warnings by setting
shadow reception on source meshes rather than on instances.

Latest screenshot: `docs/beach-realistic.jpg` (the first study's screenshot is retained).
No new dependencies, external assets, services, costs or credentials. Physical gamepad,
mouse capture, multiplayer, deployment and slower-device performance remain unverified.

## Starship finish celebration

User-requested scripted ending, available in both course views. It retains the ocean
finish zone and all pre-finish movement. It does not complete the remaining pickup/ability work.

- `src/game/endingState.ts` owns a deterministic timed route: finish → dock → ramp → hatch,
  then boarding, a three-second countdown, ten-second ascent, and orbit. It takes no controls.
- `src/scene/ending/` creates original stylized Starship geometry: steel hull and weld rings,
  ogive nose, half heat shield, two forward/two aft flaps, nozzles, typeset wordmark and
  a fictional accessible boarding hatch. Shape reference: https://www.spacex.com/vehicles/starship/.
  No SpaceX artwork or model files were downloaded.
- The turtle really walks the ramp and is parented inside the rocket after boarding.
  Flippers tuck to fit the hatch. The payload rises with the ship; the exterior camera
  follows it into a procedural star field and Earth with cloud cover/atmospheric rim.
- The cinematic owns a separate camera and captions. Race movement, brake and look input
  do not change it. R restores original mesh visibility, the normal camera, fog, sun,
  shadows, turtle parent/visibility, and starting motion. Captions update on stage/count
  changes rather than every frame. Scene disposal removes the overlay and ending resources.
- A temporary larger ocean horizon avoids exposing the small race environment during ascent.
  Exhaust/vapor meshes are bounded and reused, with no particle textures or asset downloads.

Current automated verification: 11 files / 42 tests pass. TypeScript and production build pass.
Five additional test cases cover left/center/right finish routes without input, stage order,
boarding-before-launch, monotonic altitude, path/ascent continuity, reset determinism and
invalid/large frame-time guards. Main bundle approximately 1.50 MB / 387 kB gzip; Vite's
large-chunk warning remains. No new packages, services, costs, secrets or paid APIs.

Actual production browser checks (1280×720): full race → automatic walk → boarding →
countdown (visible counter) → liftoff → mission complete above Earth. Held steering/brake
keys during the cinematic did not divert or stop it. R returned to x=0/z=-24 from the walk
and from orbit. The original course also reached the automatic-walk stage and reset correctly.
Development preview inspected at 598×820. No console errors or warnings in the tested build.
Physical controller, mouse capture, multiplayer, deployment and lower-end-device performance
were not tested. No real-world launch or orbital-physics accuracy is claimed.

Screenshots: `docs/starship-boarding.jpg`, `docs/starship-launch.jpg`, `docs/starship-orbit.jpg`.

## Sea lift and clean ending presentation

The ending now starts with a 4.8-second emergence. A shared transform lifts the original
rocket, thicker launch pad, support legs and connected bridge from 18 units underwater.
The tapered bridge has solid side walls and yellow edge markings. Three reused procedural
rings provide expanding surface ripples. The ocean occludes the submerged geometry.
The turtle stays at the finish until the lift is fully raised, then follows the existing
automatic ramp/hatch route. The cinematic camera frames the emergence above the water.

All action descriptions, headlines and completion badges were removed. Only the numeric
launch countdown and small R restart hint remain. Reset also restores the submerged lift
and disables the ripple meshes. No dependencies, downloaded assets, paid APIs or services
were added; the extra budget remains $0.

Automated verification: 11 files / 43 tests pass; TypeScript and production build pass.
The added test checks that the turtle waits, the lift rises continuously, and walking
starts only after the platform reaches its final height. The full ending tests still
cover all finish-lane positions, phase order, boarding, ascent and reset determinism.
Vite's existing large-chunk warning remains (main bundle about 1.50 MB / 387 kB gzip).

Actual production-browser checks at 1280×720: emergence, turtle on the connected bridge,
boarding, numeric countdown, launch and orbit. The overlay contains only the restart hint
outside countdown. Steering/braking did not divert the automatic sequence. R returned
to x=0/z=-24 from both emergence and orbit, with the beach and normal camera restored.
No browser console errors or warnings were observed. Physical controller and slower-device
performance testing remain unverified.
The default course was also checked through finish detection, emergence and reset.
The development tab was refreshed and left at the nest, ready to play.

New screenshots: `docs/starship-emerging.jpg`, `docs/starship-walkway.jpg`.
Boarding, launch and orbit screenshots were refreshed without action captions.
