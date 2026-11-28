import type { Metadata } from "next";

import { InfiniteCombobox } from "@/experiments/infinite-combobox/infinite-combobox";

export const metadata: Metadata = {
  title: "Infinite combobox",
  description:
    "Every option opens another combobox, 400 layers deep. Escape climbs back up one at a time.",
};

export default function InfiniteComboboxPage() {
  return <InfiniteCombobox />;
}
