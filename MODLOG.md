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

## Stable sea platform and fallen coconuts

- Raised the complete arrival walkway and launch deck to y=0.42, above the animated
  ocean's maximum y=0.12. The turtle is carried upward smoothly in the final part of
  emergence, then follows the raised deck and ramp. Shared route/mesh heights keep the
  feet aligned. The cinematic near clip is 0.2 for better depth precision.
- The ending now disables the race water and finish-zone surfaces while its larger sea
  is visible. This prevents coplanar water surfaces on the default course. Reset restores
  the captured mesh visibility, camera and lighting as before.
- Added 20 original procedural fallen coconuts: four near each preview palm, with a
  locally generated 64×64 husk texture and three dark pores. All share one instanced
  mesh and materials. Complete coconut bounds stay at least 0.7 units outside the track.
- Automated: 22 files / 100 tests pass. Tests cover the raised route, smooth turtle lift,
  complete coconut bounds and shared geometry. TypeScript and production build pass;
  the existing bundle-size warning remains (main bundle 1.53 MB / 396 kB gzip).
- Browser: inspected coconuts beside the left palm from the track edge; ran the beach
  race through emergence, walking, launch and orbit without console warnings/errors.
  Compared three successive default-course walking frames: the deck remained opaque
  above the water. R restored x=0/z=-24, race countdown and original camera/lighting.
  Physical controller and lower-end-device performance remain unverified.

Screenshots: `docs/palm-coconuts.jpg`, `docs/ending-stable-platform.jpg`.
No new dependencies, external assets, services or API costs. Budget remains $0.

## Question-mark item boxes and cybernetic racers

- Replaced the five orb visuals with original Mario Kart–style question-mark cubes.
  One shared 128×128 procedural RGB texture supplies colorful faces and a pixel glyph;
  merged gold edge geometry shares an instanced mesh (156 triangles). Explicit face UVs
  keep the question marks upright on the four vertical sides. Boxes hover and rotate.
- Kept the existing pickup IDs/positions, collision radius, random ability pool, full
  inventory behavior and nine-second respawn. The internal TideOrb state type remains
  compatible; visible instructions now call the pickups item boxes.
- Both course views now use original Cyberpunk 2077–inspired hatchlings. The existing
  detailed body/flipper rig carries dark metallic shell plates, cyan circuits, yellow
  trim, a luminous visor, rear lights and armor attached to each animated flipper.
  The rival has magenta circuits and distinct node/material names. These are locally
  made designs; no Nintendo or CD Projekt game files, models or textures were imported.
- Ability flashes still affect skin/shell materials; separate neon accent materials
  stay lit. The original movement, race flow, local rival AI, camera, finish detection,
  sea lift, rocket boarding and rematch remain in place.
- Automated: 24 files / 104 tests pass. New checks cover box pickup/respawn visibility,
  unchanged locations, cube geometry budget, cyber armor/flipper parenting, finite
  geometry below 40k triangles per racer, separate rival identity/materials and ability
  glow compatibility. TypeScript and production build pass. The existing Vite chunk
  warning remains (main bundle approximately 1.53 MB / 396 kB gzip).
- Production browser: checked upright question marks, animation, collection, hiding
  only the collected box, Sand Spray activation, subsequent respawn, cyber visor and
  neon appearance, a full race through automatic boarding/launch/orbit, and rematch.
  Also checked default-course startup. No console errors or warnings were observed.
  Physical controller, multiplayer, deployment and lower-end performance were not tested.

Screenshots: `docs/cyber-item-boxes.jpg`, `docs/cyber-turtle-front.jpg`,
`docs/cyber-starship-boarding.jpg`. No new dependencies, paid APIs or costs.

## Sculpted mutant turtle racers

