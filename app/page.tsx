// app/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";
import { PlannedFeaturesPanel } from "@/app/components/PlannedFeaturesPanel";
import { BrowsePlayersPanel } from "@/app/components/BrowsePlayersPanel";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  tps: number | null;
  games_played: number | null;
  image_url: string | null;
  valuation?: {
    estimatedDollarValue?: number | null;
    tradeValueIndex?: number | null;
    breakdown?: {
      warUsed?: number | null;
      tpsModifier?: number | null;
    };
  };
  currentWar?: number | null;
  currentWarSeason?: number | null;
};

type MovementRow = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  image_url: string | null;
};

type SeriesSpotlightItem = {
  dateLabel: string;
  matchupLabel: string;
};

type ContextPanel = {
  series: SeriesSpotlightItem[];
  watch: Array<{
    id: number;
    name: string;
    team: string | null;
    position: string | null;
    image_url: string | null;
    tag: "Up" | "Down";
  }>;
};

type BrowseRow = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
  outlook: "Up" | "Steady" | "Down";
};

type PlannedFeature = {
  slug: string;
  title: string;
  description: string;
  votes: number;
  sort_order?: number;
  created_at?: string;
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function normalizeQuery(q: any) {
  return String(q ?? "").trim().slice(0, 60);
}

function outlookFromDelta(delta: number | null): "Up" | "Steady" | "Down" {
  if (delta == null || !Number.isFinite(delta)) return "Steady";
  if (delta >= 0.75) return "Up";
  if (delta <= -0.75) return "Down";
  return "Steady";
}

function outlookPillClass(outlook: "Up" | "Steady" | "Down") {
  if (outlook === "Up") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (outlook === "Down") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

/**
 * Planned Features (Voting)
 */
async function getPlannedFeatures(): Promise<PlannedFeature[]> {
  const { data, error } = await supabase
    .from("planned_features")
    .select("slug,title,description,votes,sort_order,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[HOME_PLANNED_FEATURES_ERROR]", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    slug: String(r.slug),
    title: String(r.title),
    description: String(r.description ?? ""),
    votes: Number(r.votes ?? 0),
    sort_order: r.sort_order != null ? Number(r.sort_order) : undefined,
    created_at: r.created_at ? String(r.created_at) : undefined,
  }));
}


/**
 * Top 10 Players Right Now:
 * - Determine one "current season" (max season where WAR exists)
 * - Rank by WAR within that season
 * - Then fetch player identity from players table
 */
async function getTop10BestRightNow(): Promise<PlayerRow[]> {
  const { data: seasonRows, error: sErr } = await supabase
    .from("player_seasons")
    .select("season")
    .not("war", "is", null)
    .order("season", { ascending: false })
    .limit(1);

  if (sErr) throw new Error(`top10 current season query failed: ${sErr.message}`);

  const currentSeason = seasonRows?.[0]?.season != null ? Number(seasonRows[0].season) : null;
  if (currentSeason == null) return [];

  const { data: topRows, error: tErr } = await supabase
    .from("player_seasons")
    .select("player_id,season,war")
    .eq("season", currentSeason)
    .not("war", "is", null)
    .order("war", { ascending: false })
    .limit(10);

  if (tErr) throw new Error(`top10 war query failed: ${tErr.message}`);

  const top = (topRows ?? []) as Array<{ player_id: number; season: number; war: number | null }>;
  if (top.length === 0) return [];

  const topIds = top.map((r) => Number(r.player_id)).filter((n) => Number.isFinite(n));
  const warById = new Map<number, number>();
  for (const r of top) {
    const pid = Number(r.player_id);
    const war = r.war == null ? null : Number(r.war);
    if (Number.isFinite(pid) && war != null && Number.isFinite(war)) {
      warById.set(pid, war);
    }
  }

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url")
    .in("id", topIds);

  if (pErr) throw new Error(`top10 players query failed: ${pErr.message}`);

  const byId = new Map<number, PlayerRow>();
  for (const p of players ?? []) {
    const id = Number((p as any).id);
    if (!Number.isFinite(id)) continue;
    byId.set(id, {
      id,
      name: String((p as any).name ?? "Unknown"),
      team: (p as any).team ?? null,
      position: (p as any).position ?? null,
      age: (p as any).age ?? null,
      tps: (p as any).tps ?? null,
      games_played: (p as any).games_played ?? null,
      image_url: (p as any).image_url ?? null,
      currentWar: warById.get(id) ?? null,
      currentWarSeason: currentSeason,
    });
  }

  return topIds.map((id) => byId.get(id)).filter(Boolean) as PlayerRow[];
}

