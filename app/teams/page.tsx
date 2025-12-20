// app/teams/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function slugifyTeamName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function TeamsPage() {
  const { data, error } = await supabase
    .from("players")
    .select("team")
    .not("team", "is", null);

  if (error) {
    console.error("[TEAMS_LIST_ERROR]", error.message);
  }

  const teamsRaw = (data ?? [])
    .map((r: any) => String(r.team ?? "").trim())
    .filter(Boolean);

  const uniqueTeams = Array.from(new Set(teamsRaw)).sort((a, b) => a.localeCompare(b));

  return (
    <div className="text-base">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Teams</h1>
              <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">
                Team pages are built around the same principle as player pages: highlight what’s changing
                and keep it explainable.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/players"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                Browse Players
              </Link>
              <Link
                href="/watchlist"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Watchlist
              </Link>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-900">Status</div>
            <p className="mt-2 text-sm text-slate-700">
              This is a lightweight first pass: we list teams detected from player records. Team-level signals
              and “what’s changing” summaries come next.
            </p>
          </div>

          <div className="mt-10">
            <div className="text-sm font-semibold text-slate-900">Browse</div>

            {error ? (
              <div className="mt-4 text-sm text-slate-600">
                Couldn’t load teams. Try refreshing.
                <div className="mt-2 text-xs text-slate-400">(Server log: TEAMS_LIST_ERROR)</div>
              </div>
            ) : uniqueTeams.length === 0 ? (
              <div className="mt-4 text-sm text-slate-600">No teams found yet.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {uniqueTeams.map((team) => {
                  const slug = slugifyTeamName(team);
                  return (
                    <Link
                      key={slug}
                      href={`/teams/${slug}`}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:bg-slate-50 transition"
                    >
                      <div className="text-sm font-semibold text-slate-900">{team}</div>
                      <div className="mt-1 text-xs text-slate-500">View team page →</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-10 text-xs text-slate-500">
            Note: Team pages will remain descriptive and defensible (no picks, no projections sold as certainty).
          </div>
        </div>
      </div>
    </div>
  );
}
