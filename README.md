# Aria Arcade

A playground of fun, useless things built with [UI SDK](https://www.npmjs.com/package/@ui-sdk/react). Its behaviors, such as keyboard navigation, focus, selection, popups and drag and drop, are used as game mechanics.

Each experiment is one route in a single Next.js app, with its own folder in `src/experiments`.

```shell
pnpm install
pnpm dev
```

## Doom grid and Doom pixels

The Doom grid and Doom pixels run the [Woof](https://github.com/fabiangreffrath/woof) engine, built to WebAssembly, on [Freedoom](https://freedoom.github.io/). Neither is committed, so build them once before opening `/doom-grid` or `/doom-pixels`:

```shell
pnpm setup:engine
```

It needs [Emscripten](https://emscripten.org) on your `PATH` (CI uses 7.0.0), git, curl and unzip. It compiles a pinned Woof commit once per experiment, with the patches in its `src/experiments/<slug>/engine` folder, downloads a checksummed Freedoom release, and writes both to `public/<slug>/engine`. Run it again after changing anything in an engine folder.

## License

MIT, except for code inside an experiment's folder that carries its own license file.
