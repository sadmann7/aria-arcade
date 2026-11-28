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
  blue: "bg-foreground",
  yellow: "bg-accent",
  red: "bg-destructive",
};

export function Hud({ snapshot, isFailed, onWeaponChange }: HudProps) {
  if (!snapshot) {
    return (
      <section aria-label="Status" className="arcade-panel">
        <p className="arcade-panel-head arcade-label text-destructive">
          Status
        </p>
        <p className="px-4 py-4 text-[15px] leading-5 text-muted-foreground">
          {isFailed ? "Freedoom didn't load." : "Loading Freedoom…"}
        </p>
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
    <>
      <section aria-label="Status" className="arcade-panel">
        <p
          aria-hidden="true"
          className="arcade-panel-head arcade-label text-destructive"
        >
          Status
        </p>
        <dl className="arcade-panel-row pt-4 pb-2">
          <Stat
            label="Health"
            value={`${player.health}%`}
            className={`text-[44px] leading-12 tracking-[-0.04em] ${player.health <= 25 ? "text-destructive" : "text-accent"}`}
          />
          <Stat
            label="Armor"
            value={`${player.armor}%`}
            className="text-[44px] leading-12 tracking-[-0.04em]"
          />
        </dl>
        <dl className="arcade-panel-row pt-2 pb-4">
          <Stat
            label="Ammo"
            value={ammo === null ? "—" : String(player.ammo[ammo])}
            unit={ammo === null ? undefined : ammoNames[ammo]}
            className="text-[26px] leading-8 tracking-[-0.02em]"
          />
          <Stat
            label="Kills"
            value={`${snapshot.kills}/${snapshot.totalKills}`}
            className="text-[26px] leading-8 tracking-[-0.02em]"
          />
        </dl>
        <dl className="arcade-panel-row items-center justify-between py-3">
          <dt className="arcade-label">Keys</dt>
          <dd className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm leading-[18px]">
            {keys.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              keys.map((key) => (
                <span key={key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 ${keyColors[key.split(" ")[0] ?? ""] ?? "bg-foreground"}`}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              ))
            )}
          </dd>
        </dl>
      </section>
      <div className="flex flex-col gap-2.5">
        <p aria-hidden="true" className="arcade-label">
          Weapon · toolbar
        </p>
        <Toolbar aria-label="Weapons">
          <ToggleGroup
            deselectable={false}
            value={[String(player.weapon)]}
            onValueChange={([value]) => {
              const weapon = weapons.find((w) => String(w.index) === value);
              if (weapon) onWeaponChange(weapon.key);
            }}
            className="flex flex-wrap gap-2"
          >
            {owned.map((weapon) => (
              <Toggle
                key={weapon.index}
                value={String(weapon.index)}
                className="group flex items-center gap-2 border-[1.5px] border-input px-2.5 py-[7px] text-sm leading-[18px] text-secondary-foreground hover:border-foreground data-pressed:border-foreground data-pressed:bg-foreground data-pressed:font-semibold data-pressed:text-background"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-[13px] leading-4 font-medium text-muted-foreground group-data-pressed:text-background"
                >
                  {weapon.key}
                </span>
                {weapon.name}
              </Toggle>
            ))}
          </ToggleGroup>
        </Toolbar>
      </div>
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  className: string;
}

function Stat({ label, value, unit, className }: StatProps) {
  return (
    <div className="arcade-stat">
      <dt className="arcade-label">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className={`arcade-readout ${className}`}>{value}</span>
        {unit ? (
          <span className="text-[13px] leading-4 text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
