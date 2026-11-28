"use client";

import {
  announce,
  type ChangeSource,
  prepareAnnouncements,
} from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import {
  Combobox,
  ComboboxContent,
  type ComboboxController,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  createComboboxController,
} from "@ui-sdk/react/combobox";
import * as React from "react";

import { BOTTOM, type Door, getDoors } from "./doors";
import { Shell } from "./shell";

interface Step {
  door: Door;
  opener: ComboboxController;
  anchor: HTMLElement | null;
  isTouch: boolean;
}

type OnChoose = (
  depth: number,
  door: Door,
  opener: ComboboxController,
  anchor: HTMLElement | null,
  source: ChangeSource,
) => void;

const contentClass =
  "group grid w-[min(16rem,calc(100vw-1rem))] gap-2 border border-t-4 border-border border-t-(--layer-color) bg-card p-2.5 text-sm leading-[18px] text-foreground shadow-[8px_8px_0_#000000b3] transition-[opacity,scale] duration-150 origin-(--transform-origin) rotate-(--layer-tilt) data-top:border-t-primary data-top:shadow-[8px_8px_0_#000000b3,0_0_40px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] data-bottom:ring-2 data-bottom:ring-primary data-starting-style:scale-90 data-starting-style:opacity-0 motion-reduce:transition-none";

const itemClass =
  "flex cursor-pointer items-center justify-between gap-3 px-2.5 py-[7px] text-secondary-foreground select-none max-sm:min-h-10 data-highlighted:bg-white/8 data-highlighted:text-foreground data-selected:bg-white/8 data-selected:font-semibold data-selected:text-foreground group-data-top:data-highlighted:bg-primary group-data-top:data-highlighted:font-semibold group-data-top:data-highlighted:text-primary-foreground";

const inputClass =
  "h-9 w-full min-w-0 border-[1.5px] border-input bg-background px-2.5 text-base text-foreground outline-none placeholder:text-faint-foreground focus-visible:border-primary sm:text-sm";

const layerColors = [
  "var(--color-muted-foreground)",
  "var(--color-secondary-foreground)",
  "var(--color-accent)",
];

const hints = [
  { key: "Up and down arrows", cap: "↑ ↓", hint: "Highlight a door" },
  { key: "Enter", cap: "Enter", hint: "Go through" },
  { key: "Type", cap: "Type", hint: "Search doors" },
  { key: "Escape", cap: "Esc", hint: "Climb up one layer" },
];

function layerStyle(depth: number) {
  return {
    "--layer-color": layerColors[depth % layerColors.length],
    "--layer-tilt": `${depth === 1 ? 0 : (((depth * 37) % 7) - 3) * 0.6}deg`,
  } as React.CSSProperties;
}

function isTouch(event: MouseEvent) {
  return "pointerType" in event && event.pointerType === "touch";
}

interface DoorListProps {
  depth: number;
  doors: Door[];
  elements: Map<string, HTMLElement>;
}

function DoorList({ depth, doors, elements }: DoorListProps) {
  return (
    <ComboboxList className="grid max-h-64 gap-0.5 overflow-y-auto overscroll-contain">
      {doors.map((door) => (
        <ComboboxItem
          key={door.value}
          value={door.value}
          label={door.label}
          ref={(node: HTMLDivElement | null) => {
            if (!node) return;
            elements.set(door.value, node);
            return () => {
              elements.delete(door.value);
            };
          }}
          className={itemClass}
        >
          {door.label}
          {door.quip === null && depth < BOTTOM ? (
            <span
              aria-hidden="true"
              className="text-muted-foreground group-data-top:in-data-highlighted:text-primary-foreground"
            >
              ↘
            </span>
          ) : null}
        </ComboboxItem>
      ))}
    </ComboboxList>
  );
}

