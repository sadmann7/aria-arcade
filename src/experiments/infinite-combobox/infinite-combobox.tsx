"use client";

import type { ChangeSource } from "@ui-sdk/core";

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
import Link from "next/link";
import * as React from "react";

import { BOTTOM, type Door, getDoors } from "./doors";

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
  "grid w-[min(16rem,calc(100vw-1rem))] gap-2 rounded-xl border border-t-4 border-border border-t-(--layer-color) bg-card p-2 text-sm text-foreground shadow-xl shadow-black/50 transition-[opacity,scale] duration-150 origin-(--transform-origin) rotate-(--layer-tilt) data-bottom:ring-2 data-bottom:ring-primary data-starting-style:scale-90 data-starting-style:opacity-0 motion-reduce:transition-none";

const itemClass =
  "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 select-none data-highlighted:bg-muted data-selected:text-primary data-selected:font-medium";

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring sm:text-sm";

function layerStyle(depth: number) {
  return {
    "--layer-color": `oklch(0.72 0.17 ${(depth * 29) % 360})`,
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
            <span aria-hidden="true" className="text-muted-foreground">
              ↘
            </span>
          ) : null}
        </ComboboxItem>
      ))}
    </ComboboxList>
  );
}

function useLayer(depth: number, doors: Door[], onChoose: OnChoose) {
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
    if (door.quip !== null) details.cancel();
    onChoose(
      depth,
      door,
      controller,
      elements.get(door.value) ?? null,
      details.source,
    );
  }

  function onQueryChange(next: string, details: { reason: string }) {
    if (details.reason !== "item-press") setQuery(next);
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
  const layer = useLayer(1, doors, onChoose);

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
        <ComboboxLabel className="text-sm font-medium">
          Layer 1 of {BOTTOM}
        </ComboboxLabel>
        <div className="flex gap-2">
          <ComboboxInput placeholder="Pick a door…" className={inputClass} />
          <ComboboxTrigger
            aria-label="Show doors"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-foreground focus-visible:outline-2 focus-visible:outline-ring data-open:text-primary"
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
        className={contentClass}
        style={layerStyle(1)}
      >
        <ComboboxEmpty className="px-3 py-2 text-muted-foreground empty:hidden">
          No doors match.
        </ComboboxEmpty>
        <DoorList depth={1} doors={doors} elements={layer.elements} />
        {layer.quip ? (
          <p aria-live="polite" className="px-3 pb-1 text-muted-foreground">
            {layer.quip}
          </p>
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
  const layer = useLayer(depth, doors, onChoose);

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
        data-bottom={depth === BOTTOM ? "" : undefined}
        className={contentClass}
        style={layerStyle(depth)}
      >
        <div className="flex items-center justify-between gap-2 pl-1">
          <ComboboxLabel className="font-medium tabular-nums">
            Layer {depth} of {BOTTOM}
          </ComboboxLabel>
          <Button
            aria-label={`Climb up to layer ${depth - 1}`}
            onClick={(event) => climb(!isTouch(event.nativeEvent))}
            className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
          <p aria-live="polite" className="px-3 pb-1 text-muted-foreground">
            {layer.quip}
          </p>
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
  const ref = React.useRef<HTMLDivElement>(null);
  const isBottom = depth === BOTTOM;

  React.useEffect(() => {
    const hud = ref.current;
    hud?.showPopover();
    return () => hud?.hidePopover();
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      data-bottom={isBottom ? "" : undefined}
      className="pointer-events-none fixed inset-auto top-3 right-3 m-0 grid gap-0.5 rounded-xl border border-border bg-card/90 px-3 py-2 text-right text-xs text-muted-foreground tabular-nums shadow-lg data-bottom:border-primary data-bottom:text-primary"
    >
      <span>
        Depth <strong className="text-base text-foreground">{depth}</strong> /{" "}
        {BOTTOM}
      </span>
      <span>Record {record}</span>
      {isBottom ? (
        <span className="animate-bounce font-medium motion-reduce:animate-none">
          You hit the bottom!
        </span>
      ) : null}
      {depth > 1 ? (
        <Button
          aria-label={`Back out of layer ${depth}`}
          onClick={onBackOut}
          className="pointer-events-auto mt-1 h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          ↑ Back out
        </Button>
      ) : null}
    </div>
  );
}

export function InfiniteCombobox() {
  const [isSurfaceOpen, setIsSurfaceOpen] = React.useState(false);
  const [chain, setChain] = React.useState<Step[]>([]);
  const [record, setRecord] = React.useState(0);

  const depth = isSurfaceOpen ? chain.length + 1 : 0;
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
    <main className="mx-auto grid min-h-dvh w-full max-w-3xl content-start gap-8 px-4 py-12 sm:py-16">
      <header className="grid gap-3">
        <Link
          href="/"
          className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Aria Arcade
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Infinite combobox
        </h1>
        <p className="max-w-[60ch] text-pretty text-muted-foreground">
          Every door opens another combobox. The bottom is {BOTTOM} layers down.
          Escape climbs back up one layer at a time, and so does Back out.
        </p>
      </header>
      <div className="max-w-xs">
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
      <Hud key={depth} depth={depth} record={record} onBackOut={onBackOut} />
      <p role="status" className="sr-only">
        {isBottom
          ? `Layer ${BOTTOM}. You hit the bottom. Now climb back up.`
          : ""}
      </p>
    </main>
  );
}
