# Project memory

Updated: 2026-10-09

## Product

Geek Lagoon is a browser-based 3D mini-golf game with solo rounds and online rooms for 2–4 players. The production URL is `https://minigolf.aiyarafun.com/`. The current Cloudflare Pages project is `minigolf` (`minigolf-43b.pages.dev`). The interface is Thai / English; the primary game surface is a zoomable Three.js canvas with compact floating HUD widgets.

## Current game

- Geek Lagoon is the tropical course; Sunset Canyon is the desert course. Both have nine holes and Par 36. Players can choose a nine-hole round or a three-hole quick round.
- A swing uses three timing inputs: begin charging, lock power, then lock accuracy when the cursor returns to the white line. Early and late timing can affect direction and distance.
- Driver, Iron, Wedge, and Putter have different flight / roll ranges. The scale and target-power estimate are computed from the game flight model; the flag marks the actual player-to-hole distance.
- Wind speed and direction are randomized for a hole and affect ball flight. Sand, water, rough, green, and fairway also affect play.
- All 18 holes now use a per-hole, deterministic height profile for grade, cross-slope, and a rounded mound or hollow. The same height function drives the visible terrain and the ball's ground contact, so the ball follows the ground and gravity changes its roll uphill and downhill.
- Profile lets players edit their name, choose a female or male golfer, and choose one of four outfit palettes: Coral Breeze, Lagoon Green, Sky Blue, or Sunset. Profile and personal statistics are stored under the `fairway-profile` browser local-storage key.
- The scene includes procedural sky, clouds, course props, flag motion, swing animation, club-specific audio, and particle effects on a perfect shot. Playable rocks have a deterministic random layout per hole, shared by solo prediction, room physics and rendering; glancing contacts deflect the ball while high flights clear them. Sizes are mixed: most pebbles are 80% smaller than the original rocks, with a few medium (60% smaller) and larger (40% smaller) stones. The visible dimensions and collision dimensions share the same values.
- Water impacts spray turquoise/white drops and expanding ripples; sand emits golden grains and soft dust; ordinary ground emits grass and soil clippings; rocks emit small grey chips. A bounded instanced particle pool serves all players. Water penalties hold the impact view for 0.9 seconds before returning the ball.
- Rock density is increased from the original 16 per hole: Geek Lagoon targets 19 (about +20%) and Sunset Canyon targets 21 (about +30%, the requested extra 10% added to the original baseline). Both courses use the same mixed size distribution.
- Mobile audio is initialized/resumed directly on trusted gestures and retries after suspension/interruption. Mobile aiming uses a one-finger horizontal course drag; pinch remains zoom-only. The dedicated shot button starts charging; a short tap on the course or the button can lock power and then accuracy. Drags, pinches, vertical gestures and compatibility clicks do not advance the shot.
- Facebook share metadata is in `index.html`; `public/og-geek-lagoon.jpg` is the 1200×630 Open Graph card.

## Code map

- `src/main.js`: app shell, UI state, controls, browser storage, course selection, audio, and the animation loop.
- `src/room-game.js`: server-owned room state, simultaneous player simulations, strokes, disconnect rules, and hole barriers.
- `src/multiplayer.js`, `src/room-ui.js`: room API / WebSocket sessions, reconnect, entry modes, room list, lobby, and final rankings.
- `worker/index.js`: Cloudflare room directory and per-room Durable Objects; `worker/wrangler.toml` contains its bindings, migration, and `/api/*` route.
- `src/courses.js`: themed course records and hole layouts.
- `src/physics.js`: club data, wind, surface classification, launch, ball stepping, and flight prediction.
- `src/shot.js`: shot timing state machine, accuracy result, and golfer swing-pose timeline.
- `src/range.js`: club-specific distance scale and recommended power.
- `src/world.js`: Three.js scene, course geometry, characters, camera, flag, sky, clouds, and visual effects.
- `src/golfer.js`: original procedural female / male meshes and their articulated rig; static details are batched per material under each moving part.
- `src/touch.js`: one-finger drag aiming, timing-stage taps, pinch exclusion and suppression of touch compatibility clicks.
- `src/audio.js`: gesture-unlocked shared Web Audio output and procedural tones/noise.
- `src/surface-effects.js`: bounded surface-specific landing/obstacle particle renderer.
- `src/style.css`: responsive HUD, modal, and menu styling.
- `tests/`: Node tests for courses, physics, range, swing rig, shot timing, and touch gestures.

## Development baseline

Run `npm test` and `npm run build` after implementation changes. Unit checks cover physics, audio unlock/recovery, obstacles, effect pooling/deduplication, input and room behavior. With the local Worker running, `npm run test:multiplayer` covers a complete three-hole round using four actual WebSockets and a separate shared water-impact/reconnect check. Do not edit source files or generate builds during the integration run: a Wrangler reload can interrupt its live sockets. Build output is `dist/`; it is generated and should not be committed.

## Deployment notes

The public source repository is `https://github.com/prasertsakd/minigolf`; local `main` tracks `origin/main`. The original Geek Lagoon code and project-created game assets are under the MIT License; third-party dependencies keep their own licenses.

