// app/methodology/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          How This Works
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Clear signals. Defensible logic. No hype.
        </p>
      </header>

      <section className="space-y-8">
        {/* WHAT IT IS */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            What MLB Valuations is
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            MLB Valuations is an <span className="font-semibold">authority-first performance signal</span>{" "}
            designed to answer a simple question:
            <span className="font-semibold"> who matters right now — and why?</span>
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-700">
            The site emphasizes recent impact, trajectory, and context rather than
            long-term projections or speculative forecasts.
          </p>
        </div>

        {/* WHAT THE RANKINGS MEAN */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            What the rankings represent
          </h2>

          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">Top 10 Players Right Now:</span>{" "}
              a WAR-led snapshot of current on-field impact, anchored to the most
              recent completed season.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Ordering principle:</span>{" "}
              performance first, with context applied second.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Purpose:</span>{" "}
              to surface momentum and stability quickly — not to predict exact outcomes.
            </li>
          </ul>
        </div>

        {/* WHAT IT IS NOT */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            What this is not
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Not betting picks or gambling advice</li>
            <li>Not game-level predictions</li>
            <li>Not a front-office contract simulator</li>
            <li>Not a fantasy projection engine</li>
          </ul>
        </div>

        {/* PLAYER PAGES */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            What you’ll see on player pages
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Recent Impact</div>
              <div className="mt-1 text-sm text-slate-700">
                High-level contribution over the most recent season.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Stability</div>
              <div className="mt-1 text-sm text-slate-700">
                Durability and consistency signals (e.g. games played).
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Long-Term Context</div>
              <div className="mt-1 text-sm text-slate-700">
                Career shape and baseline level.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Outlook</div>
              <div className="mt-1 text-sm text-slate-700">
                Directional signal (Up / Steady / Down) with confidence and reasoning.
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Back to Top 10
          </Link>
        </div>
      </section>
    </div>
  );
}
