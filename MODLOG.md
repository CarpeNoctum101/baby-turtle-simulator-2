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


## Blender turtle, item boxes, stable ending deck and flapping birds on main

- Integrated the earlier saved asset work into the newer main branch without replacing
  its local/online race logic, turtle types, health, specials or seagull behavior.
- The active player, practice rival and remote racer factory now use **Ocean Turtle
  by der_On, CC BY 3.0**, from the user-supplied Ocean Turtle.zip. The original archive
  stays intact. Full attribution/adaptation notes are in public/credits/ocean-turtle.txt
  and linked from the start screen. No new asset-generation service was used.
- Recovered the free-Blender conversion recipe and native Babylon assets. Four meshes
  total 9,096 triangles per racer. Painted color/eyelid textures retain the original UVs;
  Blender bakes the older object-space normal map into tangent space. Runtime asset
  files total about 2.67 MB before HTTP compression. An independent six-bone rig per
  racer uses at most two weights per vertex: body, four flippers and a sliding head.
  Snappy's existing neck/snap stretches the imported neck and moves eyes/eyelids with it.
- Preserved the procedural TMNT model, materials, tests and screenshots for future
  reference. ?turtle=tmnt selects it, and course links preserve that option. Its head
  rig also supports the newer neck interface. No Nintendo/Prime 1 models were imported.
- Restored the original Mario Kart-style question-mark boxes, shared procedural
  128x128 face texture and instanced cube/edge geometry. Preserved pickup IDs, positions,
  random abilities, inventory slots, radius and nine-second respawn, including the
  existing online protocol. Player instructions now call them item boxes.
- Fixed the ending regression: the walkway and dock settle at y=0.42, above the wave
  maximum y=0.12. The turtle rises smoothly with the final lift movement. The ending
  hides race water/finish surfaces while its horizon ocean is visible, and restart
  restores their original visibility. Near clip 0.2 improves depth precision. The hatch
  is 1.6 units wide so the larger Leatherback model clears it with folded flippers.
- The existing licensed seagull GLB has no bones or animation clips. Added weighted
  shoulder/wing pairs to its actual feathered mesh, prepared once per bird. A five-bone
  rig unfolds and flaps the wings in flight, holds them steadier in dives, and folds them
  when perched/stunned. Head/feet and unweighted body vertices stay fixed. The plain
  fallback bird also flaps. Existing chase, dive, hit and rescue rules are unchanged.
  A developer-only wing-preview.html page uses the exact game model/rig for close-ups.
- Automated: 37 files / 212 tests pass. Coverage includes finite meshes/UVs/normals,
  normalized skin weights, geometry budgets, actual flipper and wing deformation,
  independent racers, Snappy head/eye travel, large-turtle hatch clearance, item-box
  pickup/respawn, and ability glow. Client TypeScript, server TypeScript and Vite build
  pass. The existing large-chunk warning remains (main bundle about 2.69 MB / 704 kB
  gzip). Installed the dependencies already declared in the main branch's lockfile;
  package.json and package-lock.json were not changed.
- Browser: checked the imported racer, item boxes and airborne birds in the race.
  Compared two visibly different wingbeat poses and a folded perched pose in the
  close-up page; the dive pose was also inspected. Completed a beach race through
  launch/space/results and rematch. Captured emergence and consecutive walking frames:
  the settled walkway remained opaque above the sea. On the original course, selected
  Snappy, collected a box, activated Magnetic Sense and used the snap move; both HUD
  timers appeared. No console warnings/errors were observed. Physical controller,
  actual multiplayer connections, deployment and low-end performance remain untested.

Proof: docs/platform-emerging-fixed.jpg, docs/platform-settled-a.jpg,
docs/platform-settled-b.jpg, docs/bird-wingbeat-a.jpg, docs/bird-wingbeat-b.jpg.
Local commands and the free Blender regeneration command are documented in README.md.

Final browser follow-up: the original course's settled deck also stayed opaque.
Fixed a separate main-branch R-key regression: pressedOnce was called twice, consuming
its edge before the local restart branch. It is now read once per frame. A production
browser check from the walking cutscene restored the countdown, beach and turtle at
x=0/z=-24. Confirmed the saved TMNT query still renders in the newer game. All 212 tests
and both client/server TypeScript plus the production build passed after the fix.
Additional proof: docs/platform-default-course-fixed.jpg and docs/sculpted-turtle-preserved.jpg.

## Sideline humans throwing nets

- Added two original procedural beachgoers at x=-13.8/z=-5 and x=13.8/z=18,
  outside the playable lane. They wear hats, sunglasses, shirts and shorts; a
  shoulder pivot winds up and follows through when throwing. Moved the left
  thrower away from the close palm after checking the initial view.
- Pure rules in src/mob/netThrower.ts drive wind-up, locked predictive aim,
  arcing flight, landed net, cooldown and per-racer catches. A gold circle
  telegraphs the landing. Landed nets catch each racer only once, slowing speed
  and acceleration to 55% for 2.6 seconds, with a 1.2-second grace period afterward.
  No health damage or input lock. Shell Guard and Kempy's spin block a hit; a
  body slam or seagull carry prevents a catch while the turtle is off the ground.
- Rope geometry wraps caught turtles and an amber HUD status counts down the
  remaining seconds. A synthesized catch cue uses the existing Web Audio system.
  Humans/nets disappear during the ending and all timers clear on restart/rematch.
  Built before the ending captures beach visibility so orbit/reset remain safe.
- Local race only, including the practice rival. No client-only net penalties
  are sent to the authoritative online server. No packages, paid services, API
  calls or downloaded assets were added; cost $0. Static body parts merge by
  material, rope clones share geometry, and the added geometry stays below the
  tested 20,000-triangle / 35-mesh limit (including inactive ropes and reticles).
- Automated: all 40 test files / 223 tests pass, including 11 new tests for aim
  locking/dodging, cooldown, recovery/grace, shields, spin, body slam, racer hits,
  invalid frame times, off-lane human bounds, finite geometry, buffer sharing and
  visibility/reset. Client/server TypeScript and production Vite build pass.
  Existing large-chunk warning remains (about 2.70 MB / 708 kB gzip main bundle).
- Browser: drove an actual local beach race, saw arcing nets, caught both racers
  with health still 50/50, saw the player net/status expire and movement resume,
  then reached the finish and watched the platform rise and the turtle walk up
  the stable deck. R from the ending restored the course, people and fresh nets;
  the next race caught the turtle again. No console warnings/errors observed.
  Shield/dodge branches are covered by automated tests; physical controllers,
  actual online connections and low-end-device performance were not tested.

Browser proof: docs/net-caught.jpg. Local run/build commands are in README.md.
