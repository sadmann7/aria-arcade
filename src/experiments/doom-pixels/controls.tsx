"use client";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";

export const controls = [
  { key: "↑ ↓ or W S", cap: "↑ ↓ · W S", hint: "Move", isShown: true },
  { key: "← →", cap: "← →", hint: "Turn", isShown: true },
  { key: "A D", cap: "A D", hint: "Strafe", isShown: true },
  { key: "F or Ctrl", cap: "F · Ctrl", hint: "Fire", isShown: true },
  { key: "E or Space", cap: "E · Space", hint: "Use", isShown: true },
  { key: "1–7", cap: "1–7", hint: "Weapons", isShown: false },
  { key: "Shift", cap: "Shift", hint: "Run", isShown: false },
  { key: "M", cap: "M", hint: "Map", isShown: false },
  { key: "Esc", cap: "Esc", hint: "Menu", isShown: false },
  {
    key: "P",
    cap: "P",
    hint: "Pause · inspect pixels",
    isShown: true,
  },
  { key: "Tab", cap: "Tab", hint: "Leave the screen", isShown: false },
];

export const shownControls = controls.filter((control) => control.isShown);

export function Controls() {
  return (
    <Popover>
      <PopoverTrigger className="arcade-keycap hover:border-foreground data-open:border-foreground data-open:bg-foreground data-open:text-background">
        All keys <span aria-hidden="true">▴</span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="arcade-panel m-0 w-80 max-w-[calc(100vw-2rem)] gap-3 p-4 text-foreground"
      >
        <PopoverTitle className="arcade-label text-foreground">
          Keys
        </PopoverTitle>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm leading-[18px]">
          {controls.map(({ key, cap, hint }) => (
            <div key={hint} className="contents">
              <dt>
                <kbd className="arcade-keycap">
                  <span aria-hidden="true">{cap}</span>
                  <span className="sr-only">{key}</span>
                </kbd>
              </dt>
              <dd className="text-secondary-foreground">{hint}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
