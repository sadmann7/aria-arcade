"use client";

import * as React from "react";

import { useDoom } from "./use-doom";

export function DoomGrid() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { snapshot, lines, error } = useDoom(canvasRef);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Doom grid</h1>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="aspect-[4/3] w-full rounded-lg bg-black [image-rendering:pixelated]"
      />
      {error ? <p role="alert">{error}</p> : null}
      <pre className="overflow-auto rounded-lg bg-card p-3 text-xs">
        {snapshot
          ? `tic ${snapshot.tic} · map ${snapshot.map} · ${lines.length} lines\n` +
            `player x ${snapshot.player.x} y ${snapshot.player.y} angle ${snapshot.player.angle} health ${snapshot.player.health} armor ${snapshot.player.armor} weapon ${snapshot.player.weapon} ammo ${snapshot.player.ammo.join("/")}\n` +
            `monsters ${snapshot.monsters.length}: ${snapshot.monsters
              .map(
                (m) =>
                  `${m.type}@${m.x},${m.y} hp${m.health}${m.isVisible ? " seen" : ""}`,
              )
              .join("; ")}\n` +
            `items ${snapshot.items.length} · doors ${snapshot.doors
              .map((d) => `#${d.line} open ${d.open}`)
              .join(", ")}`
          : "Loading the engine…"}
      </pre>
    </main>
  );
}
