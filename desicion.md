# Decision log

This file records the current product and technical choices as of 2026-10-08.

## Product identity and hosting

- The game name is **Geek Lagoon**. Production is hosted at `minigolf.aiyarafun.com` on the Cloudflare Pages project `minigolf`.
- The game is a standalone solo experience. It does not connect to the reference golf game's accounts, rooms, or multiplayer services.

## Rendering and interface

- Vite and Three.js are used for a full-screen, zoomable 3D course; the course view remains the dominant part of the screen.
- Hole details, wind, and shot controls are floating HUD widgets. Keep them compact so they do not obscure the course.
- Course art, sky, clouds, flags, and golfer meshes are created procedurally in the app. The share card is a static image because social crawlers need a stable image URL.

## Gameplay

- A shot follows a three-stage Pangya-style input: start power charge, lock power, then press at the returning accuracy line. The game has no separate manual swing button or range slider.
- Club-specific range is calculated from the same flight and roll prediction used by gameplay. The flag on the power scale represents the actual distance from the current ball position to the hole.
- Wind varies by hole and influences shot flight; surfaces and hazards influence the final result.
- Two distinct nine-hole courses are included: tropical Geek Lagoon and desert Sunset Canyon. Both also support three-hole quick rounds.

## Profile and persistence

- Player name, golfer character, outfit palette, sound preference, rounds played, and personal best are stored locally in the browser under `fairway-profile`.
- The available golfer choices are female and male. Outfit choices are Coral Breeze, Lagoon Green, Sky Blue, and Sunset.

## Share cards

- `index.html` defines canonical, Open Graph, and Twitter large-image metadata for `https://minigolf.aiyarafun.com/`.
- The social preview image is a 1200×630 JPEG at `/og-geek-lagoon.jpg`, generated for this project and included in the Vite `public/` assets.

## Delivery

- The existing Cloudflare Pages project uses Wrangler Direct Upload. Deploys target `main`; no Git remote or Cloudflare Git integration is configured in this checkout.
- Keep credentials and local secrets outside Git. `npm test` and `npm run build` are the baseline checks before deployment.
