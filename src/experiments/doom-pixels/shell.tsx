"use client";

import Link from "next/link";
import * as React from "react";

export interface ShellHint {
  key: string;
  cap: string;
  hint: string;
}

interface ShellProps {
  tape: string;
  tags: string[];
  title: string;
  kicker: string;
  hints: ShellHint[];
  panel: React.ReactNode;
  footerEnd?: React.ReactNode;
  stageClassName?: string;
  children: React.ReactNode;
}

export function Shell({
  tape,
  tags,
  title,
  kicker,
  hints,
  panel,
  footerEnd,
  stageClassName,
  children,
}: ShellProps) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-clip lg:h-dvh lg:min-h-[44rem]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[220px] left-[240px] -z-10 h-[560px] w-[760px] max-w-full rounded-full bg-primary/12 blur-[140px]"
      />
      <header className="flex items-center justify-between gap-6 px-4 pt-6 sm:px-14 sm:pt-8">
        <div className="flex items-center gap-7">
          <p className="flex items-center gap-3.5 font-mono text-xl leading-6 font-semibold tracking-[0.04em] whitespace-nowrap uppercase max-sm:hidden">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 bg-primary shadow-[0_0_16px_var(--color-primary)]"
            />
            Aria Arcade
          </p>
          <span
            aria-hidden="true"
            className="h-5 w-px bg-white/14 max-sm:hidden"
          />
          <Link href="/" className="group flex items-center gap-2">
            <span
              aria-hidden="true"
              className="arcade-keycap group-hover:border-foreground"
            >
              ◂
            </span>
            <span className="arcade-hint group-hover:text-foreground">
              Back to shelf
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-8">
          <ul className="flex items-center gap-8 max-lg:hidden">
            <li className="arcade-hint text-foreground">Tape {tape} / 04</li>
            {tags.map((tag) => (
              <li key={tag} className="arcade-hint">
                {tag}
              </li>
            ))}
          </ul>
          <Clock />
        </div>
      </header>
      <div className="flex items-center gap-6 px-4 pt-7 sm:px-14">
        <Cover />
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="arcade-label bg-primary px-2 py-1 text-primary-foreground">
              Now playing
            </span>
            <span className="arcade-label">{kicker}</span>
          </p>
          <h1 className="font-display text-4xl leading-9 font-black tracking-[-0.04em] uppercase [font-stretch:125%] [font-variation-settings:'wdth'_125] sm:text-[56px] sm:leading-[52px]">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-8 px-4 pt-7 sm:px-14 lg:min-h-0 lg:flex-row">
        <div
          className={`arcade-frame flex min-w-0 flex-1 ${stageClassName ?? ""}`}
        >
          {children}
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-5 lg:-mx-1 lg:-mt-1 lg:-mr-2.5 lg:min-h-0 lg:w-[374px] lg:overflow-y-auto lg:pt-1 lg:pr-2.5 lg:pb-2.5 lg:pl-1">
          {panel}
        </aside>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3 px-4 pt-6 pb-7 sm:px-14">
        <ul
          aria-label="Key hints"
          className="flex flex-wrap items-center gap-x-7 gap-y-3"
        >
          {hints.map(({ key, cap, hint }) => (
            <li key={key} className="flex items-center gap-2">
              <kbd className="arcade-keycap">
                <span aria-hidden="true">{cap}</span>
                <span className="sr-only">{key}</span>
              </kbd>
              <span className="arcade-hint">{hint}</span>
            </li>
          ))}
        </ul>
        {footerEnd}
      </footer>
    </main>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

function Clock() {
  const time = React.useSyncExternalStore(
    subscribeToClock,
    () => timeFormat.format(Date.now()),
    () => "",
  );
  return (
    <time className="min-w-[77px] text-right font-mono text-lg leading-[30px] font-medium text-accent tabular-nums">
      {time}
    </time>
  );
}

const coverDark: [number, number, number, number][] = [
  [0, 64, 104, 16],
  [8, 56, 16, 8],
  [40, 48, 24, 16],
  [80, 52, 16, 12],
  [44, 20, 16, 8],
  [40, 28, 24, 20],
  [36, 32, 4, 12],
  [64, 32, 4, 12],
];

const coverStars = [
  [4, 8],
  [24, 0],
  [88, 12],
  [72, 4],
];

function Cover() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[90px] w-[66px] shrink-0 -rotate-4 flex-col overflow-clip bg-foreground shadow-[6px_8px_0_#0000008c] max-sm:hidden"
    >
      <p className="bg-background px-[5px] py-[3px] font-mono text-[5px] leading-[6px] font-semibold tracking-[0.04em] text-foreground uppercase">
        Aria Arcade
      </p>
      <div className="flex flex-1 items-center justify-center">
        <svg viewBox="0 0 104 80" className="h-[37px] w-12">
          {coverDark.map(([x, y, width, height]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="#0b0a0d"
            />
          ))}
          <rect x="46" y="22" width="4" height="4" fill="#e5484d" />
          <rect x="54" y="22" width="4" height="4" fill="#e5484d" />
          {coverStars.map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="4"
              height="4"
              fill="#ffc23d"
            />
          ))}
        </svg>
      </div>
      <p className="px-[5px] pb-1.5 font-heavy text-[10px] leading-[10px] tracking-[-0.02em] text-background uppercase">
        Doom
        <br />
        Pixels
      </p>
    </div>
  );
}