function useLayer(
  depth: number,
  doors: Door[],
  isTop: boolean,
  onChoose: OnChoose,
) {
  const [controller] = React.useState(() => createComboboxController());
  const [query, setQuery] = React.useState("");
  const [quip, setQuip] = React.useState<string | null>(null);
  const [elements] = React.useState(() => new Map<string, HTMLElement>());

  function onValueChange(
    value: string | null,
    details: { source: ChangeSource; cancel: () => void },
  ) {
    const door = doors.find((candidate) => candidate.value === value);
    if (!door) return;
    setQuip(door.quip);
    if (door.quip !== null) {
      details.cancel();
      announce(door.quip);
      if (details.source !== "touch") controller.focus();
    }
    onChoose(
      depth,
      door,
      controller,
      elements.get(door.value) ?? null,
      details.source,
    );
  }

  function onQueryChange(
    next: string,
    details: { reason: string; cancel: () => void },
  ) {
    if (details.reason === "item-press") return;
    if (!isTop && details.reason === "input-change") {
      details.cancel();
      return;
    }
    setQuery(next);
  }

  return { controller, elements, query, quip, onValueChange, onQueryChange };
}

interface SurfaceProps {
  isOpen: boolean;
  isTop: boolean;
  chosen: string | null;
  onOpenChange: (open: boolean) => void;
  onChoose: OnChoose;
}

