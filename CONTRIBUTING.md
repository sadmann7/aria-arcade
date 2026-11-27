# Contributing Guide

Thank you for investing your time in contributing to Aria Arcade.

If you have any questions, feel free to reach out to [@sadmann17](https://x.com/sadmann17).

## Project Structure

- `src/app`: the gallery at `/` and one route per experiment.
- `src/experiments/<slug>`: everything an experiment needs. Experiments never import from each other.
- `src/experiments/index.ts`: the list the gallery shows.
- `lint`: the repo's oxlint rules.

Code under a license other than MIT stays inside its experiment's folder, with its own `LICENSE` file. `AGENTS.md` has the full conventions.

## Getting started

### Clone the project

```shell
git clone https://github.com/sadmann7/aria-arcade
cd aria-arcade
```

### Create a new branch

```shell
git checkout -b sadman/menu-tetris
```

### Install dependencies

```shell
pnpm install
```

### Start the dev server

```shell
pnpm dev
```

### Check your changes

```shell
pnpm check
pnpm test
pnpm build
```

### Commit your changes

When committing your changes, use the following format:

```text
<type>(<scope>): <description>
```

**Types:**

- `feat` : a new feature
- `fix` : a bug fix
- `refactor` : code change that is neither a feature nor a bug fix
- `perf` : performance improvement
- `style` : formatting, missing semicolons, etc. (no logic change)
- `test` : adding or updating tests
- `docs` : documentation changes only
- `chore` : build process, dependency updates, tooling
- `ci` : continuous integration changes

**Scope:**
Scope your commit to the part of the codebase that is affected, usually the experiment's slug, such as `menu-tetris`, or an area like `gallery`, `lint`, `ci` or `deps`.

Examples:

```shell
git commit -m "feat(menu-tetris): clear a row when every item in it is checked"
git commit -m "fix(gallery): keep focus on the list after going back"
```

### Create a pull request

When you're finished pushing your changes, open a pull request. Its title uses the same format, since pull requests are squash-merged.