`npm run deploy` builds and uploads `dist/` with Wrangler to the Cloudflare Pages project `minigolf` on branch `main`. The current project uses Direct Upload; Cloudflare Git integration is not configured. Commit `6dd9bc7` was deployed to production through the Cloudflare Pages dashboard on 2026-10-08. On 2026-10-09, the current game and `geek-lagoon-multiplayer` Worker were deployed to `https://minigolf.aiyarafun.com/`; the Worker route and Durable Objects are live. Production verification covered four real WebSockets completing three holes, early-finisher waiting, reconnect, and final scores. A two-player game was also started in the browser with both golfers visible on the shared course. Do not store Cloudflare tokens in the repository. If CLI authentication is unavailable, the dashboard upload flow has been used successfully.

On 2026-10-09, Pages deployment `ed877771` published mobile course taps for the lock-power and lock-accuracy stages. Production returned HTTP 200 and served the matching `index-DH7YQx2w.js` bundle. No Worker changes were part of that release.

## Product / implementation constraints

- Keep the course canvas visually dominant; HUD stays compact and readable across viewport sizes.
- Prefer original procedural game art and behavior. Do not reuse the reference game's protected art or connect to its account / multiplayer services.
- Keep physics and timing logic testable without the browser where practical. Use injected random sources for deterministic tests of randomized behavior.
- Keep keyboard and touch controls aligned with the same three-stage shot flow.
- Treat `artifacts/` as local QA captures and deployment archives; final project assets belong in `public/` or source code.

## Tropical visual refresh

- Island sides use a perimeter skirt without a flat top cap, so terrain depressions do not hide greens, balls, or golfers. Golfer footing samples the terrain under both feet; shot effects and landing markers follow terrain height.
- Original procedural scenery adds shoreline rocks and foam, distant islands, flowers, curved palm fronds, animated ocean shading, and fine grass grain. ACES tone mapping and higher-resolution shadows give the scene more depth. Character proportions remain the existing cartoon style.
- Visual checks covered desktop and mobile HUDs plus near-green footing in both courses.

## Detailed golfers

- Both golfers retain the cartoon proportions and the original impact / swing transforms. Models now have layered eyes, eyebrows, ears, nose, smile, hair, polo collars / buttons, gloves and trimmed golf shoes with soles and laces.
- The female golfer wears a visor, tied ponytail and pleated skirt; the male golfer has a paneled cap with back adjustment, belt, trouser pockets and cuffs. All four Profile palettes recolor their clothing and matching trim.
- Static detail geometry is merged by material within each rig part. Animated knees, elbows, feet, head and club remain attached to separate moving groups; tests cover both genders, all outfit palettes, impact alignment, joint attachment and geometry budgets.

## Multiplayer rooms

- The entry screen offers Solo Player, Create Room (name, course, 2–4 capacity, 3/9 holes), and Join Room (live public list). Profile is available before entering a room. The creator remains host if invited players authenticate first; a real disconnect or departure transfers hosting. The host starts after at least two connected players are ready; open seats need not all be filled.
- The entry screen now directly exposes name, male / female character and the four outfit sets, with a static 3D preview of the actual golfer rig. The selection is saved before choosing Solo / Create / Join. Invitation links also show this setup first; restoring an existing room session retains the already joined profile.
- The latest user direction is **one full-screen shared course**, with other golfers, colored balls, name labels, and a compact room roster. Split-screen was superseded. Balls are independent and do not collide. The room model uses 2-metre lateral tee lanes to keep golfers visible.
- Clients keep responsive local charge/accuracy timing, then submit club, power, bearing and timing error. The server validates and deduplicates shots, advances the original physics at 120 Hz, and broadcasts 15 snapshots per second. Wind is shared per hole. Clients never set ball positions or scores.
- Dragged aim updates are coalesced to at most ten messages per second; shot commands always contain the final bearing. Impact effects use a bounded queue of eight monotonic event IDs per player in existing snapshots, so water resets cannot erase the splash and repeated snapshots cannot replay it.
- The 2-metre tee lanes and all obstacle/collision changes live in the room model imported by `worker/`. A Pages-only deploy does not publish these server changes. On 2026-10-09, the current audio, surface particles, touch controls, mixed rock sizes/density and tee spacing were deployed together: Worker version `d843587c-bcf2-444c-a826-ae2278c89b18` and Pages deployment `9ac2d33c`. The custom domain serves the matching `index--g8syC5h.js` build. Live checks passed a complete four-player three-hole round, waiting, reconnect, final scores, and shared water impacts that survive the penalty reset. Mobile audio recovery has browser-level coverage; a physical Samsung device has not been rechecked.
- A golfer that holes out or reaches 12 strokes waits and can watch the overview. All players advance after a shared four-second countdown. A departed player receives 12 strokes on subsequent holes and does not block progression.
- Per-tab session storage retains room credentials across reloads. Disconnect has a 60-second grace period; the host moves to another connected player. Inactive rooms are cleaned up after 20 minutes without connected players.
- Local development needs `npm run dev:server` on port 8790 plus Vite, which proxies `/api` and WebSockets. The game and Worker are deployed in production as of 2026-10-09. Four-player three-hole WebSocket integration, reconnect, waiting and final score checks passed against the live domain.
