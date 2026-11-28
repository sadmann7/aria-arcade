import Link from "next/link";

import { experiments } from "@/experiments";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-3xl content-start gap-10 px-4 py-12 sm:py-16">
      <header className="grid gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
            className="size-9 shrink-0 shadow-[3px_3px_0_var(--color-foreground)]"
          >
            <rect width="16" height="16" fill="var(--color-primary)" />
            <path
              fill="var(--color-background)"
              d="M6 3h4v1h-4zM5 4h6v1h-6zM4 5h2v3h-2zM10 5h2v3h-2zM6 7h4v2h-4zM4 8h2v5h-2zM10 8h2v5h-2z"
            />
          </svg>
          Aria Arcade
        </h1>
        <p className="max-w-[60ch] text-pretty text-muted-foreground">
          Keyboard navigation, focus, selection, popups and drag and drop, used
          as game mechanics.
        </p>
      </header>
      <section aria-labelledby="experiments" className="grid gap-4">
        <h2 id="experiments" className="text-base font-medium">
          Experiments
        </h2>
        {experiments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing to play yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {experiments.map((experiment) => (
              <li key={experiment.slug}>
                <Link
                  href={`/${experiment.slug}`}
                  className="grid gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-medium">{experiment.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {experiment.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
