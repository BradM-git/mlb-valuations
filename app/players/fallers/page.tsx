// app/players/fallers/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = { id: number; name: string };

async function getFallers(): Promise<{
  seasonA: number | null;
  seasonB: number | null;
  rows: Row[];
}> {
  const { data: seasons, error: seasonErr } = await supabase
    .from("player_seasons")
    .select("season")
    .not("war", "is", null)
    .order("season", { ascending: false })
    .limit(2);

  if (seasonErr) throw new Error(`seasons query failed: ${seasonErr.message}`);

  const seasonA = seasons?.[0]?.season != null ? Number(seasons[0].season) : null;
  const seasonB = seasons?.[1]?.season != null ? Number(seasons[1].season) : null;

  if (seasonA == null || seasonB == null) return { seasonA, seasonB, rows: [] };

  const { data: ps, error: psErr } = await supabase
    .from("player_seasons")
    .select("player_id,season,war")
    .in("season", [seasonA, seasonB])
    .not("war", "is", null);

  if (psErr) throw new Error(`player_seasons query failed: ${psErr.message}`);

  const warByPlayer = new Map<number, { a?: number; b?: number }>();
  for (const r of ps ?? []) {
    const pid = Number((r as any).player_id);
    const season = Number((r as any).season);
    const war = Number((r as any).war);
    if (!Number.isFinite(pid) || !Number.isFinite(season) || !Number.isFinite(war)) continue;
    const cur = warByPlayer.get(pid) ?? {};
    if (season === seasonA) cur.a = war;
    if (season === seasonB) cur.b = war;
    warByPlayer.set(pid, cur);
  }

  const deltas: Array<{ player_id: number; delta: number }> = [];
  for (const [pid, w] of warByPlayer.entries()) {
    if (w.a == null || w.b == null) continue;
    deltas.push({ player_id: pid, delta: w.a - w.b });
  }

  const ids = deltas
    .sort((x, y) => x.delta - y.delta)
    .slice(0, 50)
    .map((d) => d.player_id);

  if (ids.length === 0) return { seasonA, seasonB, rows: [] };

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id,name")
    .in("id", ids);

  if (pErr) throw new Error(`players query failed: ${pErr.message}`);

  const nameById = new Map<number, string>();
  for (const p of players ?? []) {
    const id = Number((p as any).id);
    const name = String((p as any).name ?? "").trim();
    if (Number.isFinite(id) && name) nameById.set(id, name);
  }

  const rows = ids
    .map((id) => ({ id, name: nameById.get(id) ?? "Unknown" }))
    .filter((r) => r.name !== "Unknown");

  return { seasonA, seasonB, rows };
}

export default async function FallersPage({
  searchParams,
}: {
  searchParams?: Promise<{ compare?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const compare = (sp.compare ?? "").trim();
  const carry = compare ? `?compare=${encodeURIComponent(compare)}` : "";

  let seasonA: number | null = null;
  let seasonB: number | null = null;
  let rows: Row[] = [];
  let error: string | null = null;

  try {
    const out = await getFallers();
    seasonA = out.seasonA;
    seasonB = out.seasonB;
    rows = out.rows;
  } catch (e: any) {
    error = e?.message ?? "Unknown error";
    console.error("[FALLERS_ERROR]", error);
  }

  const compareHrefFor = (playerId: number) => {
    if (!compare) return `/compare?add=${playerId}`;
    return `/compare?ids=${encodeURIComponent(compare)}&add=${playerId}`;
  };

  const playerHrefFor = (playerId: number) => {
    if (!compare) return `/players/${playerId}`;
    return `/players/${playerId}${carry}`;
  };

  return (
    <div className="text-base">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Fallers</h1>
              <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">
                Players with the biggest year-over-year WAR declines across the two most recent completed seasons.
                It’s an explainable “movement” signal — not a projection.
              </p>
              <div className="mt-2 text-xs text-slate-500">
                {seasonA && seasonB ? `WAR change: ${seasonB} → ${seasonA}` : "WAR change: latest seasons"}
              </div>

              {compare ? (
                <div className="mt-3 text-xs text-slate-500">
                  Compare list active:{" "}
                  <Link
                    href={`/compare?ids=${encodeURIComponent(compare)}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    view comparison →
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/watchlist${carry}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Watchlist
              </Link>
              <Link
                href={`/players/risers${carry}`}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                View Risers
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-8 text-sm text-slate-600">
              Couldn’t load fallers. Try refreshing.
              <div className="mt-2 text-xs text-slate-400">(Server log: FALLERS_ERROR)</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-8 text-sm text-slate-600">Not enough data yet.</div>
          ) : (
            <div className="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="text-sm font-semibold text-slate-900">Top movers down</div>
                <div className="mt-1 text-xs text-slate-500">Names only here — open a profile for full context.</div>
              </div>

              <div className="divide-y divide-slate-200">
                {rows.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 text-xs font-semibold text-slate-500 tabular-nums">{idx + 1}</div>
                      <Link
                        href={playerHrefFor(p.id)}
                        className="truncate text-sm font-semibold text-slate-900 hover:text-slate-700"
                        prefetch={false}
                      >
                        {p.name}
                      </Link>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={compareHrefFor(p.id)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                        title="Add to Compare"
                        prefetch={false}
                      >
                        Compare +
                      </Link>
                      <span className="text-amber-700 text-sm">▼</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 text-xs text-slate-500">
            Note: Movement is based on year-over-year WAR deltas for completed seasons.
          </div>
        </div>
      </div>
    </div>
  );
}
