export interface Experiment {
  slug: string;
  title: string;
  description: string;
}

export const experiments: Experiment[] = [
  {
    slug: "infinite-combobox",
    title: "Infinite combobox",
    description:
      "Every option opens another combobox, 400 layers deep. Escape climbs back up one at a time.",
  },
];
