# Geek Lagoon

Geek Lagoon is a solo 3D mini-golf game that runs in the browser. It is built with Vite and Three.js, uses original procedural course art, and has a Thai / English interface.

Play at [minigolf.aiyarafun.com](https://minigolf.aiyarafun.com/).

## Features

- Two themed courses: Geek Lagoon (tropical) and Sunset Canyon (desert), each with nine holes and Par 36. Play a full nine-hole round or a short three-hole round.
- Three-stage Pangya-style timing: start the power meter, lock power, then press when the cursor returns to the accuracy line.
- Four clubs with different flight and roll behavior. The distance meter is recalculated for the selected club and shows the real distance to the hole.
- Random wind speed and direction affect flight. Terrain, bunkers, water, and timing affect the result.
- Female and male golfer models, player name, and four outfit presets in Profile.
- A full-screen zoomable Three.js course with compact HUD widgets, animated clouds and flag, swing animation, impact effects, and sound.
- Facebook Open Graph and large-image card metadata, with the share image at `public/og-geek-lagoon.jpg`.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build and local production preview:

```sh
npm run build
npm run preview
```

## Controls

| Action | Control |
| --- | --- |
| Aim | Left / right arrow keys or the HUD buttons |
| Start charge, lock power, lock accuracy | Space, or three short taps/clicks on the course |
| Cancel before the swing | Esc |
| Select a club | Number keys 1–4, or the club buttons |
| Switch camera | C or the camera button |
| Zoom | Mouse wheel, `+` / `−` buttons, or a two-finger pinch |

Touch input ignores drags, long presses, and pinch gestures for swing timing.

## Project layout

```text
src/
  courses.js   Course and hole data
  physics.js   Ball flight, surfaces, wind, and prediction
  shot.js      Charge / accuracy timing and swing poses
  range.js     Club-specific range meter calculations
  world.js     Three.js course, golfer, cameras, and effects
  touch.js     Single-tap and pinch recognition
  main.js      Game state, HUD, controls, profile, and audio
  style.css    HUD, menus, modals, and responsive layout
tests/         Node test suite for physics, shots, courses, range, rig, and touch
public/        Static assets copied to the Vite build
```

## Checks

```sh
npm test
npm run build
```

The tests cover ball flight and putting, hazards and wind, all holes and clubs, range scale, three-stage timing, missed timing, swing alignment, and touch input.

## License

Original Geek Lagoon code and project-created game assets are licensed under the MIT License; see [LICENSE](LICENSE). Third-party dependencies remain under their respective licenses.

## Deploy

The existing Cloudflare Pages project is `minigolf`; `wrangler.toml` points its build output to `dist/`.

```sh
npm run deploy
```

This builds the site and uses Wrangler Pages Direct Upload. Cloudflare authentication is required. The production domain is `minigolf.aiyarafun.com`. Direct Upload is the current project setup; Git-based deployment has not been configured.

## Share preview

The page includes Open Graph and Twitter large-image metadata. The 1200×630 JPEG is served from `/og-geek-lagoon.jpg`. If Facebook has already cached an older preview for the URL, refresh its scrape in Facebook Sharing Debugger after deployment.

## Local data

Player name, character, outfit, sound preference, round count, and best completed nine-hole score are stored in browser local storage. There is no account service, backend, or multiplayer server.

See [project-memory.md](project-memory.md), [desicion.md](desicion.md), and [AGENTS.md](AGENTS.md) for project context, current decisions, and contributor instructions.
