"use client";

import { announce, type GridCell } from "@ui-sdk/core";
import * as React from "react";

import type { Snapshot } from "./snapshot";

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
import { cellTones, keys, KeysPopover, Legend } from "./help";
import { Hud } from "./hud";
import {
  type CellMove,
  createMapGridController,
  gridCellKey,
} from "./map-grid";
import { MapGridCell, MapGridRoot, MapGridRow } from "./map-grid-parts";
import { SettingSwitch } from "./setting-switch";
import { Shell } from "./shell";
import { weapons } from "./things";
import { useDoom } from "./use-doom";

const slowPercent = 40;
const rows = Array.from({ length: gridSize }, (_, row) => row);

interface Latest {
  grid: MapGrid | null;
  origin: Origin | null;
  player: Snapshot["player"] | null;
  isPauseOnSelect: boolean;
  isIntermission: boolean;
}

export function DoomGrid() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const {
    snapshot,
    lines,
    origin,
    isIntermission,
    error,
    isAudioAvailable,
    send,
  } = useDoom(canvasRef);
  const [isViewShown, setIsViewShown] = React.useState(true);
  const [isSlow, setIsSlow] = React.useState(false);
  const [isPauseOnSelect, setIsPauseOnSelect] = React.useState(false);
  const [isSoundOn, setIsSoundOn] = React.useState(true);
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
    if (/^[1-7]$/.test(event.key)) {
      const isOwned = weapons.some(
        (weapon) =>
          weapon.key === event.key &&
          (player.weapons & (1 << weapon.index)) !== 0,
      );
      if (isOwned) send({ type: "weapon", key: event.key });
      else announce("You don't have that weapon.");
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

  const settings = (
    <section aria-label="Settings" className="flex flex-col gap-3 pt-1">
      <p aria-hidden="true" className="arcade-label">
        Settings
      </p>
      <div className="border-t border-divider">
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
          label="Sound"
          isChecked={isSoundOn && isAudioAvailable}
          isDisabled={!isAudioAvailable}
          description={
            isAudioAvailable ? undefined : "Needs HTTPS or localhost"
          }
          onCheckedChange={(isChecked) => {
            setIsSoundOn(isChecked);
            send({ type: "sound", isMuted: !isChecked });
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
      </div>
    </section>
  );

  return (
    <Shell
      tape="01"
      tags={["Freedoom phase 2", "Screen reader"]}
      title="Doom Grid"
      kicker="24 × 24 cells · 64 map units each · north up"
      hints={keys}
      footerEnd={<KeysPopover />}
      stageClassName="@container flex-col justify-center gap-4 p-4 [--map:min(432px,100cqw)] lg:[--map:max(240px,min(calc(100dvh-468px),calc((100cqw-24px)*432/872)))]"
      panel={
        <>
          <Hud
            snapshot={snapshot}
            isFailed={error !== null}
            onWeaponChange={(key) => send({ type: "weapon", key })}
          />
          {settings}
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-[15px] leading-5 text-primary">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex w-[calc(var(--map)*440/432)] max-w-full flex-col justify-between gap-3 lg:h-[calc(var(--map)+28px)]">
          <div aria-hidden="true" className="flex justify-between">
            <span className="arcade-label">3D view</span>
            <span className="arcade-label">4 : 3</span>
          </div>
          {isViewShown && !error ? (
            <canvas
              ref={canvasRef}
              aria-hidden
              className="aspect-4/3 w-full border border-border bg-black [image-rendering:pixelated]"
            />
          ) : (
            <p className="grid aspect-4/3 w-full place-content-center border border-dashed border-border text-[15px] leading-5 text-muted-foreground">
              {error ? "No view." : "3D view is off."}
            </p>
          )}
          <Legend />
        </div>
        <div className="flex flex-col gap-3">
          <div aria-hidden="true" className="flex justify-between">
            <span className="arcade-label text-foreground">Map · grid</span>
            <span className="arcade-label">N ↑</span>
          </div>
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
            className="grid size-(--map) grid-rows-24 gap-px bg-background outline-1 outline-border select-none"
          >
            {rows.map((row) => (
              <MapGridRow
                key={row}
                className="grid min-h-0 grid-cols-24 gap-px"
              >
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
        </div>
      </div>
      <p id="doom-grid-keys" hidden>
        Arrows walk to the cell they reach. Shift with an arrow looks without
        walking. Enter fires at a monster, opens a door, or walks to the cell. T
        jumps to the next monster, nearest in sight first, and Escape back to
        you. Number keys 1 to 7 switch weapons.
      </p>
    </Shell>
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
    "flex min-w-0 items-center justify-center font-heavy text-[calc(var(--map)*12/432)] leading-none outline-none focus-visible:z-10 focus-visible:outline-[2.5px] focus-visible:outline-offset-1 focus-visible:outline-primary";
  if (!cell || !isFocusable(cell)) return base;
  if (cell.isPlayer) return `${base} ${cellTones.you}`;
  if (cell.monsters.length > 0) return `${base} ${cellTones.monster}`;
  if (cell.terrain === "door") return `${base} ${cellTones.door}`;
  if (cell.terrain === "exit") return `${base} ${cellTones.exit}`;
  if (cell.items.length > 0) return `${base} ${cellTones.item}`;
  return `${base} ${cellTones.floor}`;
}
