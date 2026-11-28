export interface Experiment {
  slug: string;
  title: string;
  description: string;
}

export const experiments: Experiment[] = [
  {
    slug: "calendar-snake",
    title: "Calendar Snake",
    description:
      "Snake played in a calendar. The head is the focused date, the body is the selection, and meetings get in the way.",
  },
  {
    slug: "doom-grid",
    title: "Doom grid",
    description:
      "Play Freedoom through an accessible grid that mirrors the live game, even with a screen reader.",
  },
  {
    slug: "doom-pixels",
    title: "Doom pixels",
    description:
      "Play Freedoom drawn into a UI SDK grid, one cell per pixel, and see what each resolution costs.",
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
