"use client";

import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";

import type { Player } from "./snapshot";

import { ammoNames, keyNames, weapons } from "./things";

interface InventoryProps {
  player: Player;
  onWeaponChange: (key: string) => void;
}

const itemClass =
  "flex justify-between gap-3 rounded-md px-2 py-1 text-sm outline-none data-disabled:text-muted-foreground data-highlighted:bg-muted data-selected:font-semibold data-selected:text-primary";

export function Inventory({ player, onWeaponChange }: InventoryProps) {
  const owned = weapons.filter(
    (weapon) => (player.weapons & (1 << weapon.index)) !== 0,
  );
  const keys = keyNames.filter(
    (_, index) => (player.keys & (1 << index)) !== 0,
  );

  return (
    <Listbox
      aria-label="Inventory"
      activation="manual"
      value={String(player.weapon)}
      onValueChange={(value) => {
        const weapon = weapons.find((w) => String(w.index) === value);
        if (weapon) onWeaponChange(weapon.key);
      }}
      className="grid content-start gap-0.5 rounded-lg border border-border bg-card p-1 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {owned.map((weapon) => (
        <ListboxItem
          key={weapon.index}
          value={String(weapon.index)}
          className={itemClass}
        >
          <span>{weapon.name}</span>
          {weapon.ammo === null ? null : (
            <span className="text-muted-foreground tabular-nums">
              {player.ammo[weapon.ammo]} {ammoNames[weapon.ammo]}
            </span>
          )}
        </ListboxItem>
      ))}
      {keys.map((key) => (
        <ListboxItem key={key} value={key} disabled className={itemClass}>
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </ListboxItem>
      ))}
    </Listbox>
  );
}
