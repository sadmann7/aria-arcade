import type { Metadata } from "next";

import { CalendarSnake } from "@/experiments/calendar-snake/calendar-snake";

export const metadata: Metadata = {
  title: "Calendar Snake",
  description:
    "Snake played in a calendar. The head is the focused date, the body is the selection, and meetings get in the way.",
};

export default function CalendarSnakePage() {
  return <CalendarSnake />;
}
