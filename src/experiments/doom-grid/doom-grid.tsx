"use client";

import { announce, type GridCell } from "@ui-sdk/core";
import Link from "next/link";
import * as React from "react";

import {
  buildGrid,
  cellCenter,
  describeCell,
  findPath,
  gridPosition,
  gridSize,
  isFocusable,
  type MapCell,
  type MapGrid,
  mapTerrain,
  type Origin,
  simplifyPath,
} from "./grid-map";
import { Inventory } from "./inventory";
import {
  type CellMove,
  createMapGridController,
  gridCellKey,
} from "./map-grid";
import { MapGridCell, MapGridRoot, MapGridRow } from "./map-grid-parts";
import { SettingSwitch } from "./setting-switch";
import { weapons } from "./things";
import { useDoom } from "./use-doom";

const slowPercent = 40;
const rows = Array.from({ length: gridSize }, (_, row) => row);

interface Latest {
  grid: MapGrid | null;
  origin: Origin | null;
  player: { x: number; y: number; dead: boolean } | null;
  isPauseOnSelect: boolean;
  isIntermission: boolean;
}

export function DoomGrid() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const { snapshot, lines, origin, isIntermission, error, send } =
    useDoom(canvasRef);
  const [isViewShown, setIsViewShown] = React.useState(true);
  const [isSlow, setIsSlow] = React.useState(false);
  const [isPauseOnSelect, setIsPauseOnSelect] = React.useState(false);
  const [controller] = React.useState(createMapGridController);
  const latest = React.useRef<Latest>({
    grid: null,
    origin: null,
    player: null,
    isPauseOnSelect: false,
    isIntermission: false,
  });
  const isPausedForTarget = React.useRef(false);
  const shownOrigin = React.useRef<Origin | null>(null);

  // Walls only change when the view recenters, and finding them tests every
  // nearby line against every cell edge.
  const terrain = React.useMemo(
    () => (origin ? mapTerrain(lines, origin) : null),
    [lines, origin],
  );
  const grid =
    terrain && origin && snapshot ? buildGrid(terrain, origin, snapshot) : null;

  React.useEffect(() => {
    latest.current = {
      grid,
      origin,
      player: snapshot ? snapshot.player : null,
      isPauseOnSelect,
      isIntermission,
    };
    // The recenter effect below moves focus when the view shifts.
    if (!grid || !origin || !snapshot || shownOrigin.current !== origin) return;
    const you = gridPosition(origin, snapshot.player.x, snapshot.player.y);
    if (!gridRef.current?.contains(document.activeElement)) {
      controller.track(you);
      return;
    }
    const active = controller.active();
    const cell = active
      ? grid.mapCells[active.row * gridSize + active.col]
      : null;
    if (cell && !isFocusable(cell)) controller.focusCell(you);
  });

  React.useEffect(() => {
    const previous = shownOrigin.current;
    shownOrigin.current = origin;
    const active = controller.active();
    const isFocused = gridRef.current?.contains(document.activeElement);
    if (!previous || !origin || previous === origin || !active || !isFocused) {
      return;
    }
    const moved = {
      row: active.row + origin.cy - previous.cy,
      col: active.col - origin.cx + previous.cx,
    };
    const player = latest.current.player;
    const isInView =
      moved.row >= 0 &&
      moved.row < gridSize &&
      moved.col >= 0 &&
      moved.col < gridSize;
    if (isInView) controller.focusCell(moved);
    else if (player)
      controller.focusCell(gridPosition(origin, player.x, player.y));
  }, [origin, controller]);

  const cellAt = (cell: GridCell): MapCell | undefined =>
    latest.current.grid?.mapCells[cell.row * gridSize + cell.col];

  const setTargetPause = (isPaused: boolean) => {
    if (isPausedForTarget.current === isPaused) return;
    isPausedForTarget.current = isPaused;
    send({ type: "pause", isPaused });
  };

  const walkTo = (cell: GridCell) => {
    const { grid: current, origin: shown, player } = latest.current;
    const target = cellAt(cell);
    if (!current || !shown || !player || !target) return;
    if (target.monsters.length > 0 || player.dead) return;
    const from = gridPosition(shown, player.x, player.y);
    const path = findPath(current, from, cell);
    if (!path) {
      announce("No way there.");
      return;
    }
    if (path.length === 0) return;
    send({
      type: "path",
      points: simplifyPath(path, from).map((point) => cellCenter(shown, point)),
    });
  };

  const onCellMove = (cell: GridCell, move: CellMove) => {
    const target = cellAt(cell);
    if (latest.current.isPauseOnSelect) {
      setTargetPause((target?.monsters.length ?? 0) > 0);
    }
    if (move.reason !== "imperative" && !move.shift) walkTo(cell);
  };

  const onCellActivate = (cell: GridCell) => {
    const target = cellAt(cell);
    if (!target) return;
    if (latest.current.player?.dead || latest.current.isIntermission) {
      send({ type: "continue" });
      return;
    }
    const [monster] = target.monsters;
    if (monster) {
      setTargetPause(false);
      send({ type: "fire", id: monster.id });
    } else if (target.terrain !== "floor" && target.line !== null) {
      send({ type: "use", line: target.line });
    } else {
      walkTo(cell);
    }
  };

  const onCellKey = (event: KeyboardEvent, cell: GridCell) => {
    const { grid: current, origin: shown, player } = latest.current;
    if (!current || !shown || !player) return false;
    if (event.key === "Escape") {
      controller.focusCell(gridPosition(shown, player.x, player.y));
      return true;
    }
    if (event.key.toLowerCase() !== "t") return false;
    const you = gridPosition(shown, player.x, player.y);
    const targets = current.mapCells
      .filter((candidate) => candidate.monsters.length > 0)
      .sort(
        (a, b) =>
          Number(isInSight(b)) - Number(isInSight(a)) ||
          distance(a, you) - distance(b, you),
      );
    if (targets.length === 0) {
      announce("No monsters nearby.");
      return true;
    }
    const index = targets.findIndex(
      (target) => target.row === cell.row && target.col === cell.col,
    );
    const next = targets[(index + 1) % targets.length];
    if (next) {
      if (latest.current.isPauseOnSelect) setTargetPause(true);
      controller.focusCell(next);
    }
    return true;
  };

  const weapon = snapshot
    ? weapons.find((candidate) => candidate.index === snapshot.player.weapon)
    : undefined;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to the gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Doom grid</h1>
        <p className="max-w-[70ch] text-sm text-pretty text-muted-foreground">
          Freedoom runs below, and the grid mirrors the 24 by 24 cells around
          you, 64 map units each, with north up.
        </p>
      </header>

      <section aria-label="Settings" className="flex flex-wrap gap-x-6 gap-y-3">
        <SettingSwitch
          label="Show 3D view"
          isChecked={isViewShown}
          onCheckedChange={setIsViewShown}
        />
        <SettingSwitch
          label="Slow"
          isChecked={isSlow}
          onCheckedChange={(isChecked) => {
            setIsSlow(isChecked);
            send({ type: "speed", percent: isChecked ? slowPercent : 100 });
          }}
        />
        <SettingSwitch
          label="Pause on select"
          isChecked={isPauseOnSelect}
          onCheckedChange={(isChecked) => {
            setIsPauseOnSelect(isChecked);
            if (!isChecked) setTargetPause(false);
          }}
        />
      </section>

      {isViewShown ? (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="mx-auto aspect-[4/3] w-full max-w-2xl rounded-lg bg-black [image-rendering:pixelated]"
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid content-start gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {snapshot
              ? `Health ${snapshot.player.health} · Armor ${snapshot.player.armor} · ${weapon?.name ?? "Unarmed"} · Kills ${snapshot.kills} of ${snapshot.totalKills}`
              : "Loading Freedoom…"}
          </p>
          <MapGridRoot
            ref={gridRef}
            aria-label="Map"
            aria-describedby="doom-grid-keys"
            controller={controller}
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (
                !(next instanceof Node) ||
                !event.currentTarget.contains(next)
              ) {
                setTargetPause(false);
              }
            }}
            onCellMove={onCellMove}
            onCellActivate={onCellActivate}
            onCellKey={onCellKey}
            className="grid aspect-square w-full max-w-2xl gap-px rounded-lg border border-border bg-background p-px select-none"
          >
            {rows.map((row) => (
              <MapGridRow key={row} className="grid grid-cols-24 gap-px">
                {rows.map((col) => {
                  const cell = grid?.mapCells[row * gridSize + col];
                  return (
                    <MapGridCell
                      key={col}
                      id={gridCellKey({ row, col })}
                      row={row}
                      col={col}
                      isExpanded={
                        cell?.terrain === "door" && cell.door
                          ? cell.door.open > 0 || cell.door.isMoving
                          : undefined
                      }
                      aria-label={
                        cell && snapshot ? describeCell(cell, snapshot) : "Wall"
                      }
                      isDisabled={!cell || !isFocusable(cell)}
                      className={cellClass(cell)}
                    >
                      <span aria-hidden>{cellGlyph(cell)}</span>
                    </MapGridCell>
                  );
                })}
              </MapGridRow>
            ))}
          </MapGridRoot>
          <p
            id="doom-grid-keys"
            className="max-w-2xl text-sm text-muted-foreground"
          >
            Arrows walk to the cell they reach. Shift with an arrow looks
            without walking. Enter fires at a monster, opens a door, or walks to
            the cell. T jumps to the next monster, nearest in sight first, and
            Escape back to you.
          </p>
        </div>
        <section
          aria-labelledby="doom-inventory"
          className="grid content-start gap-2"
        >
          <h2 id="doom-inventory" className="text-sm font-medium">
            Inventory
          </h2>
          {snapshot ? (
            <Inventory
              player={snapshot.player}
              onWeaponChange={(key) => send({ type: "weapon", key })}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function isInSight(cell: MapCell) {
  return cell.monsters.some((monster) => monster.isVisible);
}

function distance(a: GridCell, b: GridCell) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function cellGlyph(cell: MapCell | undefined) {
  if (!cell) return "";
  if (cell.isPlayer) return "@";
  const [monster] = cell.monsters;
  if (monster) return "M";
  if (cell.terrain === "door") {
    return cell.door && cell.door.open > 0 ? "▯" : "▮";
  }
  if (cell.terrain === "exit") return "⇥";
  if (cell.items.length > 0) return "•";
  return "";
}

function cellClass(cell: MapCell | undefined) {
  const base =
    "flex aspect-square items-center justify-center rounded-[2px] text-[clamp(8px,1.6vw,14px)] font-bold leading-none outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring";
  if (!cell || !isFocusable(cell)) return `${base} bg-background`;
  if (cell.isPlayer) return `${base} bg-primary text-primary-foreground`;
  if (cell.monsters.length > 0) return `${base} bg-red-950 text-red-300`;
  if (cell.terrain === "door") return `${base} bg-amber-950 text-amber-200`;
  if (cell.terrain === "exit") return `${base} bg-emerald-950 text-emerald-300`;
  if (cell.items.length > 0) return `${base} bg-muted text-amber-300`;
  return `${base} bg-muted`;
}
