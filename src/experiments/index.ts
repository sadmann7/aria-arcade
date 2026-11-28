export interface Experiment {
  slug: string;
  title: string;
  description: string;
}

export const experiments: Experiment[] = [
  {
    slug: "doom-grid",
    title: "Doom grid",
    description:
      "Play Freedoom through an accessible grid that mirrors the live game, even with a screen reader.",
  },
  {
    slug: "infinite-combobox",
    title: "Infinite combobox",
    description:
      "Every option opens another combobox, 400 layers deep. Escape climbs back up one at a time.",
  },
  {
    slug: "menu-tetris",
    title: "Menu Tetris",
    description:
      "Tetris with toolbars, menubars and tab lists for pieces. A full row only clears once you arrow through every cell in it.",
  },
];
