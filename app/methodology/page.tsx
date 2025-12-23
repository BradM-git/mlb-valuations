// app/methodology/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="mv-panel rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
      {props.children}
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="text-base">
      {/* Back link (top-left, like Compare) */}
      <div className="mb-4">
        <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
          ← Back
        </Link>
      </div>

      {/* Main page wrapper styled like Compare */}
      <div className="mv-panel rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-8 sm:p-10">
          <header className="mb-8">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900">
              How It Works
            </h1>
            <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
              Clear signals. Defensible logic. No hype.
            </p>
          </header>

          <section className="space-y-8">
            <Panel title="What MLB Valuations is">
              <p className="mt-2 text-sm leading-6 text-slate-700">
                MLB Valuations is a performance-first dashboard designed to answer a simple question:
                <span className="font-semibold"> who is driving wins right now — and why?</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                It emphasizes on-field impact and explainable signals. The goal is clarity: show what’s happening,
                surface movement, and let you drill into player context without requiring projections or hype.
              </p>
            </Panel>

            <Panel title="What you can do on the site">
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>
                  <span className="font-semibold text-slate-900">Top 10 Players Right Now:</span> ranked primarily by the
                  most recent current-season WAR available.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Movement Watch:</span> highlights biggest risers and
                  fallers using year-over-year WAR deltas (latest available seasons).
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Browse Players:</span> search any player and open their
                  profile for deeper context.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Compare:</span> build a short list from “Compare +” and
                  view side-by-side WAR context.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">League context panels:</span> standings, team form,
                  league leaders, plus latest transfers and rumors.
                </li>
              </ul>
            </Panel>

            <Panel title="What the rankings represent">
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <span className="font-semibold text-slate-900">Ordering principle:</span> performance first, context
                  second.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Purpose:</span> surface impact and movement quickly —
                  not predict exact outcomes.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Explainability:</span> rankings and movement are tied to
                  visible season WAR inputs.
                </li>
              </ul>
            </Panel>

            <Panel title="What you’ll see on player pages">
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Recent Impact</div>
                  <div className="mt-1 text-sm text-slate-700">
                    High-level contribution over the most recent seasons available.
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
                    Career shape and baseline level for grounding.
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Compare workflow</div>
                  <div className="mt-1 text-sm text-slate-700">
                    Use “Compare +” to build a list and view side-by-side context.
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="What this is not">
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>Not betting picks or gambling advice</li>
                <li>Not game-level predictions</li>
                <li>Not a contract simulator</li>
                <li>Not a fantasy projection engine</li>
              </ul>
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}
