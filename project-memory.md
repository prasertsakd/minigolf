# Project memory

Updated: 2026-10-08

## Product

Geek Lagoon is a browser-based, solo 3D mini-golf game. The production URL is `https://minigolf.aiyarafun.com/`. The current Cloudflare Pages project is `minigolf` (`minigolf-43b.pages.dev`). The interface is Thai / English; the primary game surface is a zoomable Three.js canvas with compact floating HUD widgets.

## Current game

- Geek Lagoon is the tropical course; Sunset Canyon is the desert course. Both have nine holes and Par 36. Players can choose a nine-hole round or a three-hole quick round.
- A swing uses three timing inputs: begin charging, lock power, then lock accuracy when the cursor returns to the white line. Early and late timing can affect direction and distance.
- Driver, Iron, Wedge, and Putter have different flight / roll ranges. The scale and target-power estimate are computed from the game flight model; the flag marks the actual player-to-hole distance.
- Wind speed and direction are randomized for a hole and affect ball flight. Sand, water, rough, green, and fairway also affect play.
- All 18 holes now use a per-hole, deterministic height profile for grade, cross-slope, and a rounded mound or hollow. The same height function drives the visible terrain and the ball's ground contact, so the ball follows the ground and gravity changes its roll uphill and downhill.
- Profile lets players edit their name, choose a female or male golfer, and choose one of four outfit palettes: Coral Breeze, Lagoon Green, Sky Blue, or Sunset. Profile and personal statistics are stored under the `fairway-profile` browser local-storage key.
- The scene includes procedural sky, clouds, course props, flag motion, swing animation, club-specific audio, and particle effects on a perfect shot.
- Facebook share metadata is in `index.html`; `public/og-geek-lagoon.jpg` is the 1200×630 Open Graph card.

## Code map

- `src/main.js`: app shell, UI state, controls, browser storage, course selection, audio, and the animation loop.
- `src/courses.js`: themed course records and hole layouts.
- `src/physics.js`: club data, wind, surface classification, launch, ball stepping, and flight prediction.
- `src/shot.js`: shot timing state machine, accuracy result, and golfer swing-pose timeline.
- `src/range.js`: club-specific distance scale and recommended power.
- `src/world.js`: Three.js scene, course geometry, characters, camera, flag, sky, clouds, and visual effects.
- `src/touch.js`: short single-finger tap and pinch recognition.
- `src/style.css`: responsive HUD, modal, and menu styling.
- `tests/`: Node tests for courses, physics, range, swing rig, shot timing, and touch gestures.

## Development baseline

Run `npm test` and `npm run build` after implementation changes. The current terrain and physics change passes all 27 tests and builds the Vite bundle. Build output is `dist/`; it is generated and should not be committed.

## Deployment notes

The public source repository is `https://github.com/prasertsakd/minigolf`; local `main` tracks `origin/main`. The original Geek Lagoon code and project-created game assets are under the MIT License; third-party dependencies keep their own licenses.

`npm run deploy` builds and uploads `dist/` with Wrangler to the Cloudflare Pages project `minigolf` on branch `main`. The current project uses Direct Upload; Cloudflare Git integration is not configured. Commit `1298f87` was deployed to production through the Cloudflare Pages dashboard on 2026-10-08; `https://minigolf.aiyarafun.com/` loaded the updated game successfully. Do not store Cloudflare tokens in the repository. If CLI authentication is unavailable, the dashboard upload flow has been used successfully.

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
