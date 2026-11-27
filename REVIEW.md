# Review

Aria Arcade is a set of standalone toys, so a mistake rarely breaks more than one route. The costly ones leak across that line: an experiment that breaks another one or the gallery, GPL code that escapes its folder into the MIT app, or a toy that only works with a mouse when its whole point is the keyboard.

## Checks

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.
- `pnpm build` when a route, `next.config.ts` or the root layout changes.

## What to look for

- **Experiment boundaries.** An experiment imports only from its own folder, UI SDK, React and Next.js. An import from another experiment, or a new shared module outside the root layout and `globals.css`, is a finding.
- **License boundaries.** GPL or other non-MIT code and data stay in `src/experiments/<slug>` and `public/<slug>`, with a `LICENSE` file beside them. Doom data must be Freedoom, never an id Software IWAD.
- **Keyboard and screen reader play.** The mechanics are ARIA behaviors, so every move must work from the keyboard and announce what changed. A mouse-only path, a lost focus or a role used against its pattern is a bug, even when the toy is meant to misbehave on purpose.
- **Escape hatches.** Toys that trap focus, move popups or fight the user must still let the user leave: Escape, a reachable link back to the gallery, and no trap that survives navigating away.
- **Gallery and routes agree.** Each entry in `src/experiments/index.ts` has a route at `src/app/<slug>`, and each route has an entry.
- **Cleanup.** Timers, animation frames, workers and listeners an experiment starts stop when its route unmounts.

## Skip

- `pnpm-lock.yaml`, files under `public/` and anything the formatter or lint already enforces.

## Format

- Start with a count: `N important, N nit, N pre-existing`. Say plainly when nothing needs fixing.
- Every finding gives `file:line` and the input or state that breaks.
- At most three nits.
