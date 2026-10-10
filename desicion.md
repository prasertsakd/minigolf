# Decision log

This file records the current product and technical choices as of 2026-10-09.

## Product identity and hosting

- The game name is **Geek Lagoon**. Production is hosted at `minigolf.aiyarafun.com` on the Cloudflare Pages project `minigolf`.
- The game supports solo rounds and its own online rooms for 2–4 players. It does not connect to the reference golf game's accounts, rooms, or multiplayer services.

## Rendering and interface

- Vite and Three.js are used for a full-screen, zoomable 3D course; the course view remains the dominant part of the screen.
- Hole details, wind, and shot controls are floating HUD widgets. Keep them compact so they do not obscure the course.
- Course art, sky, clouds, flags, and golfer meshes are created procedurally in the app. The share card is a static image because social crawlers need a stable image URL.

## Gameplay

- A shot follows a three-stage Pangya-style input: start power charge, lock power, then press at the returning accuracy line. The game has no separate manual swing button or range slider.
- Club-specific range is calculated from the same flight and roll prediction used by gameplay. The flag on the power scale represents the actual distance from the current ball position to the hole.
- Wind varies by hole and influences shot flight; surfaces and hazards influence the final result.
- Every designed hole has its own deterministic, smooth height profile (overall grade, crossfall, and one rounded mound or dip). Rendered course meshes and gameplay share the same terrain function; rolling shots use terrain gradients for gravity and stay in contact with the heightfield.
- Two distinct nine-hole courses are included: tropical Geek Lagoon and desert Sunset Canyon. Both also support three-hole quick rounds.

## Profile and persistence

- Player name, golfer character, outfit palette, sound preference, rounds played, and personal best are stored locally in the browser under `fairway-profile`.
- The available golfer choices are female and male. Outfit choices are Coral Breeze, Lagoon Green, Sky Blue, and Sunset.
- Put name, character and outfit controls directly on the entry screen, before all three play modes. Reuse the actual procedural rig for a static outfit preview; dispose its renderer when leaving that screen. Invitations must allow profile setup before sending a join request. Use shared palettes in `src/profile.js` for both the entry screen and the game.
- Detailed golfer geometry lives in `src/golfer.js`. Keep the cartoon proportions and the shared swing rig: the female has a visor / ponytail / pleated skirt, and the male has a paneled cap / polo / belted trousers. Static details are batched per material inside a moving rig group; never batch animated joint nodes into a static parent mesh. Keep each golfer below 64 drawable meshes and 22,000 triangles.

## Share cards

- `index.html` defines canonical, Open Graph, and Twitter large-image metadata for `https://minigolf.aiyarafun.com/`.
- The social preview image is a 1200×630 JPEG at `/og-geek-lagoon.jpg`, generated for this project and included in the Vite `public/` assets.

## Delivery

- The public source repository is `https://github.com/prasertsakd/minigolf`. The `main` branch tracks `origin/main`.
- The original Geek Lagoon code and project-created game assets use the MIT License. Third-party dependencies retain their own licenses.
- The existing Cloudflare Pages project uses Wrangler Direct Upload. Cloudflare Git integration is not configured; the GitHub source repository does not change the deployment flow.
- Keep credentials and local secrets outside Git. `npm test` and `npm run build` are the baseline checks before deployment.

## Terrain visibility and scenery

- The island foundation must contain only vertical perimeter faces; never add a flat top over the shared heightfield. A regression test verifies this on all 18 holes.
- Keep tropical visual upgrades procedural and dependency-free in src/environment.js. Shoreline scenery is decorative. Playable small rocks are generated separately in physics.js with a deterministic seed derived from the hole and are rendered from that exact layout. Keep them away from tees, cups, sand and water; use swept rounded-rock collision, including a small hop and reflection against the contact normal. Prediction and authoritative room play must use the same obstacles.

## Mobile input and audio

- A one-finger horizontal course drag changes aim; vertical drags and two-finger pinches do not. Pinch stays zoom-only. On mobile, the dedicated shot button starts charge; a short course tap or the button locks power and then accuracy. A drag, pinch, vertical gesture or compatibility click never advances the shot. Suppress touch compatibility clicks for 800 ms after release; desktop mouse clicks and keyboard Space retain the same three-stage flow.
- Initialize/resume the shared Web Audio context synchronously inside a trusted pointer/touch/key gesture, before delayed swing or WebSocket effects. Retry both suspended and interrupted states on subsequent gestures and rebuild closed contexts. Respect the stored sound preference; do not attempt to bypass browser autoplay policy.
- Surface particles follow physics impact events, with different palettes, shapes and lifetimes for water, sand, grass and rocks. Use bounded instancing and reused puff/ripple pools. Keep the water impact position visible for 0.9 seconds before the server/solo penalty reset.

## Multiplayer architecture and behavior

- Use one full-screen shared course with visible peer golfers, colored balls and names. The user's later direction supersedes split-screen. Each player controls only their own shots; balls do not collide.
- Keep the local three-stage meter responsive, but make the room server authoritative for ball physics, common wind, strokes, water penalties, 12-stroke limits, and hole progression. Validate commands and deduplicate shot IDs; clients cannot upload positions or scores.
- Use a Cloudflare Worker with a directory Durable Object and one SQLite Durable Object per room. WebSockets authenticate with random per-player tokens sent in the first message, kept in tab session storage. No external game services or new client dependencies are involved.
- A host starts with at least two connected, ready players. Once started, no late joins. Finished golfers wait until everyone finishes; a four-second shared countdown advances all clients to the next hole or final results.
- Preserve the creator as host during initial connection even if guest WebSockets authenticate first. Transfer hosting after an actual host departure or disconnect.
- Reconnect preserves a player's state for 60 seconds. Departed / expired players no longer block the barrier and take the 12-stroke cap on unfinished holes. Transfer hosting to a connected member; remove inactive rooms after 20 minutes with no connected sockets.
- Keep static Pages delivery and deploy only `/api/*` to the room Worker. A Pages-only upload cannot provision multiplayer. Local development uses a Vite proxy to Wrangler on port 8790; a separate integration test uses four real sockets through that runtime.
- Carry the most recent eight surface-impact events per player in the existing server snapshots, with monotonic IDs that survive water resets and reset per hole. Clients deduplicate them and skip historical bursts on initial/reconnected state; cosmetic particles do not simulate ball movement. Coalesce drag aim traffic to at most 10 Hz and include the final aim in every shot.
- The game and room Worker are deployed to production as of 2026-10-09; four-player three-hole WebSocket integration, reconnect, waiting and final score checks passed against the live domain.

