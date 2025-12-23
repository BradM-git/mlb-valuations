// app/compare/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Player = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
};

function parseIdsCsv(s: string | string[] | undefined): number[] {
  if (!s) return [];
  const raw = Array.isArray(s) ? s.join(",") : s;
  return raw
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function uniq(nums: number[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const n of nums) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function outlookFromDelta(delta: number | null): "Up" | "Steady" | "Down" {
  if (delta == null || !Number.isFinite(delta)) return "Steady";
  if (delta >= 0.75) return "Up";
  if (delta <= -0.75) return "Down";
  return "Steady";
}

function pillClass(outlook: "Up" | "Steady" | "Down") {
  if (outlook === "Up") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (outlook === "Down") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

// player_seasons may have duplicates; page until we find 2 distinct seasons with non-null WAR
async function getTwoMostRecentDistinctWarSeasons(): Promise<[number | null, number | null]> {
  const seen = new Set<number>();
  const seasons: number[] = [];

  const pageSize = 250;
  let from = 0;

  while (seasons.length < 2) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("player_seasons")
      .select("season")
      .not("war", "is", null)
      .order("season", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`compare seasons query failed: ${error.message}`);

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const s = r?.season != null ? Number((r as any).season) : NaN;
      if (!Number.isFinite(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      seasons.push(s);
      if (seasons.length >= 2) break;
    }

    if (rows.length < pageSize) break;
    from += pageSize;
    if (from > 5000) break;
  }

  return [seasons[0] ?? null, seasons[1] ?? null];
}

export default async function ComparePage(props: {
  // Next 15/16 can provide searchParams as a Promise in some setups
  searchParams?: any;
}) {
  const sp = (await props.searchParams) ?? {};

  // Supports:
  // - /compare?add=476
  // - /compare?ids=476,3
  // - /compare?ids=476&add=3
  const idsParam = parseIdsCsv(sp.ids);
  const addParam = parseIdsCsv(sp.add);

  // cap at 6 for sanity + layout
  const ids = uniq([...idsParam, ...addParam]).slice(0, 6);
  const idsCsv = ids.join(",");

  // Carry compare selection into other pages so subsequent "Compare +" clicks can preserve state
  const carryQuery = idsCsv ? `?compare=${encodeURIComponent(idsCsv)}` : "";

  // Fetch players + season context
  let players: Player[] = [];
  let seasonA: number | null = null; // most recent
  let seasonB: number | null = null; // prior
  let warByPlayerSeason = new Map<number, Map<number, number | null>>();

  if (ids.length > 0) {
    const { data: playerRows, error: pErr } = await supabase
      .from("players")
      .select("id,name,team,position,age,image_url")
      .in("id", ids);

    if (pErr) throw new Error(`compare players query failed: ${pErr.message}`);

    const byId = new Map<number, Player>();
    for (const r of playerRows ?? []) {
      const id = Number((r as any).id);
      if (!Number.isFinite(id)) continue;
      byId.set(id, {
        id,
        name: String((r as any).name ?? "Unknown"),
        team: (r as any).team ?? null,
        position: (r as any).position ?? null,
        age: (r as any).age ?? null,
        image_url: (r as any).image_url ?? null,
      });
    }

    // Keep order from URL ids
    players = ids.map((id) => byId.get(id)).filter(Boolean) as Player[];

    // Season context + WAR deltas (Compare page can show metrics; homepage stays clean)
    const [a, b] = await getTwoMostRecentDistinctWarSeasons();
    seasonA = a;
    seasonB = b;

    if (seasonA != null && seasonB != null) {
      const { data: seasonRows, error: sErr } = await supabase
        .from("player_seasons")
        .select("player_id,season,war")
        .in("player_id", ids)
        .in("season", [seasonA, seasonB]);

      if (sErr) throw new Error(`compare seasons rows query failed: ${sErr.message}`);

      warByPlayerSeason = new Map<number, Map<number, number | null>>();
      for (const r of (seasonRows ?? []) as any[]) {
        const pid = Number(r.player_id);
        const season = Number(r.season);
        const warRaw = r.war;
        const war = warRaw == null ? null : Number(warRaw);

        if (!Number.isFinite(pid) || !Number.isFinite(season)) continue;
        if (!warByPlayerSeason.has(pid)) warByPlayerSeason.set(pid, new Map());
        warByPlayerSeason.get(pid)!.set(season, Number.isFinite(war as any) ? war : null);
      }
    }
  }

  const rows = players.map((p) => {
    const map = warByPlayerSeason.get(p.id) ?? new Map<number, number | null>();
    const warA = seasonA != null ? map.get(seasonA) ?? null : null;
    const warB = seasonB != null ? map.get(seasonB) ?? null : null;
    const delta = warA != null && warB != null ? warA - warB : null;
    const outlook = outlookFromDelta(delta);
    return { p, warA, warB, delta, outlook };
  });

  const removeHref = (removeId: number) => {
    const next = ids.filter((x) => x !== removeId);
    if (next.length === 0) return "/compare";
    return `/compare?ids=${encodeURIComponent(next.join(","))}`;
  };

  return (
    <div className="text-base">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
          ← Back
        </Link>
      </div>

      {/* ✅ Apply homepage panel gradient styling via class hook */}
      <div className="mv-panel rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900">Compare</h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
                Side-by-side context for a small set of players. Use “Compare +” from the dashboard or a player profile
                to build your list.
              </p>

              <div className="mt-5 text-sm text-slate-500">
                {seasonA && seasonB ? (
                  <span>
                    WAR context: <span className="font-semibold text-slate-700">{seasonB}</span> →{" "}
                    <span className="font-semibold text-slate-700">{seasonA}</span>
                  </span>
                ) : (
                  <span>Season context will appear once WAR data is available.</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/compare"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Clear comparison →
              </Link>
            </div>
          </div>

          {ids.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8">
              <div className="text-sm font-semibold text-slate-900">No players selected</div>
              <div className="mt-2 text-sm text-slate-600">
                Go to the dashboard and click <span className="font-semibold">Compare +</span> on any player.
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/#browse"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
                >
                  Browse Players
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Player cards */}
              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(({ p, outlook }) => (
                  <div key={p.id} className="mv-panel rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <Link
                          href={`/players/${p.id}${carryQuery}`}
                          className="flex items-center gap-3 min-w-0"
                          prefetch={false}
                        >
                          <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.image_url ?? "/placeholder.png"}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">{p.name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {p.team ?? "Unknown"} · {p.position ?? "—"}
                              {p.age != null ? ` · Age ${p.age}` : ""}
                            </div>
                          </div>
                        </Link>

                        <Link
                          href={removeHref(p.id)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          title="Remove from comparison"
                        >
                          Remove
                        </Link>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border",
                            pillClass(outlook),
                          ].join(" ")}
                          title="Derived from year-over-year WAR change (latest seasons)"
                        >
                          {outlook}
                        </span>

                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{p.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comparison table */}
              <div className="mt-8 mv-panel rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <div className="text-sm font-semibold text-slate-900">Quick comparison</div>
                  <div className="mt-1 text-xs text-slate-500">Compare page can show metrics (homepage stays clean).</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                          {seasonA ? `WAR (${seasonA})` : "Latest WAR"}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                          {seasonB ? `WAR (${seasonB})` : "Prior WAR"}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Δ</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Outlook</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map(({ p, warA, warB, delta, outlook }) => (
                        <tr key={`row-${p.id}`} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <Link
                              href={`/players/${p.id}${carryQuery}`}
                              className="font-semibold text-slate-900 hover:text-slate-700"
                              prefetch={false}
                            >
                              {p.name}
                            </Link>
                            <div className="mt-1 text-xs text-slate-500">
                              {p.team ?? "Unknown"} · {p.position ?? "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 tabular-nums">{warA == null ? "—" : warA.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 tabular-nums">{warB == null ? "—" : warB.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 tabular-nums">
                            {delta == null ? "—" : delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border",
                                pillClass(outlook),
                              ].join(" ")}
                            >
                              {outlook}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Tip: share this comparison by copying the URL. To keep your selection while browsing, use the “Add more
                    players” link below.
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/players${carryQuery}`} className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                      Add more players →
                    </Link>
                    <Link href="/compare" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                      Clear →
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
