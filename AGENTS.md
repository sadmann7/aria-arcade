# Agents

## Comments

Default to no comment. Write one only for a constraint, an external quirk, or an invariant the code can't show, in one line where you can and four at most. Don't restate names, narrate steps, record history, or explain the fix you just made; the PR carries that.

- Full sentences ending with a full stop, including notes after code on the same line.
- No required verb form, and no "we" or "our".
- JSDoc only on the public API (props, options, hooks and functions users import): one sentence, no types, no empty `@param` or `@returns`. Components and parts get none, and neither do internal helpers, even ones another file imports.
- A `TODO:` links the issue that tracks it. No bare `#123`.
- No section dividers, commented-out code, or test step labels.

`aria-arcade/comment-style` in `lint/comment-style.ts` enforces the mechanical parts.

## Skills

`.agents/skills` holds the skills for this repo, and `.claude/skills` links to it. Read a skill's `SKILL.md` and follow it before the work it covers.

- `ui-sdk`: any UI built on UI SDK. It links to the copy that ships in `@ui-sdk/core`, so it matches the installed version. Its docs are in `node_modules/@ui-sdk/react/docs`; start from `llms.txt`.

## Project

Aria Arcade is a playground of fun, useless things built with Next.js, Tailwind CSS and UI SDK. UI SDK's behaviors, such as keyboard navigation, focus, selection, popups and drag and drop, are the game mechanics.

- `src/app/page.tsx`: the gallery, listing `experiments` from `src/experiments/index.ts`.
- `src/app/layout.tsx` and `src/styles/globals.css`: the root layout and the color tokens, which use shadcn/ui role names.
- `src/experiments`: one folder per experiment.

## Experiments

Each experiment is one route and one folder, and stands alone.

- Its slug is kebab-case, such as `menu-tetris`. Its code, hooks, tests and data live in `src/experiments/<slug>`, and its route is `src/app/<slug>/page.tsx`, which only renders the experiment's entry and sets its metadata.
- Add it to `experiments` in `src/experiments/index.ts` so the gallery lists it.
- An experiment imports only from its own folder, UI SDK, React and Next.js. Experiments never import from each other; copy what you need instead of making a shared module. The root layout and `globals.css` are the only shared UI.
- Import within an experiment with `./`, and from elsewhere in `src` through `@/`.
- Files it serves as static assets go in `public/<slug>`.

## Licenses

The repo is MIT. Code or data under any other license, such as a GPL engine, stays inside its experiment's folder (and its `public/<slug>` folder) with its own `LICENSE` file there, and nothing outside that folder imports it. The Doom experiment uses Freedoom data only, never id Software's IWADs.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