- Replaced the active cybernetic model with an original crouching humanoid turtle,
  using the user's [Prime 1 Studio TMNT statue reference](https://www.prime1studio.com/series/tmnt).
  Studied the [Leonardo](https://www.prime1studio.com/tmnt2-leonardo/PMTMNT-04.html)
  and [Raphael](https://www.prime1studio.com/tmnt2-raphael/PMTMNT-03.html) product pages
  for muscular proportions, natural surface detail, blue/red masks and practical gear.
  No statue images, models, textures or game files were imported into the game.
- Built muscular shoulders, arms, fingers, crouched legs, two-toed feet, a muzzle,
  narrow eyes, nostrils and a cheek scar from local procedural geometry. Added raised
  shell scutes and seams, beveled chest plates, stitched leather harnesses, buckles,
  elbow/knee pads, woven masks and weathered wraps. The player wears blue; the rival red.
- Generated small PBR maps locally: pebbled green skin, shell growth/wear, tan chest
  plates, cracked leather and woven cloth. Merged static pieces by material and limb
  pieces around their animation pivots. Each racer stays below 35k triangles and
  24 meshes; no new dependencies, external asset services or costs.
- Added alternating arm/leg strides without changing movement or camera logic.
  Arms fold during the final approach and stay tucked through boarding. Preview racers
  both cast shadows. Removed the preview's raised starting discs because they clipped
  the new feet; the logical movement surface and original course stay unchanged.
- Automated: 25 files / 107 tests pass. New checks cover finite mesh data, geometry
  budgets, opposite leg strides, separate rival identity/materials, ability glow and
  actual transformed vertex clearance inside the rocket doorway. TypeScript and the
  production build pass. The existing Vite chunk warning remains (main bundle about
  1.53 MB / 397 kB gzip).
- Production browser: inspected the front, shell, materials and shadows; checked
  keyboard movement, camera zoom, question-mark box collection and Flipper Frenzy
  activation. Completed the beach race through platform emergence, automatic walking,
  folded boarding, countdown, launch and space/results. Steering did not divert the
  ending. Rematch restored the turtle, beach, camera and countdown at x=0/z=-24.
  Also checked original-course startup and keyboard movement. No browser console
  warnings or errors were observed. Physical controller, multiplayer,
  deployment and lower-end-device performance remain untested.

Screenshots: `docs/sculpted-turtle-front.jpg`, `docs/sculpted-turtle-boarding.jpg`.
This is a procedural game model inspired by the reference, not a scan of a statue.

## User-supplied Blender sea turtle

- Made the turtle from `Ocean Turtle.zip` the default racer in both course views.
  The archive contains `turtle.blend`, five original texture maps and its attribution
  license: **Ocean Turtle by der_On, CC BY 3.0**, source recorded in the archive as
  http://www.blendswap.com/blends/view/67541. The archive stays untouched. Full license
  and adaptation notes are in `public/credits/ocean-turtle.txt`; the start screen links
  to those credits. This asset supersedes the earlier self-created-only character choice
  at the user's request; environment artwork remains procedural.
- Preserved `createSculptedTurtle.ts`, `createSculptedMaterials.ts`, their tests and
  screenshots as the TMNT reference. `?turtle=tmnt` loads that model; combining it with
  `?beachPreview=1` keeps the tropical environment. Course links preserve the selection.
- Added a reproducible local free-Blender converter, `scripts/export_ocean_turtle.py`.
  It opens the 2013 Blender file with embedded scripts disabled, uses subdivision level
  1, preserves the original UVs/eyes/eyelids and converts Blender Z-up/+Y forward into
  Babylon Y-up/+Z forward with the ground pivot at y=0. It adjusts the flipper rest pose
  for crawling, adds smooth body/flipper weights and writes native Babylon vertex data.
  Four material meshes total **9,096 triangles / 5,552 vertices per racer**. All are opaque;
  geometry is retained in 3D rather than rendered to a sprite sheet.
- Converted the original object-space normal map to a 1024×1024 tangent-space map with
  Blender's CPU normal bake. The original painted color atlas is compressed as a
  2048×2048 JPEG; the eyelid atlas is 128×128. Runtime asset files total about 2.67 MB
  before HTTP compression. Textures share Babylon's URL cache; each racer has independent
  materials and a five-bone rig, with at most two weights per vertex.
- The existing animation drives weighted shoulder/hip pivots. Skin and shell still
  receive ability flashes, and flippers fold on approach to the rocket hatch. Existing
  movement, camera, pickups, ability rules, finish coordinates and ending state machine
  are unchanged. No model-loader dependency, paid service, API, or cost was introduced.
- Automated: **26 test files / 111 tests pass**. Added valid UV/normal/weight/index and
  <10k-triangle budget checks, actual skinned flipper deformation with stationary body
  vertices, independent rival rigs/materials, folded doorway clearance, and ability
  glow apply/clear coverage. TypeScript and production build pass. Vite still warns
  about the large main bundle (about 2.19 MB / 587 kB gzip, including vertex data).
- Production browser: inspected the imported turtle from the front and rear, textures,
  shadows and scroll zoom; drove to a question-mark box and activated Shell Guard.
  Completed the race through automatic walking, folded boarding, countdown, launch
  and space/results. Held steering did not divert the cutscene. Rematch restored
  x=0/z=-24, the turtle, beach and countdown. Also opened the saved TMNT view and
  confirmed its original racer remains present. No console warnings or errors were
  observed. Physical controller, multiplayer, deployment and low-end performance
  remain untested.

Screenshots: `docs/ocean-turtle-front.jpg`, `docs/ocean-turtle-boarding.jpg`.
Run normally with `npm run dev -- --host 127.0.0.1`. Rebuild the imported asset with
the exact Blender command in README.md; no conversion is needed to play.
