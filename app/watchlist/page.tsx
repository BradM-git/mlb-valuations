// app/watchlist/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type MovementRow = { id: number; name: string };

function fmtSeasonLabel(seasonA: number | null, seasonB: number | null) {
  if (!seasonA || !seasonB) return "latest seasons";
  return `${seasonB} → ${seasonA}`;
}

async function getMovementWatch(): Promise<{
  seasonA: number | null;
  seasonB: number | null;
  risers: MovementRow[];
  fallers: MovementRow[];
}> {
  const { data: seasons, error: seasonErr } = await supabase
    .from("player_seasons")
    .select("season")
    .not("war", "is", null)
    .order("season", { ascending: false })
    .limit(2);

  if (seasonErr) throw new Error(`movement seasons query failed: ${seasonErr.message}`);

  const seasonA = seasons?.[0]?.season != null ? Number(seasons[0].season) : null;
  const seasonB = seasons?.[1]?.season != null ? Number(seasons[1].season) : null;

  if (seasonA == null || seasonB == null) {
    return { seasonA, seasonB, risers: [], fallers: [] };
  }

  const { data: rows, error: mvErr } = await supabase
    .from("player_seasons")
    .select("player_id,season,war")
    .in("season", [seasonA, seasonB])
    .not("war", "is", null);

  if (mvErr) throw new Error(`movement war query failed: ${mvErr.message}`);

  const warByPlayer = new Map<number, { a?: number; b?: number }>();
  for (const r of rows ?? []) {
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

  const riserIds = [...deltas]
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 15)
    .map((d) => d.player_id);

  const fallerIds = [...deltas]
    .sort((x, y) => x.delta - y.delta)
    .slice(0, 15)
    .map((d) => d.player_id);

  const uniqueIds = Array.from(new Set([...riserIds, ...fallerIds]));
  if (uniqueIds.length === 0) return { seasonA, seasonB, risers: [], fallers: [] };

  const { data: players, error: plErr } = await supabase
    .from("players")
    .select("id,name")
    .in("id", uniqueIds);

  if (plErr) throw new Error(`movement players query failed: ${plErr.message}`);

  const nameById = new Map<number, string>();
  for (const p of players ?? []) {
    const id = Number((p as any).id);
    const name = String((p as any).name ?? "").trim();
    if (Number.isFinite(id) && name) nameById.set(id, name);
  }

  const risers = riserIds
    .map((id) => ({ id, name: nameById.get(id) ?? "Unknown" }))
    .filter((x) => x.name !== "Unknown");

  const fallers = fallerIds
    .map((id) => ({ id, name: nameById.get(id) ?? "Unknown" }))
    .filter((x) => x.name !== "Unknown");

  return { seasonA, seasonB, risers, fallers };
}

