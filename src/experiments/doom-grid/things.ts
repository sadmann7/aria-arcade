// Names follow Freedoom's own text: its cast call and pickup messages.

const monsterNames: Record<number, string> = {
  3004: "zombie",
  9: "shotgun zombie",
  65: "minigun zombie",
  3001: "serpentipede",
  3002: "flesh worm",
  58: "stealth worm",
  3006: "hatchling",
  3005: "trilobite",
  69: "pain bringer",
  3003: "pain lord",
  68: "technospider",
  71: "matribite",
  66: "octaminator",
  67: "combat slug",
  64: "necromancer",
  7: "large technospider",
  16: "assault tripod",
  84: "sailor",
};

const itemNames: Record<number, string> = {
  2007: "bullets",
  2048: "case of bullets",
  2008: "shotgun shells",
  2049: "box of shotgun shells",
  2010: "missile",
  2046: "crate of missiles",
  2047: "energy recharge",
  17: "large energy recharge",
  8: "backpack",
  2011: "health refill",
  2012: "large health refill",
  2014: "health bonus",
  2015: "armor bonus",
  2018: "force field vest",
  2019: "attuned force field armor",
  2013: "ectoplasmic surge",
  83: "negentropic surge",
  2022: "invulnerability",
  2023: "berserk",
  2024: "invisibility",
  2025: "rescue operations suit",
  2026: "area survey map",
  2045: "low-light goggles",
  2001: "pump-action shotgun",
  82: "double-barrelled shotgun",
  2002: "minigun",
  2003: "missile launcher",
  2004: "polaric energy weapon",
  2005: "ripsaw",
  2006: "SKAG 1337",
  5: "blue passcard",
  6: "yellow passcard",
  13: "red passcard",
  40: "blue skeleton key",
  39: "yellow skeleton key",
  38: "red skeleton key",
};

export interface Weapon {
  index: number;
  name: string;
  ammo: number | null;
  key: string;
}

export const weapons: Weapon[] = [
  { index: 0, name: "Fist", ammo: null, key: "1" },
  { index: 7, name: "Ripsaw", ammo: null, key: "1" },
  { index: 1, name: "Handgun", ammo: 0, key: "2" },
  { index: 2, name: "Pump-action shotgun", ammo: 1, key: "3" },
  { index: 8, name: "Double-barrelled shotgun", ammo: 1, key: "3" },
  { index: 3, name: "Minigun", ammo: 0, key: "4" },
  { index: 4, name: "Missile launcher", ammo: 3, key: "5" },
  { index: 5, name: "Polaric energy weapon", ammo: 2, key: "6" },
  { index: 6, name: "SKAG 1337", ammo: 2, key: "7" },
];

export const ammoNames = ["bullets", "shells", "energy", "missiles"];

export const keyNames = [
  "blue passcard",
  "yellow passcard",
  "red passcard",
  "blue skeleton key",
  "yellow skeleton key",
  "red skeleton key",
];

export const doorKeyNames = ["", "blue", "yellow", "red"];

export function monsterName(type: number) {
  return monsterNames[type] ?? "monster";
}

export function itemName(type: number) {
  return itemNames[type] ?? "item";
}
