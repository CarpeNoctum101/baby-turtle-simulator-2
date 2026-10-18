# Baby Turtle Simulator 2
**DubHacks 2026** · a browser race from nest to ocean, then into orbit.
## What inspired us
Hatchling sea turtles already live in a race. They leave the nest, cross a hostile beach, and try to reach the water before the world catches them. That story is cinematic on its own. We wanted the player to *feel* small: not a car with a shell glued on, but a body that crawls, leans into sand, and only later gets to fly.
The arcade half of the idea came from Mario Kart. Random pickups, a rival on your shell, a finish that matters. Mixing that with wildlife was the joke we took seriously. The finish was the other joke we took seriously: after you reach the sea, a Starship-shaped rocket rises out of the water, the turtle boards it, and the camera follows it into space. Dawn beach, then vacuum. Same browser tab.
The constraint that shaped every choice was the budget: **\$0**. No asset store, no paid image APIs, no hosting upgrades. If we could not build it in TypeScript, free Blender, and a static Vite bundle, it did not ship.
## What we learned
A 3D game in the browser is not a desktop engine with a URL. Every mesh, texture, and shader has to download, compile, and stay inside a frame budget that a laptop tab will actually keep.
We learned that **game feel is mostly state machines plus a little physics**, not a giant simulation. Crawl speed depends on throttle, brake, and surface. Heading has inertia. The camera is a follow rig with a yaw/pitch look offset, so “forward” is always “the way you are looking,” not “the way the model is facing.” That one decision made keyboard and gamepad share the same movement code.
## How we built it
The stack is small on purpose:
- **TypeScript** for movement, race flow, abilities, and the ending
- **Babylon.js** for the scene, materials, skinning, and WebGL2
- **Vite** for the dev server and static production build
- **Vitest** for the logic we could prove without a GPU
- **Blender** (free, background, autoexec off) only to convert the licensed turtle
The first playable loop was unglamorous: a beach, a nest at \(z = -24\), a pale finish gate in the sea, WASD, a countdown, and restart on **R**. After that we stacked systems instead of rewriting the world.
**Movement** is an integration step, not a physics engine. Each frame we read keyboard and gamepad, combine them, then step position on the course height field.
**Abilities** sit on a tiny world step of their own. Five spinning question-mark boxes share one mesh and a 128×128 procedural texture. Collecting one rolls a random ability. **X** fires it. Flipper Frenzy speeds you up. Shell Guard eats one hit. Sand Spray blinds a rival *behind* you, which taught us that “behind” has to be defined in turtle space, not world \(z\). Boxes hide for nine seconds and come back. The old internal name is still `TideOrb` because renaming the save format was not the race.
**The turtle** went through several bodies: a placeholder, a detailed procedural hatchling, a cyber racer, a TMNT-inspired sculpt (`?turtle=tmnt`), and finally the converted Ocean Turtle as default. Animation stayed the same contract: a root, a visual, four flipper bones. Skin weights turn a swimming rest pose into a crawl and a folded hatch pose. Four material meshes, \(9{,}096\) triangles, no extra model-loader package.

## Challenges we faced
**The ending kept intersecting the sea.** Early versions of the walkway sat in the waves. Coplanar water from the race *and* the cinematic flashed. The fix was not more bloom. It was raising the deck, hiding race water while the larger sea is up, and carrying the turtle on the same \(y\) the meshes use.
**Performance is still unpaid debt.** Vite warns that the main chunk is large (Babylon plus vertex data). We instance palms, share item-box geometry, freeze static world matrices, and cap the shadow map, but we have not claimed a frame-rate target on a low-end machine. We did not test a physical controller in this pass either. Keyboard, mouse look, and the automated tests are what we can stand behind.
## What we would do next

Server-authoritative 4–8 player races on the free Cloudflare tier, once the single-player race is the one we want people to share. After that: smaller downloads, real controller QA, and audio that matches the flippers instead of sitting in a file unused.