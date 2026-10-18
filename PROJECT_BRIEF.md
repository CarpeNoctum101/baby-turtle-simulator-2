# Baby Turtle Simulator

## Vision

Create an original 3D browser-based multiplayer game in which baby sea turtles race across a beach to reach the ocean. Combine realistic wildlife-inspired visuals with fast, competitive, Mario Kart-style racing mechanics and abilities.

The game must run through a browser URL without requiring players to download or install a desktop game.

## Budget and licensing

The additional budget is $0. Use Cursor's included coding access, free development software and properly licensed free assets. No paid subscriptions, API credits, asset purchases or hosting upgrades.

Do not use paid AI asset-generation APIs or services that require a paid account. If a proposed feature requires payment, stop and explain a free alternative.

## Technology

- Babylon.js for browser-based 3D rendering and scene management.
- TypeScript for game logic.
- Vite for the development server and production builds.
- Browser Gamepad API for Xbox-compatible controller input.
- Keyboard fallback controls.
- Blender for optional modeling, rigging and asset editing.
- Cloudflare Pages for the static client and Cloudflare Workers with SQLite-backed Durable Objects for online multiplayer, subject to free-plan limits.

## Core race

Players start at a nesting beach. A countdown begins and the turtles crawl across a beach containing dry sand, wet sand, terrain variations, debris and other racers.

Spinning Mario Kart-style question-mark item boxes provide temporary abilities. Players use these abilities to gain speed or disrupt rivals. Players finish by reaching a defined ocean zone. Keep the existing TideOrb protocol IDs and pickup rules internally.

Local races also have two people outside the lane who throw rope nets. Telegraph
each throw with an arm wind-up and a landing circle; lock the aim at release so it
can be dodged. A catch slows crawling briefly without damage or locking controls.
Shell Guard and Kempy's spin block incoming nets. Reset clears all net state and
the hazard stops during the automatic ending. Keep this local until the online
server has matching authoritative rules. Create the people and nets procedurally.

The first version needs one polished beach course and a working start-to-finish race. Do not create an open world.

## Finish celebration

After the turtle enters the ocean finish zone, raise a procedural SpaceX Starship,
launch platform and connected boarding walkway out of the sea. The turtle waits
until the walkway is ready, then automatically crawls up the ramp, boards the rocket, and
is carried into space after a countdown. Use a cinematic camera, engine effects,
stars and a procedural Earth backdrop. No player input is needed after finishing.
Keep the cinematic free of action descriptions; show only the numerical launch
countdown and a small restart hint.

Ignore race movement/look input during the ending. R must restart the race from any
stage and restore the turtle, beach, camera and lighting. Keep the existing finish
coordinates and pre-finish controls. Use original locally created assets at $0.
This finish celebration does not mark the full race-flow/pickup or ability milestones complete.

## Movement and controller

Support an Xbox-compatible gamepad through the browser Gamepad API and a keyboard fallback.

Implement acceleration, deceleration, turn inertia, surface-dependent movement, terrain following, speed-dependent flipper animation, body motion and a smooth low-angle follow camera.

The turtle should feel like a small animal crawling rather than a car with a turtle model attached.

## Abilities

Use an extensible ability system with a HUD, pickups, cooldowns, duration, activation rules and clear visual effects.

1. **Flipper Frenzy:** Temporarily increases movement speed while the flippers animate rapidly.
2. **Shell Guard:** Briefly protects against one incoming ability effect or collision penalty.
3. **Sand Spray:** Sends a short cloud of sand behind the turtle, disrupting an approaching rival.
4. **Wave Rider:** Provides a temporary boost when the player times entry into a designated wave zone.
5. **Magnetic Sense:** Temporarily displays a navigation trail leading toward the ocean.

These are fictionalized arcade mechanics inspired by turtle anatomy and behavior, not claims that real turtles possess supernatural powers.

Use Tide Orbs to distribute abilities. First implement simple random pickups. Add position-aware balancing only after the main system works.

## Visual direction

Aim for a realistic, atmospheric beach at dawn or sunrise.

Include a detailed hatchling model, believable shell materials and flippers, textured sand, wet-sand transitions, footprints, directional lighting, environmental shadows, animated waves and shoreline foam.

Prefer a small, polished environment with optimized assets and readable ability effects over a huge, expensive-to-render world.

Use the sea turtle from the user-supplied Ocean Turtle.zip as the active racer, with
the archive's CC BY 3.0 attribution to der_On. Convert locally with free Blender and
keep the original archive. Preserve turtle types, neck/snap behavior, controls,
abilities, race flow and the automatic ending. Retain the procedural TMNT model,
materials and screenshots as a future reference; ?turtle=tmnt opens that version.
Keep the settled rocket deck above every wave and render one ocean surface during
the ending. Animate the existing seagull wings in flight, folding them when perched.

Use original work or assets whose specific licenses permit the intended use.

## Multiplayer

After the complete single-player race works, add 4–8-player races.

Use Cloudflare Workers and SQLite-backed Durable Objects with WebSockets for the free-tier multiplayer deployment. The server should manage race state, lobby membership, countdowns, pickups, ability validation and official finishing order.

The browser may interpolate remote player positions and play visual effects, but must not unilaterally determine the official winner.

Test disconnects, late joins and invalid ability uses. Use server-side validation for important events.

## UI and input

Provide a start screen, race lobby, countdown, position and ability HUD, finish results, and rematch option.

Initial controls:
- Left stick: move and steer.
- A: optional scramble action.
- B: brake or slow down.
- Right stick: camera.
- X: activate ability.
- Menu: pause or settings.

Include controller connection feedback and configurable dead zones.

## Milestones

1. Working 3D browser scene.
2. Keyboard and gamepad input.
3. Turtle movement and finish detection.
4. Race flow and Tide Orb pickups.
5. Initial abilities: Flipper Frenzy, Shell Guard and Sand Spray.
6. Realistic character and environment assets.
7. Multiplayer implementation and validation.
8. Water, lighting, audio and performance polish.
9. Free-tier deployment and public testing.

Do not skip milestones, claim unverified success, or introduce paid services without explicit approval.