/**
 * Movement Watch:
 * - Determine the 2 most recent distinct seasons with WAR (paged)
 * - Fetch WAR rows for each season with range pagination
 * - Compute deltas and return top 5 / bottom 5 player IDs
 */
async function getMovementWatch(): Promise<{
  seasonA: number | null;
  seasonB: number | null;
  risers: MovementRow[];
  fallers: MovementRow[];
}> {
  async function getTwoDistinctSeasonsWithWar(): Promise<[number | null, number | null]> {
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

      if (error) throw new Error(`movement seasons query failed: ${error.message}`);

      const rows = data ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        const s = r?.season != null ? Number(r.season) : NaN;
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

  const [seasonA, seasonB] = await getTwoDistinctSeasonsWithWar();

  if (seasonA == null || seasonB == null || seasonA === seasonB) {
    return { seasonA, seasonB, risers: [], fallers: [] };
  }

  type SeasonWarRow = { player_id: number; season: number; war: number };

  async function fetchSeasonWarAll(season: number): Promise<SeasonWarRow[]> {
    const pageSize = 1000;
    let from = 0;
    const out: SeasonWarRow[] = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("player_seasons")
        .select("player_id,season,war")
        .eq("season", season)
        .not("war", "is", null)
        .order("player_id", { ascending: true })
        .range(from, to);

      if (error) throw new Error(`movement season ${season} war query failed: ${error.message}`);

      const rows = (data ?? []) as any[];
      for (const r of rows) {
        const pid = Number(r.player_id);
        const s = Number(r.season);
        const war = Number(r.war);
        if (!Number.isFinite(pid) || !Number.isFinite(s) || !Number.isFinite(war)) continue;
        out.push({ player_id: pid, season: s, war });
      }

      if (rows.length < pageSize) break;
      from += pageSize;
      if (from > 20000) break;
    }

    return out;
  }

  const [aRows, bRows] = await Promise.all([fetchSeasonWarAll(seasonA), fetchSeasonWarAll(seasonB)]);
  if (aRows.length === 0 || bRows.length === 0) return { seasonA, seasonB, risers: [], fallers: [] };

  const aByPlayer = new Map<number, number>();
  for (const r of aRows) aByPlayer.set(r.player_id, r.war);

  const deltas: Array<{ player_id: number; delta: number }> = [];
  for (const r of bRows) {
    const aWar = aByPlayer.get(r.player_id);
    if (aWar == null) continue;
    const delta = aWar - r.war;
    if (!Number.isFinite(delta)) continue;
    deltas.push({ player_id: r.player_id, delta });
  }

  if (deltas.length === 0) return { seasonA, seasonB, risers: [], fallers: [] };

  const riserIds = [...deltas]
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 5)
    .map((d) => d.player_id);

  const fallerIds = [...deltas]
    .sort((x, y) => x.delta - y.delta)
    .slice(0, 5)
    .map((d) => d.player_id);

  const uniqueIds = Array.from(new Set([...riserIds, ...fallerIds]));
  const { data: players, error: plErr } = await supabase
    .from("players")
    .select("id,name,team,position,image_url")
    .in("id", uniqueIds);

  if (plErr) throw new Error(`movement players query failed: ${plErr.message}`);

  const byId = new Map<number, MovementRow>();
  for (const p of players ?? []) {
    const id = Number((p as any).id);
    if (!Number.isFinite(id)) continue;
    byId.set(id, {
      id,
      name: String((p as any).name ?? "Unknown"),
      team: (p as any).team ?? null,
      position: (p as any).position ?? null,
      image_url: (p as any).image_url ?? null,
    });
  }

  return {
    seasonA,
    seasonB,
    risers: riserIds.map((id) => byId.get(id)).filter(Boolean) as MovementRow[],
    fallers: fallerIds.map((id) => byId.get(id)).filter(Boolean) as MovementRow[],
  };
}

