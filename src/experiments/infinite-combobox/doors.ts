export const BOTTOM = 400;

export interface Door {
  value: string;
  label: string;
  quip: string | null;
}

const deeper = [
  "A smaller door",
  "The stairs, again",
  "Suspiciously warm tunnel",
  "Rabbit hole (certified)",
  "Another combobox, obviously",
  "Trapdoor marked “no”",
  "The basement’s basement",
  "Slide of questionable hygiene",
  "Elevator, down only",
  "Hole shaped like a dropdown",
  "Spiral staircase",
  "Even more options",
  "The fine print",
  "A deeper menu",
  "Chute labelled “fun”",
  "That way",
];

const deadEnds: [string, string][] = [
  ["A wall", "It’s a wall. You admire it briefly."],
  ["The exit", "Ha. No."],
  ["A mirror", "You look like someone who opens comboboxes."],
  [
    "Customer support",
    "Your call is important to us. Please hold for 400 layers.",
  ],
  ["Settings", "There are no settings. There is only down."],
  ["Lost and found", "Found: one sock and most of your patience."],
  ["Terms of service", "You agreed to them on layer 1."],
  ["A nap", "You lie down. The combobox waits for you."],
  ["Upstairs", "Upstairs is Escape. You knew that."],
  ["A tiny gift shop", "Everything is a combobox. Everything costs one click."],
  ["The void", "The void selects you back."],
  ["Free snacks", "They were a placeholder."],
];

const bottomDoors: Door[] = [
  {
    value: "bottom",
    label: "The bottom",
    quip: "You touched the bottom. Now climb back up, one Escape at a time.",
  },
  {
    value: "floor",
    label: "Knock on the floor",
    quip: "Something knocks back from layer 401. Best not to.",
  },
  {
    value: "souvenir",
    label: "Take a souvenir",
    quip: "You pocket a very small option. It says “Layer 400”.",
  },
];

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function pick<T>(list: T[], seed: number, taken: Set<number>) {
  let index = seed % list.length;
  while (taken.has(index)) index = (index + 1) % list.length;
  taken.add(index);
  const item = list[index];
  if (item === undefined) throw new Error("The list is empty.");
  return item;
}

export function getDoors(depth: number, from: string): Door[] {
  if (depth >= BOTTOM) return bottomDoors;

  const seed = hash(`${depth}:${from}`);
  const deeperCount = 2 + (seed % 3);
  const deadEndCount = 1 + ((seed >>> 3) % 2);
  const takenDeeper = new Set<number>();
  const takenDeadEnds = new Set<number>();
  const doors: Door[] = [];

  for (let index = 0; index < deeperCount; index++) {
    const label = pick(deeper, seed >>> (5 + index * 4), takenDeeper);
    doors.push({ value: `door-${doors.length}`, label, quip: null });
  }
  for (let index = 0; index < deadEndCount; index++) {
    const [label, quip] = pick(
      deadEnds,
      seed >>> (17 + index * 5),
      takenDeadEnds,
    );
    doors.push({ value: `door-${doors.length}`, label, quip });
  }

  const shift = seed % doors.length;
  return [...doors.slice(shift), ...doors.slice(0, shift)];
}