const Surface = React.memo(function Surface({
  isOpen,
  isTop,
  chosen,
  onOpenChange,
  onChoose,
}: SurfaceProps) {
  const doors = getDoors(1, "surface");
  const layer = useLayer(1, doors, isTop, onChoose);

  return (
    <Combobox
      controller={layer.controller}
      open={isOpen}
      onOpenChange={(open, details) => {
        if (!open && (!isTop || details.reason === "item-press")) {
          details.cancel();
          return;
        }
        onOpenChange(open);
      }}
      value={chosen}
      onValueChange={layer.onValueChange}
      query={layer.query}
      onQueryChange={layer.onQueryChange}
      presentation="popover"
    >
      <div className="grid gap-2">
        <ComboboxLabel className="arcade-label">
          Layer 1 of {BOTTOM}
        </ComboboxLabel>
        <div className="flex gap-2">
          <ComboboxInput
            placeholder="Pick a door…"
            className="h-10 w-full min-w-0 border-[1.5px] border-input bg-background px-3 text-base leading-5 text-foreground outline-none placeholder:text-faint-foreground focus-visible:border-primary sm:text-[15px]"
          />
          <ComboboxTrigger
            aria-label="Show doors"
            className="grid size-10 shrink-0 place-items-center border-[1.5px] border-input bg-card text-xs text-foreground hover:border-foreground data-open:border-primary data-open:text-primary"
          >
            <span aria-hidden="true">▾</span>
          </ComboboxTrigger>
        </div>
      </div>
      <ComboboxContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        data-top={isTop ? "" : undefined}
        className={contentClass}
        style={layerStyle(1)}
      >
        <ComboboxEmpty className="px-3 py-2 text-muted-foreground empty:hidden">
          No doors match.
        </ComboboxEmpty>
        <DoorList depth={1} doors={doors} elements={layer.elements} />
        {layer.quip ? (
          <p className="px-2.5 pb-1 text-muted-foreground">{layer.quip}</p>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
});

interface LayerProps {
  depth: number;
  step: Step;
  isTop: boolean;
  chosen: string | null;
  onChoose: OnChoose;
  onClimb: (depth: number) => void;
}

const Layer = React.memo(function Layer({
  depth,
  step,
  isTop,
  chosen,
  onChoose,
  onClimb,
}: LayerProps) {
  const doors = getDoors(depth, step.door.label);
  const layer = useLayer(depth, doors, isTop, onChoose);

  function climb(shouldFocus: boolean) {
    if (shouldFocus) {
      step.opener.focus();
      step.opener.highlight(step.door.value);
    }
    onClimb(depth);
  }

  return (
    <Combobox
      controller={layer.controller}
      open
      onOpenChange={(open, details) => {
        if (open) return;
        details.cancel();
        if (isTop && details.reason === "escape-key") climb(true);
      }}
      value={chosen}
      onValueChange={layer.onValueChange}
      query={layer.query}
      onQueryChange={layer.onQueryChange}
      presentation="popover"
    >
      <ComboboxContent
        anchor={step.anchor}
        side="right"
        align="start"
        sideOffset={4}
        alignOffset={-8}
        collisionPadding={8}
        data-top={isTop ? "" : undefined}
        data-bottom={depth === BOTTOM ? "" : undefined}
        className={contentClass}
        style={layerStyle(depth)}
      >
        <div className="flex items-center justify-between gap-2 pl-0.5">
          <ComboboxLabel className="font-mono text-xs leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase group-data-top:text-foreground">
            Layer{" "}
            <span className="text-sm font-semibold tracking-normal text-secondary-foreground group-data-top:text-accent">
              {depth}
            </span>{" "}
            of {BOTTOM}
          </ComboboxLabel>
          <Button
            aria-label={`Climb up to layer ${depth - 1}`}
            onClick={(event) => climb(!isTouch(event.nativeEvent))}
            className="relative grid size-7 shrink-0 place-items-center border-[1.5px] border-input text-[13px] leading-4 text-foreground before:absolute before:-inset-1.5 hover:border-foreground"
          >
            <span aria-hidden="true">↑</span>
          </Button>
        </div>
        <ComboboxInput
          autoFocus={!step.isTouch}
          placeholder="Search doors…"
          className={inputClass}
        />
        <ComboboxEmpty className="px-3 py-2 text-muted-foreground empty:hidden">
          No doors match.
        </ComboboxEmpty>
        <DoorList depth={depth} doors={doors} elements={layer.elements} />
        {layer.quip ? (
          <p className="px-2.5 pb-1 text-muted-foreground">{layer.quip}</p>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
});

interface HudProps {
  depth: number;
  record: number;
  onBackOut: (event: React.MouseEvent) => void;
}

function Hud({ depth, record, onBackOut }: HudProps) {
  const isBottom = depth === BOTTOM;

  return (
    <>
      <section
        aria-label="Depth"
        data-bottom={isBottom ? "" : undefined}
        className="arcade-panel data-bottom:border-primary"
      >
        <p
          aria-hidden="true"
          className="arcade-panel-head arcade-label text-accent"
        >
          Depth
        </p>
        <p className="flex items-baseline gap-2.5 px-4 pt-3.5 pb-1">
          <span className="sr-only">Depth </span>
          <span className="arcade-readout text-7xl leading-[72px] tracking-[-0.05em] text-accent">
            {depth}
          </span>
          <span className="arcade-readout text-[26px] leading-8 tracking-[-0.02em] text-muted-foreground">
            / {BOTTOM}
          </span>
        </p>
        <div
          aria-hidden="true"
          className="flex flex-col gap-1.5 px-4 pt-2 pb-4"
        >
          <div className="flex h-2.5 border border-border bg-background">
            <div
              className="bg-accent"
              style={{ width: `${(depth / BOTTOM) * 100}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-xs leading-4 font-medium tracking-[0.06em] text-faint-foreground uppercase">
            <span>Surface</span>
            <span>The bottom</span>
          </div>
        </div>
        {isBottom ? (
          <p className="border-t border-divider px-4 py-3 font-mono text-xs leading-4 font-medium tracking-[0.06em] text-primary uppercase motion-safe:animate-pulse">
            You hit the bottom!
          </p>
        ) : null}
        <dl className="flex items-center justify-between border-t border-divider px-4 py-3">
          <dt className="arcade-label">Record</dt>
          <dd className="arcade-readout text-[22px] leading-6 tracking-[-0.02em]">
            {record}
          </dd>
        </dl>
      </section>
      <div className="h-[52px] shrink-0 [anchor-name:--back-out]">
        {depth > 1 ? (
          <BackOut key={depth} depth={depth} onBackOut={onBackOut} />
        ) : (
          <div aria-hidden="true" className={`${backOutClass} opacity-40`}>
            <BackOutLabel />
          </div>
        )}
      </div>
      <section className="flex flex-col gap-2.5 pt-1.5">
        <h2 className="arcade-label">How it works</h2>
        <p className="text-base leading-6 text-secondary-foreground">
          Every door opens another combobox. Doors marked ↘ go deeper; the rest
          are dead ends with something to say. The bottom is {BOTTOM} layers
          down.
        </p>
      </section>
    </>
  );
}

const backOutClass =
  "flex h-[52px] w-full items-center justify-between border-[1.5px] border-foreground bg-background px-[18px] text-foreground";

function BackOutLabel() {
  return (
    <>
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="text-lg leading-5">
          ↑
        </span>
        <span className="font-ui text-base leading-[22px] font-semibold">
          Back out
        </span>
      </span>
      <kbd aria-hidden="true" className="arcade-keycap px-1.5 tracking-normal">
        Esc
      </kbd>
    </>
  );
}

interface BackOutProps {
  depth: number;
  onBackOut: (event: React.MouseEvent) => void;
}

function BackOut({ depth, onBackOut }: BackOutProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const popover = ref.current;
    popover?.showPopover();
    return () => popover?.hidePopover();
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      className="pointer-events-none fixed inset-auto top-3 right-3 m-0 w-[min(360px,calc(100vw-1.5rem))] overflow-visible bg-transparent p-0 supports-[anchor-name:--a]:top-[anchor(top)] supports-[anchor-name:--a]:right-auto supports-[anchor-name:--a]:left-[anchor(left)] supports-[anchor-name:--a]:w-[anchor-size(width)] supports-[anchor-name:--a]:[position-anchor:--back-out]"
    >
      <Button
        aria-label={`Back out of layer ${depth}`}
        onClick={onBackOut}
        className={`pointer-events-auto ${backOutClass} hover:bg-card`}
      >
        <BackOutLabel />
      </Button>
    </div>
  );
}

export function InfiniteCombobox() {
  const [isSurfaceOpen, setIsSurfaceOpen] = React.useState(false);
  const [chain, setChain] = React.useState<Step[]>([]);
  const [record, setRecord] = React.useState(0);

  const depth = isSurfaceOpen ? chain.length + 1 : 0;

  React.useEffect(() => {
    prepareAnnouncements(document);
  }, []);
  const isBottom = depth === BOTTOM;

  const onSurfaceOpenChange = React.useCallback((open: boolean) => {
    setIsSurfaceOpen(open);
    if (open) setRecord((current) => Math.max(current, 1));
  }, []);

  const onChoose = React.useCallback<OnChoose>(
    (from, door, opener, anchor, source) => {
      setChain((current) => {
        const kept = current.slice(0, from - 1);
        if (door.quip !== null) return kept;
        return [...kept, { door, opener, anchor, isTouch: source === "touch" }];
      });
      if (door.quip === null) {
        setRecord((current) => Math.max(current, from + 1));
      }
    },
    [],
  );

  const onClimb = React.useCallback((from: number) => {
    setChain((current) => current.slice(0, from - 2));
  }, []);

  function onBackOut(event: React.MouseEvent) {
    const step = chain.at(-1);
    if (!step) return;
    if (!isTouch(event.nativeEvent)) {
      step.opener.focus();
      step.opener.highlight(step.door.value);
    }
    setChain(chain.slice(0, -1));
  }

  return (
    <Shell
      tape="03"
      tags={["Keyboard", "Screen reader"]}
      title="Infinite Combobox"
      kicker={`${BOTTOM} layers down · escape climbs up one at a time`}
      hints={hints}
      stageClassName="relative min-h-[28rem] overflow-clip"
      panel={<Hud depth={depth} record={record} onBackOut={onBackOut} />}
    >
      <div className="w-[300px] max-w-full p-7">
        <Surface
          isOpen={isSurfaceOpen}
          isTop={chain.length === 0}
          chosen={chain[0]?.door.value ?? null}
          onOpenChange={onSurfaceOpenChange}
          onChoose={onChoose}
        />
      </div>
      {chain.map((step, index) => (
        <Layer
          key={`${index + 1}-${step.door.value}`}
          depth={index + 2}
          step={step}
          isTop={index === chain.length - 1}
          chosen={chain[index + 1]?.door.value ?? null}
          onChoose={onChoose}
          onClimb={onClimb}
        />
      ))}
      <p role="status" className="sr-only">
        {isBottom
          ? `Layer ${BOTTOM}. You hit the bottom. Now climb back up.`
          : ""}
      </p>
    </Shell>
  );
}