async function getTodaysContext(movement: { risers: MovementRow[]; fallers: MovementRow[] }): Promise<ContextPanel> {
  const now = new Date();
  const start = ymd(now);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 3);
  const end = ymd(endDate);

  let series: SeriesSpotlightItem[] = [];
  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=team`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json();
      const dates = Array.isArray(json?.dates) ? json.dates : [];

      const items: SeriesSpotlightItem[] = [];
      for (const d of dates) {
        const dateStr = String(d?.date ?? "");
        const dateObj = dateStr ? new Date(`${dateStr}T12:00:00`) : null;
        const label = dateObj ? dayLabel(dateObj) : dateStr || "Upcoming";

        const games = Array.isArray(d?.games) ? d.games : [];
        for (const g of games) {
          const away = g?.teams?.away?.team?.name;
          const home = g?.teams?.home?.team?.name;
          if (!away || !home) continue;
          items.push({ dateLabel: label, matchupLabel: `${away} @ ${home}` });
          if (items.length >= 6) break;
        }
        if (items.length >= 6) break;
      }

      const seen = new Set<string>();
      series = items
        .filter((it) => {
          const key = `${it.dateLabel}__${it.matchupLabel}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 3);
    }
  } catch {
    // degrade gracefully
  }

  const watch: ContextPanel["watch"] = [
    ...movement.risers.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
      image_url: p.image_url,
      tag: "Up" as const,
    })),
    ...movement.fallers.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
      image_url: p.image_url,
      tag: "Down" as const,
    })),
  ].slice(0, 6);

  return { series, watch };
}

