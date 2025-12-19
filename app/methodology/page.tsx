// app/methodology/page.tsx
import Link from "next/link";

export default function MethodologyPage() {
  return (
    <div className="text-base">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
          <p className="mt-3 text-slate-600 max-w-3xl">
            MLB Valuations estimates what a player is worth in today’s game — using performance first,
            then adjusting for the things teams actually care about when projecting the next few years.
          </p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold">What this site is</h2>
              <p className="mt-2 text-slate-600">
                A fast way to compare players, see who drives real on-field value, and understand the “why”
                behind a ranking. Search any player, open their profile, and you’ll see a value estimate plus
                recent year-by-year performance.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold">What the “value” number means</h2>
              <p className="mt-2 text-slate-600">
                The estimate is an “on-field value” view — it’s not a prediction of the exact next contract,
                but a comparable number you can use to evaluate players side-by-side.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight">The model: WAR-first</h2>
            <p className="mt-3 text-slate-600 max-w-3xl">
              WAR is the primary signal because it captures total on-field contribution. Everything else is a
              modifier layered on top to better reflect how teams project future value.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold">1) Start with recent WAR</h3>
                <p className="mt-1 text-slate-600">
                  We anchor the estimate on recent WAR (with weighting tuned to emphasize what a player is now,
                  not what they were 7 years ago).
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold">2) Adjust for playing time</h3>
                <p className="mt-1 text-slate-600">
                  A player who produced strong WAR in fewer games is treated differently than someone who did it
                  over a full season. Durability matters.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold">3) Apply age and position context</h3>
                <p className="mt-1 text-slate-600">
                  Age influences how far into the future teams can reasonably project performance. Position also
                  matters because some defensive positions are simply harder to replace.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold">4) TPS is a modifier (not the driver)</h3>
                <p className="mt-1 text-slate-600">
                  TPS is used only as a small adjustment on top of the WAR-based estimate — think of it as an
                  extra lens, not the foundation.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold">How to use this site</h2>
            <ol className="mt-3 space-y-2 text-slate-600 list-decimal list-inside">
              <li>
                Go to <Link className="font-semibold text-slate-900 hover:underline" href="/players">Browse Players</Link> and search any name.
              </li>
              <li>Open a player to see their estimated value and recent WAR by season.</li>
              <li>Use the list to compare across teams/positions and spot undervalued players.</li>
            </ol>
          </div>

          <div className="mt-10 text-sm text-slate-500">
            Note: this is an analytical tool for comparison, not official MLB data or financial advice.
          </div>
        </div>
      </div>
    </div>
  );
}