async function getLeadersRightNow(): Promise<Array<{ id: number; name: string }>> {
  const { data: players, error: pErr } = await supabase.from("players").select("id,name");
  if (pErr) throw new Error(`players query failed: ${pErr.message}`);

  const safePlayers = (players ?? []) as Array<{ id: number; name: string }>;
  if (safePlayers.length === 0) return [];

  const ids = safePlayers.map((p) => p.id);

  const { data: seasons, error: sErr } = await supabase
    .from("player_seasons")
    .select("player_id,season,war")
    .in("player_id", ids);

  if (sErr) throw new Error(`player_seasons query failed: ${sErr.message}`);

  const latestByPlayer = new Map<number, { season: number; war: number | null }>();
  for (const s of seasons ?? []) {
    const pid = Number((s as any).player_id);
    const season = Number((s as any).season);
    const warRaw = (s as any).war;
    const war = warRaw == null ? null : Number(warRaw);
    if (!Number.isFinite(pid) || !Number.isFinite(season)) continue;

    const prev = latestByPlayer.get(pid);
    if (!prev || season > prev.season) {
      latestByPlayer.set(pid, { season, war: Number.isFinite(war as any) ? war : null });
    }
  }

  const nameById = new Map<number, string>();
  for (const p of safePlayers) nameById.set(p.id, p.name);

  const rows = Array.from(latestByPlayer.entries()).map(([id, v]) => ({
    id,
    name: nameById.get(id) ?? "Unknown",
    war: v.war ?? -Infinity,
  }));

  rows.sort((a, b) => (b.war as number) - (a.war as number));
  return rows
    .filter((r) => r.name !== "Unknown")
    .slice(0, 15)
    .map(({ id, name }) => ({ id, name }));
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams?: Promise<{ compare?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const compare = (sp.compare ?? "").trim();
  const carry = compare ? `?compare=${encodeURIComponent(compare)}` : "";

  const compareHrefFor = (playerId: number) => {
    if (!compare) return `/compare?add=${playerId}`;
    return `/compare?ids=${encodeURIComponent(compare)}&add=${playerId}`;
  };

  const playerHrefFor = (playerId: number) => {
    if (!compare) return `/players/${playerId}`;
    return `/players/${playerId}${carry}`;
  };

  let movement: Awaited<ReturnType<typeof getMovementWatch>> = {
    seasonA: null,
    seasonB: null,
    risers: [],
    fallers: [],
  };

  let leaders: Array<{ id: number; name: string }> = [];
  let error: string | null = null;

  try {
    movement = await getMovementWatch();
    leaders = await getLeadersRightNow();
  } catch (e: any) {
    error = e?.message ?? "Unknown error";
    console.error("[WATCHLIST_ERROR]", error);
  }

  return (
    <div className="text-base">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Watchlist</h1>
              <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">
                A simple hub for what’s changing and who’s consistently driving impact. No picks — just
                signals you can sanity-check.
              </p>

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
                href={`/players${carry}`}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                Browse Players
              </Link>
              <Link
                href="/methodology"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                How it works
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
              Couldn’t load watchlist right now. Try refreshing.
              <div className="mt-2 text-xs text-slate-500">(Server log: WATCHLIST_ERROR)</div>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Leaders */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                  <div className="text-sm font-semibold text-slate-900">Leaders (Right Now)</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Ranked by current-season WAR (shown on player pages).
                  </div>
                </div>
                <div className="p-6">
                  {leaders.length === 0 ? (
                    <div className="text-sm text-slate-600">No leader data yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {leaders.map((p) => (
                        <li key={`l-${p.id}`} className="flex items-center justify-between">
                          <Link
                            href={playerHrefFor(p.id)}
                            className="text-sm font-semibold text-slate-900 hover:text-slate-700 truncate"
                            prefetch={false}
                          >
                            {p.name}
                          </Link>
                          <div className="flex items-center gap-3">
                            <Link
                              href={compareHrefFor(p.id)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                              title="Add to Compare"
                              prefetch={false}
                            >
                              Compare +
                            </Link>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              Leader
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Risers */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Risers</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Year-over-year WAR change: {fmtSeasonLabel(movement.seasonA, movement.seasonB)}
                    </div>
                  </div>
                  <Link
                    href={`/players/risers${carry}`}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Full list →
                  </Link>
                </div>
                <div className="p-6">
                  {movement.risers.length === 0 ? (
                    <div className="text-sm text-slate-600">No riser data yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {movement.risers.slice(0, 12).map((p) => (
                        <li key={`r-${p.id}`} className="flex items-center justify-between">
                          <Link
                            href={playerHrefFor(p.id)}
                            className="text-sm font-semibold text-slate-900 hover:text-slate-700 truncate"
                            prefetch={false}
                          >
                            {p.name}
                          </Link>
                          <div className="flex items-center gap-3">
                            <Link
                              href={compareHrefFor(p.id)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                              title="Add to Compare"
                              prefetch={false}
                            >
                              Compare +
                            </Link>
                            <span className="text-emerald-700 text-sm">▲</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Fallers */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Fallers</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Year-over-year WAR change: {fmtSeasonLabel(movement.seasonA, movement.seasonB)}
                    </div>
                  </div>
                  <Link
                    href={`/players/fallers${carry}`}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Full list →
                  </Link>
                </div>
                <div className="p-6">
                  {movement.fallers.length === 0 ? (
                    <div className="text-sm text-slate-600">No faller data yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {movement.fallers.slice(0, 12).map((p) => (
                        <li key={`f-${p.id}`} className="flex items-center justify-between">
                          <Link
                            href={playerHrefFor(p.id)}
                            className="text-sm font-semibold text-slate-900 hover:text-slate-700 truncate"
                            prefetch={false}
                          >
                            {p.name}
                          </Link>
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 text-xs text-slate-500">
            Note: This page is a navigation hub. Raw metrics belong on player pages (context + defensibility).
          </div>
        </div>
      </div>
    </div>
  );
}