async function getHomepageBrowsePlayers(opts: {
  q: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: BrowseRow[]; total: number }> {
  const { q, page, pageSize } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("players").select("id,name,team,position,age,image_url", { count: "exact" });
  if (q) query = query.ilike("name", `%${q}%`);

  const { data: players, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (error) throw new Error(`homepage browse players failed: ${error.message}`);

  const base = (players ?? []) as Array<{
    id: number;
    name: string;
    team: string | null;
    position: string | null;
    age: number | null;
    image_url: string | null;
  }>;

  if (base.length === 0) return { rows: [], total: count ?? 0 };

  const ids = base.map((p) => p.id);
  const { data: seasons, error: sErr } = await supabase
    .from("player_seasons")
    .select("player_id,season,war")
    .in("player_id", ids);

  if (sErr) throw new Error(`homepage seasons failed: ${sErr.message}`);

  const seasonsByPlayer = new Map<number, Array<{ season: number; war: number | null }>>();
  for (const r of seasons ?? []) {
    const pid = Number((r as any).player_id);
    const season = Number((r as any).season);
    const warRaw = (r as any).war;
    const war = warRaw == null ? null : Number(warRaw);
    if (!Number.isFinite(pid) || !Number.isFinite(season)) continue;
    if (!seasonsByPlayer.has(pid)) seasonsByPlayer.set(pid, []);
    seasonsByPlayer.get(pid)!.push({ season, war: Number.isFinite(war as any) ? war : null });
  }

  const rows: BrowseRow[] = base.map((p) => {
    const s = (seasonsByPlayer.get(p.id) ?? []).slice().sort((a, b) => a.season - b.season);
    const latest = s.at(-1) ?? null;
    const prior = s.length >= 2 ? s.at(-2)! : null;
    const delta = latest?.war != null && prior?.war != null ? latest.war - prior.war : null;
    return { ...p, outlook: outlookFromDelta(delta) };
  });

  return { rows, total: count ?? 0 };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; bp?: string; bps?: string };
}) {
  const q = normalizeQuery(searchParams.q);
  const page = clampInt(searchParams.bp, 1, 999, 1);
  const pageSize = 10;

  let browseRows: BrowseRow[] = [];
  let browseTotal = 0;
  let browseError: string | null = null;

  let top10: PlayerRow[] = [];
  let top10Error: string | null = null;

  let movement: { seasonA: number | null; seasonB: number | null; risers: MovementRow[]; fallers: MovementRow[] } = {
    seasonA: null,
    seasonB: null,
    risers: [],
    fallers: [],
  };
  let movementError: string | null = null;

  let context: ContextPanel = { series: [], watch: [] };

  let plannedFeatures: PlannedFeature[] = [];

  try {
    const out = await getHomepageBrowsePlayers({ q, page, pageSize });
    browseRows = out.rows;
    browseTotal = out.total;
  } catch (e: any) {
    browseError = e?.message ?? "Unknown error";
    console.error("[HOME_BROWSE_ERROR]", browseError);
  }

  try {
    top10 = await getTop10BestRightNow();
  } catch (e: any) {
    top10Error = e?.message ?? "Unknown error";
    console.error("[HOME_TOP10_ERROR]", top10Error);
  }

  try {
    movement = await getMovementWatch();
  } catch (e: any) {
    movementError = e?.message ?? "Unknown error";
    console.error("[HOME_MOVEMENT_ERROR]", movementError);
  }

  try {
    context = await getTodaysContext({ risers: movement.risers, fallers: movement.fallers });
  } catch (e: any) {
    console.error("[HOME_CONTEXT_ERROR]", e?.message ?? e);
  }

  plannedFeatures = await getPlannedFeatures();

  const totalPages = Math.max(1, Math.ceil((browseTotal || 0) / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const baseQS = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("bp", String(overrides.bp ?? page));
    sp.set("bps", String(pageSize));
    return `/?${sp.toString()}#browse`;
  };


function getPageItems(current: number, total: number) {
  const items: (number | "...")[] = [];
  if (total <= 12) {
    for (let i = 1; i <= total; i++) items.push(i);
    return items;
  }

  const c = Math.max(1, Math.min(total, current));

  const pushRange = (a: number, b: number) => {
    for (let i = a; i <= b; i++) items.push(i);
  };

  if (c <= 6) {
    pushRange(1, 10);
    items.push("...");
    items.push(total);
    return items;
  }

  if (c >= total - 5) {
    items.push(1);
    items.push("...");
    pushRange(total - 9, total);
    return items;
  }

  items.push(1);
  items.push("...");
  pushRange(c - 2, c + 2);
  items.push("...");
  items.push(total);
  return items;
}

function BrowsePager() {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const items = getPageItems(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={!hasPrev}
          href={baseQS({ bp: String(prevPage) })}
          className={[
            "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm",
            hasPrev
              ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              : "border-slate-200 bg-slate-50 text-slate-400 pointer-events-none",
          ].join(" ")}
        >
          Prev
        </Link>

        <Link
          aria-disabled={!hasNext}
          href={baseQS({ bp: String(nextPage) })}
          className={[
            "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm",
            hasNext
              ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              : "border-slate-200 bg-slate-50 text-slate-400 pointer-events-none",
          ].join(" ")}
        >
          Next
        </Link>
      </div>

      <div className="flex items-center gap-1">
        {items.map((it, i) => {
          if (it === "...") {
            return (
              <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">
                …
              </span>
            );
          }

          const isActive = it === page;
          return (
            <Link
              key={it}
              href={baseQS({ bp: it })}
              className={[
                "min-w-8 rounded-lg border px-2 py-2 text-center text-xs font-semibold shadow-sm",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
              ].join(" ")}
            >
              {it}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

  return (
    <div className="text-base">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {/* HERO */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-8 sm:p-10">
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900">
                See who&apos;s actually driving wins
              </h1>

              <p className="mt-5 max-w-3xl text-lg sm:text-xl leading-relaxed text-slate-600">
                MLB Valuations highlights explainable performance signals — built for fans, fantasy players,
                and decision support (not picks).
              </p>

              <ul className="mt-6 space-y-2 text-base sm:text-lg text-slate-700 list-disc pl-6">
                <li>Search any name to pull up a profile instantly</li>
                <li>Use movement signals to spot change early</li>
                <li>Open a player for full context (metrics live on profiles)</li>
              </ul>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/methodology"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm"
                >
                  How It Works
                </Link>
              </div>
            </div>
          </div>

          {/* BROWSE PLAYERS */}
<div id="browse" className="rounded-2xl border border-slate-200 bg-white shadow-sm scroll-mt-24">
  <BrowsePlayersPanel
    initialQ={q}
    initialPage={page}
    pageSize={pageSize}
    initialRows={browseRows}
    initialTotal={browseTotal}
  />
</div>

{/* PLANNED FEATURES (moved under Browse Players, left column) */}
          <PlannedFeaturesPanel initialRows={plannedFeatures} />
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-4 space-y-6">
          {/* MOVEMENT WATCH */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Movement Watch</div>
                <div className="mt-1 text-xs text-slate-500">
                  {movement.seasonA && movement.seasonB
                    ? `WAR change: ${movement.seasonB} → ${movement.seasonA}`
                    : "WAR change: latest seasons"}
                </div>
              </div>
            </div>

            {movementError ? (
              <div className="px-6 py-6 text-sm text-slate-600">
                Couldn’t load movement watch. Try refreshing.
                <div className="mt-2 text-xs text-slate-400">(Server log: HOME_MOVEMENT_ERROR)</div>
              </div>
            ) : movement.risers.length === 0 && movement.fallers.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-600">Not enough season data yet.</div>
            ) : (
              <div className="p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">Biggest Risers</div>
                      <Link href="/players/risers" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                        View all →
                      </Link>
                    </div>

                    <ul className="mt-4 space-y-3">
                      {movement.risers.map((p) => (
                        <li key={`r-${p.id}`} className="flex items-center justify-between gap-3">
                          <Link href={`/players/${p.id}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
                            <div className="w-4 text-xs font-semibold text-emerald-700 tabular-nums">▲</div>
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image_url ?? "/placeholder.png"}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                              <div className="truncate text-xs text-slate-500">
                                {(p.position ?? "—")} · {(p.team ?? "Unknown")}
                              </div>
                            </div>
                          </Link>

                          <div className="flex items-center gap-3">
                            <Link
                              href={`/compare?add=${p.id}`}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                              title="Add to Compare"
                            >
                              Compare +
                            </Link>
                            
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-slate-200" />

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">Biggest Fallers</div>
                      <Link href="/players/fallers" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
                        View all →
                      </Link>
                    </div>

                    <ul className="mt-4 space-y-3">
                      {movement.fallers.map((p) => (
                        <li key={`f-${p.id}`} className="flex items-center justify-between gap-3">
                          <Link href={`/players/${p.id}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
                            <div className="w-4 text-xs font-semibold text-amber-700 tabular-nums">▼</div>
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image_url ?? "/placeholder.png"}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                              <div className="truncate text-xs text-slate-500">
                                {(p.position ?? "—")} · {(p.team ?? "Unknown")}
                              </div>
                            </div>
                          </Link>

                          <div className="flex items-center gap-3">
                            <Link
                              href={`/compare?add=${p.id}`}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                              title="Add to Compare"
                            >
                              Compare +
                            </Link>
                            
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TOP 10 */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="text-sm font-semibold text-slate-900">Top 10 Players Right Now</div>
              <div className="mt-1 text-xs text-slate-500">Ranked by current-season WAR (details on profiles).</div>
            </div>

            {top10Error ? (
              <div className="px-6 py-6 text-sm text-slate-600">
                Couldn’t load top players. Try refreshing.
                <div className="mt-2 text-xs text-slate-400">(Server log: HOME_TOP10_ERROR)</div>
              </div>
            ) : top10.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-600">No players found.</div>
            ) : (
              <div className="p-6">
                <ul className="space-y-3">
                  {top10.map((p, idx) => (
                    <li key={`t10-${p.id}`} className="flex items-center justify-between gap-3">
                      <Link href={`/players/${p.id}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
                        <div className="w-6 text-xs font-semibold text-slate-500 tabular-nums">{idx + 1}</div>
                        <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image_url ?? "/placeholder.png"}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {(p.position ?? "—")} · {(p.team ?? "Unknown")}
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-3 shrink-0">
                        <Link
                          href={`/compare?add=${p.id}`}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-800 whitespace-nowrap"
                          title="Add to Compare"
                        >
                          Compare +
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* TODAY’S CONTEXT */}
          {false && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Today’s Context</div>
                <div className="mt-1 text-xs text-slate-500">No picks — just what’s moving and what’s on the calendar.</div>
              </div>
              <Link href="/watchlist" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                See watchlist →
              </Link>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Series spotlight</div>
                {context.series.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">Schedule items will appear here.</div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {context.series.map((it, idx) => (
                      <li key={`${it.dateLabel}-${it.matchupLabel}-${idx}`} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 truncate">{it.matchupLabel}</span>
                        <span className="ml-3 text-xs text-slate-500 whitespace-nowrap">{it.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Player watch</div>

                {context.watch.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">Watch candidates will appear here.</div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {context.watch.map((p) => (
                      <li key={`w-${p.id}-${p.tag}`} className="flex items-center justify-between gap-3">
                        <Link href={`/players/${p.id}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
                          <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.image_url ?? "/placeholder.png"}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {(p.position ?? "—")} · {(p.team ?? "Unknown")}
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-3">
                          <Link
                            href={`/compare?add=${p.id}`}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                            title="Add to Compare"
                          >
                            Compare +
                          </Link>
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border",
                              p.tag === "Up"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-amber-200 bg-amber-50 text-amber-800",
                            ].join(" ")}
                          >
                            {p.tag}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Movement labels are derived from year-over-year WAR change (most recent completed seasons).
              </div>
            </div>
          </div>
          )}

          {/* HOW THIS WORKS */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="text-sm font-semibold text-slate-900">How this works</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Signals are built around on-field impact first. Movement uses year-over-year WAR deltas —
                simple, explainable, and hard to game.
              </p>
              <div className="mt-4">
                <Link href="/methodology" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                  Read the methodology →
                </Link>
              </div>
            </div>
          </div>

          {/* TEAMS */}
          {false && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Teams</div>
                <Link href="/teams" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                  Browse Teams →
                </Link>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Team pages are coming soon — built to answer the same question: what&apos;s changing, and what
                that implies next.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex h-2 w-2 rounded-full bg-slate-300" />
                <span>In progress</span>
              </div>
            </div>
          </div>
          )}

        </div>
      </div>
    </div>
  );
}
