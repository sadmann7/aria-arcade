"use client";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";

export const keys = [
  {
    key: "Arrows",
    cap: "← ↑ ↓ →",
    hint: "Walk",
    action: "Walk to the cell they reach",
  },
  {
    key: "Shift + arrow",
    cap: "Shift + ←",
    hint: "Look",
    action: "Look without walking",
  },
  {
    key: "Enter",
    cap: "Enter",
    hint: "Fire · open · walk",
    action: "Fire at a monster, open a door, or walk there",
  },
  {
    key: "T",
    cap: "T",
    hint: "Next monster",
    action: "Next monster, nearest in sight first",
  },
  { key: "1–7", cap: "1–7", hint: "Weapon", action: "Switch weapon" },
  { key: "Escape", cap: "Esc", hint: "Back to you", action: "Back to you" },
];

export const cellTones = {
  you: "bg-foreground text-background",
  monster: "bg-destructive/30 text-destructive",
  door: "bg-accent/20 text-accent",
  item: "bg-muted text-accent",
  exit: "bg-muted text-foreground shadow-[inset_0_0_0_1.5px_var(--color-foreground)]",
  floor: "bg-muted",
};

const legend = [
  { glyph: "@", label: "You", className: cellTones.you },
  { glyph: "M", label: "Monster", className: cellTones.monster },
  { glyph: "▮", label: "Door", className: cellTones.door },
  { glyph: "▯", label: "Open door", className: cellTones.door },
  { glyph: "•", label: "Item", className: cellTones.item },
  { glyph: "⇥", label: "Exit", className: cellTones.exit },
  { glyph: "", label: "Floor", className: cellTones.floor },
  { glyph: "", label: "Focus", className: "border-[2.5px] border-primary" },
];

export function KeysPopover() {
  return (
    <Popover>
      <PopoverTrigger className="arcade-keycap hover:border-foreground data-open:border-foreground data-open:bg-foreground data-open:text-background">
        All keys <span aria-hidden="true">▴</span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="arcade-panel m-0 w-96 max-w-[calc(100vw-2rem)] gap-3 p-4 text-foreground"
      >
        <PopoverTitle className="arcade-label text-foreground">
          Keys on the map
        </PopoverTitle>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm leading-[18px]">
          {keys.map(({ key, cap, action }) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="arcade-keycap">
                  <span aria-hidden="true">{cap}</span>
                  <span className="sr-only">{key}</span>
                </kbd>
              </dt>
              <dd className="text-secondary-foreground">{action}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Click a cell to walk there or act on it. After dying or finishing the
          map, Enter continues.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function Legend() {
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <p aria-hidden="true" className="arcade-label">
        Legend
      </p>
      <ul
        aria-label="Legend"
        className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-sm leading-[18px] text-secondary-foreground"
      >
        {legend.map(({ glyph, label, className }) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex size-[18px] items-center justify-center font-heavy text-[11px] leading-[14px] ${className}`}
            >
              {glyph}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
