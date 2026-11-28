import type { Snapshot } from "./snapshot";

export function testSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    tic: 1,
    level: 1,
    map: 1,
    player: {
      x: 32,
      y: 32,
      angle: 90,
      health: 100,
      armor: 0,
      weapon: 1,
      weapons: 3,
      keys: 0,
      dead: false,
      ammo: [50, 0, 0, 0],
      maxAmmo: [200, 50, 300, 50],
    },
    monsters: [],
    items: [],
    doors: [],
    walk: { seq: 0, state: "idle" },
    shots: 0,
    isFiring: false,
    message: { seq: 0, text: "" },
    kills: 0,
    totalKills: 0,
    ...overrides,
  };
}
