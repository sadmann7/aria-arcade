"use client";

import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { Toolbar } from "@ui-sdk/react/toolbar";

import type { Snapshot } from "./snapshot";

import { ammoNames, keyNames, weapons } from "./things";

interface HudProps {
  snapshot: Snapshot | null;
  isFailed: boolean;
  onWeaponChange: (key: string) => void;
}

const keyColors: Record<string, string> = {
  blue: "bg-sky-400",
  yellow: "bg-yellow-300",
  red: "bg-red-500",
};

export function Hud({ snapshot, isFailed, onWeaponChange }: HudProps) {
  if (!snapshot) {
    return (
      <section
        aria-label="Status"
        className="flex min-h-16 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground"
      >
        {isFailed ? "Freedoom didn't load." : "Loading Freedoom…"}
      </section>
    );
  }

  const { player } = snapshot;
  const owned = weapons.filter(
    (weapon) => (player.weapons & (1 << weapon.index)) !== 0,
  );
  const ammo =
    weapons.find((weapon) => weapon.index === player.weapon)?.ammo ?? null;
  const keys = keyNames.filter(
    (_, index) => (player.keys & (1 << index)) !== 0,
  );

  return (
    <section
      aria-label="Status"
      className="flex flex-wrap items-stretch gap-x-5 gap-y-3 rounded-lg border border-border bg-card px-4 py-2.5 lg:justify-between lg:[&>*+*]:border-l lg:[&>*+*]:border-border lg:[&>*+*]:pl-5"
    >
      <dl className="flex gap-6">
        <Stat
          label="Health"
          value={`${player.health}%`}
          tone={player.health <= 25 ? "text-red-400" : undefined}
        />
        <Stat label="Armor" value={`${player.armor}%`} />
      </dl>
      <div className="flex gap-6">
        <div className="grid content-between gap-1">
          <span aria-hidden className={labelClass}>
            Weapon
          </span>
          <Toolbar aria-label="Weapons" className="flex flex-wrap gap-1">
            <ToggleGroup
              deselectable={false}
              value={[String(player.weapon)]}
              onValueChange={([value]) => {
                const weapon = weapons.find((w) => String(w.index) === value);
                if (weapon) onWeaponChange(weapon.key);
              }}
              className="flex flex-wrap gap-1"
            >
              {owned.map((weapon) => (
                <Toggle
                  key={weapon.index}
                  value={String(weapon.index)}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-pressed:border-primary data-pressed:bg-primary/15 data-pressed:text-foreground"
                >
                  <span
                    aria-hidden
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {weapon.key}
                  </span>
                  {weapon.name}
                </Toggle>
              ))}
            </ToggleGroup>
          </Toolbar>
        </div>
        <dl>
          <Stat
            label="Ammo"
            value={ammo === null ? "—" : String(player.ammo[ammo])}
            unit={ammo === null ? undefined : ammoNames[ammo]}
          />
        </dl>
      </div>
      <dl className="flex gap-6">
        <Stat
          label="Kills"
          value={`${snapshot.kills}/${snapshot.totalKills}`}
        />
        <div className="grid content-between gap-1">
          <dt className={labelClass}>Keys</dt>
          <dd className="flex h-7 items-center gap-1.5 text-sm">
            {keys.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              keys.map((key) => (
                <span key={key} className="flex items-center gap-1">
                  <span
                    aria-hidden
                    className={`size-2.5 rounded-sm ${keyColors[key.split(" ")[0] ?? ""] ?? "bg-foreground"}`}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

const labelClass =
  "text-[11px] font-medium tracking-wider text-muted-foreground uppercase";

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}

function Stat({ label, value, unit, tone }: StatProps) {
  return (
    <div className="grid content-between gap-1">
      <dt className={labelClass}>{label}</dt>
      <dd
        className={`flex h-7 items-baseline gap-1 text-2xl leading-7 font-semibold tabular-nums ${tone ?? ""}`}
      >
        {value}
        {unit ? (
          <span className="text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
