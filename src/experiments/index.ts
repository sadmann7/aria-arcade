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
];
