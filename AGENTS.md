# Agent instructions

Read [project-memory.md](project-memory.md) and [desicion.md](desicion.md) before making substantial changes. These documents describe the current product behavior and decisions; update them when a durable decision or system boundary changes.

## Project conventions

- This is a Vite app using native JavaScript ES modules and Three.js. Avoid adding dependencies unless they solve a clear project need.
- Keep the course canvas dominant and the HUD compact, readable, keyboard-accessible, and responsive.
- Keep game strings aligned with the existing Thai / English interface.
- Prefer original procedural assets. Do not copy protected art or connect to another game's account or multiplayer backend.
- Keep simulation code deterministic and testable where practical. Inject random sources for tests that cover wind or other random behavior.
- Keep the three-stage shot flow consistent across keyboard, mouse, and touch: charge, lock power, lock accuracy.
- Keep public browser-share metadata accurate when changing the canonical URL, title, description, or Open Graph image.
- Do not commit generated `dist/`, `node_modules/`, local QA captures, deployment archives, or credentials. Final static assets belong in `public/`.

## Validation

Run these checks after code or content changes that affect the app:

```sh
npm test
npm run build
```

For UI changes, also verify the affected flow in a browser at desktop and mobile sizes where applicable. Do not deploy to production unless the user requests or has already authorized that deployment.

## Architecture map

- `src/main.js`: UI, state, controls, audio, storage, and game loop.
- `src/world.js`: Three.js rendering and golfer / course visuals.
- `src/physics.js`, `src/shot.js`, `src/range.js`, `src/touch.js`: game simulation and input behavior.
- `src/courses.js`: course and hole data.
- `src/style.css`: visual presentation.
- `tests/`: automated behavior checks.
