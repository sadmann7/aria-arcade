"use client";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";

const keys = [
  { key: "Arrows", action: "Walk to the cell they reach" },
  { key: "Shift + arrow", action: "Look without walking" },
  { key: "Enter", action: "Fire at a monster, open a door, or walk there" },
  { key: "T", action: "Next monster, nearest in sight first" },
  { key: "Escape", action: "Back to you" },
];

const legend = [
  { glyph: "@", label: "You", className: "bg-primary text-primary-foreground" },
  { glyph: "M", label: "Monster", className: "bg-red-950 text-red-300" },
  { glyph: "▮", label: "Door", className: "bg-amber-950 text-amber-200" },
  { glyph: "▯", label: "Open door", className: "bg-amber-950 text-amber-200" },
  { glyph: "•", label: "Item", className: "bg-muted text-amber-300" },
  { glyph: "⇥", label: "Exit", className: "bg-emerald-950 text-emerald-300" },
  { glyph: "", label: "Floor", className: "bg-muted" },
];

export function KeysPopover() {
  return (
    <Popover>
      <PopoverTrigger className="h-7 shrink-0 rounded-md border border-border px-2.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-open:bg-muted">
        Keys
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="m-0 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-4 text-foreground shadow-xl"
      >
        <PopoverTitle className="mb-2 text-sm font-semibold">
          Keys on the map
        </PopoverTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {keys.map(({ key, action }) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {key}
                </kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Click a cell to walk there or act on it. After dying or finishing the
          map, Enter continues.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function Legend() {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground"
    >
      {legend.map(({ glyph, label, className }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`flex size-4 items-center justify-center rounded-[3px] text-[10px] font-bold ${className}`}
          >
            {glyph}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
