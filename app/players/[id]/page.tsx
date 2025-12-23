// app/players/[id]/page.tsx
import Link from "next/link";
import PlayerChartClient from "./PlayerChartClient";
import MarketValueChartClient from "./MarketValueChartClient";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";
import type { MarketValuePoint } from "@/app/components/MarketValueChart";

export const dynamic = "force-dynamic";

type SeasonRow = {
  season: number;
  games_played?: number | null;
  war?: number | null;
  tps?: number | null;
  team?: string | null;
};

function parsePlayerId(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/^\s*(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function moneyOrNull(v: any): number | null {
  const n = toNum(v);
  if (n == null) return null;
  if (n === 0) return null;
  return n;
}

function pickFirst(...vals: any[]) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMoneyShort(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmt2(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function fmtPct(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function titleizeKey(k: string) {
  const spaced = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return spaced
    .split(/\s+/)
    .map((w) => {
      const upper = w.toUpperCase();
      if (upper === "WAR" || upper === "TPS" || upper === "MLB" || upper === "ID" || upper === "TVI")
        return upper;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function deriveMarketValuePoints(rows: any[]): MarketValuePoint[] {
  const points: MarketValuePoint[] = [];

  for (const r of rows ?? []) {
    const rawLabel = pickFirst(r.season, r.year, r.as_of, r.date, r.month, r.period, r.created_at);
    let label = "—";
    if (typeof rawLabel === "number" && Number.isFinite(rawLabel)) label = String(rawLabel);
    else if (typeof rawLabel === "string" && rawLabel.trim()) {
      const s = rawLabel.trim();
      label = s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 7) : s;
    }

    const rawValue = pickFirst(
      r.market_value,
      r.marketValue,
      r.value,
      r.usd_value,
      r.usdValue,
      r.value_usd,
      r.amount,
      r.amount_usd
    );

    points.push({ label, value: moneyOrNull(rawValue) });
  }

  const looksYearish = points.length > 1 && points.every((p) => /^\d{4}$/.test(p.label));
  if (looksYearish) return points.slice().sort((a, b) => Number(a.label) - Number(b.label));
  return points;
}

function normalizeContractRow(r: any) {
  const team = pickFirst(r.team, r.club, r.team_name, r.current_team, r.team_abbr, r.team_full_name);

  const startYear = pickFirst(r.start_year, r.startYear, r.year_start, r.from_year, r.begin_year);
  const endYear = pickFirst(r.end_year, r.endYear, r.year_end, r.to_year, r.finish_year);
  const years = pickFirst(r.years, r.length_years, r.term_years, r.term);

  const total = moneyOrNull(
    pickFirst(r.total_value, r.totalValue, r.value_total, r.contract_total, r.guaranteed, r.total)
  );
  const aav = moneyOrNull(pickFirst(r.avg_annual_value, r.aav, r.avgAnnualValue, r.annual_value, r.avg));

  return {
    team: team ?? null,
    startYear: toNum(startYear),
    endYear: toNum(endYear),
    years: toNum(years),
    total,
    aav,
  };
}

function PlayerMissingPanel({
  debug,
}: {
  debug: { paramsValue: any; rawId: string; parsedId: number | null };
}) {
  return (
    <div className="mv-panel shadow-sm p-8">
      <div className="text-2xl font-bold text-slate-900">Player not found</div>
      <div className="mt-2 text-sm text-slate-600">We couldn’t load this player from the database.</div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
        <div>
          <span className="font-semibold">params (resolved):</span>{" "}
          <span className="font-mono">{JSON.stringify(debug.paramsValue)}</span>
        </div>
        <div>
          <span className="font-semibold">params.id:</span>{" "}
          <span className="font-mono">{JSON.stringify(debug.rawId)}</span>
        </div>
        <div>
          <span className="font-semibold">parsed id:</span>{" "}
          <span className="font-mono">{debug.parsedId === null ? "null" : String(debug.parsedId)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/#browse"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to Browse →
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  // params may be a Promise in newer Next.js versions
  params: any;
  searchParams?: { vd?: string };
}) {
  const resolvedParams = await Promise.resolve(params as any);
  const rawId = resolvedParams?.id ?? "";
  const playerId = parsePlayerId(rawId);
  const showValuationDetails = searchParams?.vd === "1";

  if (!playerId) {
    return <PlayerMissingPanel debug={{ paramsValue: resolvedParams ?? null, rawId, parsedId: playerId }} />;
  }

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url,mlb_id")
    .eq("id", playerId)
    .maybeSingle();

  if (pErr || !player) {
    return <PlayerMissingPanel debug={{ paramsValue: resolvedParams ?? null, rawId, parsedId: playerId }} />;
  }

  const p = player; // TS: player is non-null from here down

  const mlbId = player.mlb_id ?? null;

  const { data: seasons } = await supabase
    .from("player_seasons")
    .select("season,tps,games_played,war,team")
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  const safeSeasons: SeasonRow[] = (seasons ?? []) as any;

  const [vCurByPid, vCurByMlb, curTblByPid, curTblByMlb, histByPid, histByMlb] = await Promise.all([
    supabase.from("v_player_contract_current").select("*").eq("player_id", playerId).maybeSingle(),
    mlbId
      ? supabase.from("v_player_contract_current").select("*").eq("mlb_id", mlbId).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("player_contracts_current").select("*").eq("player_id", playerId).maybeSingle(),
    mlbId
      ? supabase.from("player_contracts_current").select("*").eq("mlb_id", mlbId).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("player_contracts").select("*").eq("player_id", playerId),
    mlbId ? supabase.from("player_contracts").select("*").eq("mlb_id", mlbId) : Promise.resolve({ data: [] } as any),
  ]);

  const currentContractRaw = vCurByPid.data ?? vCurByMlb.data ?? curTblByPid.data ?? curTblByMlb.data ?? null;

  const historyRowsRaw: any[] = [
    ...(((histByPid as any).data ?? []) as any[]),
    ...(((histByMlb as any).data ?? []) as any[]),
  ];

  const seen = new Set<string>();
  const historyRowsDedup = historyRowsRaw.filter((r) => {
    const key = String(
      pickFirst(r.id, `${r.player_id ?? ""}-${r.mlb_id ?? ""}-${r.start_year ?? ""}-${r.end_year ?? ""}-${r.team ?? ""}`)
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const currentContract = currentContractRaw ? normalizeContractRow(currentContractRaw) : null;
  const historyContracts = historyRowsDedup.map(normalizeContractRow);
  const totalCareerContractValue = historyContracts.reduce((sum, r) => sum + (r.total ?? 0), 0) || null;

  const mvByPid = await supabase.from("market_values").select("*").eq("player_id", playerId);
  const mvByMlb = mlbId ? await supabase.from("market_values").select("*").eq("mlb_id", mlbId) : ({ data: [] } as any);

  const mvRows = [...(((mvByPid as any).data ?? []) as any[]), ...(((mvByMlb as any).data ?? []) as any[])];

  const marketPoints: MarketValuePoint[] = deriveMarketValuePoints(mvRows);
  const latestMarketValue =
    marketPoints
      .slice()
      .reverse()
      .find((p) => typeof p.value === "number" && Number.isFinite(p.value))?.value ?? null;

  const { valuation } = getPlayerValuation(player as any, safeSeasons as any);
  const est = valuation?.estimatedDollarValue ?? null;
  const tvi = valuation?.tradeValueIndex ?? null;
  const warUsed = valuation?.breakdown?.warUsed ?? null;
  const tpsMod = valuation?.breakdown?.tpsModifier ?? null;

  const seasonsAsc = safeSeasons.slice().sort((a, b) => a.season - b.season);
  const seasonsDesc = safeSeasons.slice().sort((a, b) => b.season - a.season);
  const seasonsWithWarAsc = seasonsAsc.filter((s) => isFiniteNumber(s.war));
  const careerWar = seasonsWithWarAsc.length ? seasonsWithWarAsc.reduce((sum, s) => sum + (s.war ?? 0), 0) : null;

  const hasAnyGames = safeSeasons.some((s) => isFiniteNumber(s.games_played));
  const careerGames = hasAnyGames ? safeSeasons.reduce((sum, s) => sum + (s.games_played ?? 0), 0) : null;

  const peakSeason =
    seasonsWithWarAsc.length > 0
      ? seasonsWithWarAsc.reduce((best, s) => ((s.war ?? -Infinity) > (best?.war ?? -Infinity) ? s : best), null as any)
      : null;

  let bestPrime: { start: number; end: number; totalWar: number } | null = null;
  if (seasonsWithWarAsc.length >= 3) {
    for (let i = 0; i <= seasonsWithWarAsc.length - 3; i++) {
      const a = seasonsWithWarAsc[i];
      const b = seasonsWithWarAsc[i + 1];
      const c = seasonsWithWarAsc[i + 2];
      const total = (a.war ?? 0) + (b.war ?? 0) + (c.war ?? 0);
      const win = { start: a.season, end: c.season, totalWar: total };
      if (!bestPrime || win.totalWar > bestPrime.totalWar) bestPrime = win;
    }
  }

  const primeLabel = bestPrime ? `${bestPrime.start}–${bestPrime.end}` : "—";

  const rolling3BySeasonYear = new Map<number, number>();
  if (seasonsWithWarAsc.length >= 3) {
    for (let i = 0; i <= seasonsWithWarAsc.length - 3; i++) {
      const a = seasonsWithWarAsc[i];
      const b = seasonsWithWarAsc[i + 1];
      const c = seasonsWithWarAsc[i + 2];
      rolling3BySeasonYear.set(c.season, (a.war ?? 0) + (b.war ?? 0) + (c.war ?? 0));
    }
  }

  function warSharePct(w?: number | null) {
    if (!isFiniteNumber(w) || !isFiniteNumber(careerWar) || careerWar <= 0) return null;
    return (w / careerWar) * 100;
  }

  const breakdownObj = (valuation?.breakdown ?? {}) as Record<string, any>;
  const modelDetails = Object.entries(breakdownObj)
    .filter(([k, v]) => v != null && v !== "")
    .filter(([k]) => {
      const kk = k.toLowerCase();
      if (kk === "warused" || kk === "tpsmodifier") return false;
      if (kk === "pv" || kk.includes("presentvalue")) return false;
      return true;
    })
    .slice(0, 8);

  const chartSeasons = seasonsAsc.map((s) => ({
    season: s.season,
    war: s.war ?? null,
    games: s.games_played ?? null,
    team: s.team ?? player.team ?? null,
  }));

  const currentTeam = currentContract?.team ?? player.team ?? "—";
  const currentTotal = currentContract?.total ?? null;
  const currentAAV = currentContract?.aav ?? null;
  const currentYears = currentContract?.years ?? null;
  const currentTerm =
    currentContract?.startYear && currentContract?.endYear ? `${currentContract.startYear}–${currentContract.endYear}` : "—";

  return (
    <div className="text-base">
      <div className="mv-panel shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={player.image_url ?? "/placeholder.png"} alt={player.name} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight truncate">{player.name}</h1>
                <div className="mt-1 text-sm text-slate-600">
                  {player.team ?? "—"} · {player.position ?? "—"} · Age {player.age ?? "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/compare?ids=${player.id}`}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Add to Compare →
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="mv-panel overflow-hidden">
                <div className="mv-panel-header">
                  <div className="text-sm font-semibold text-slate-900">Key Numbers</div>
                  <div className="mt-1 text-xs text-slate-500">Compact summary. The chart + tables below provide full context.</div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-500">Career WAR</div>
                    <div className="tabular-nums text-lg font-bold text-slate-900">{fmt2(careerWar)}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-500">Peak Season</div>
                    <div className="tabular-nums text-lg font-bold text-slate-900">{peakSeason ? peakSeason.season : "—"}</div>
                    <div className="mt-1 text-xs text-slate-500">{peakSeason ? `WAR: ${fmt2(peakSeason.war ?? null)}` : ""}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-500">Prime Window</div>
                    <div className="tabular-nums text-lg font-bold text-slate-900">{primeLabel}</div>
                    <div className="mt-1 text-xs text-slate-500">{bestPrime ? `WAR: ${fmt2(bestPrime.totalWar)}` : ""}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-500">Games</div>
                    <div className="tabular-nums text-lg font-bold text-slate-900">
                      {careerGames == null ? "—" : careerGames.toLocaleString("en-US")}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="text-sm text-slate-700">Latest Market Value</div>
                      <div className="text-sm font-semibold tabular-nums text-slate-900">{formatMoneyShort(latestMarketValue)}</div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="text-sm text-slate-700">Career Contract Value</div>
                      <div className="text-sm font-semibold tabular-nums text-slate-900">
                        {totalCareerContractValue ? formatMoneyShort(totalCareerContractValue) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="mv-panel overflow-hidden">
                <div className="mv-panel-header">
                  <div className="text-sm font-semibold text-slate-900">Valuation</div>
                  <div className="mt-1 text-xs text-slate-500">Explainable output from WAR + modifiers.</div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">Estimated Value</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(est)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      TVI: <span className="font-semibold text-slate-700 tabular-nums">{fmt2(tvi)}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">Inputs Used</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-700">WAR used</span>
                      <span className="font-semibold tabular-nums text-slate-900">{warUsed ?? "—"}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700">TPS modifier</span>
                      <span className="font-semibold tabular-nums text-slate-900">{tpsMod ?? "—"}</span>
                    </div>
                  </div>

                  {showValuationDetails && modelDetails.length ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <div className="text-xs font-semibold text-slate-500">Model Details</div>
                      <div className="mt-2 space-y-2">
                        {modelDetails.map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-3">
                            <div className="text-sm text-slate-700">{titleizeKey(k)}</div>
                            <div className="text-sm font-semibold tabular-nums text-slate-900 text-right">
                              {isFiniteNumber(v) ? fmt2(v) : String(v)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Hidden for now: Contracts + Market Value history panel (as requested) */}
          {false && (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">Contracts</div>
                    <div className="mt-1 text-xs text-slate-500">Current deal + history (from your DB).</div>
                  </div>

                  <div className="p-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold text-slate-500">Current contract</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-700">Team</div>
                        <div className="text-right font-semibold text-slate-900">{currentTeam}</div>

                        <div className="text-slate-700">Total</div>
                        <div className="text-right font-semibold tabular-nums text-slate-900">
                          {formatMoneyShort(currentTotal)}
                        </div>

                        <div className="text-slate-700">AAV</div>
                        <div className="text-right font-semibold tabular-nums text-slate-900">
                          {formatMoneyShort(currentAAV)}
                        </div>

                        <div className="text-slate-700">Years</div>
                        <div className="text-right font-semibold tabular-nums text-slate-900">{currentYears ?? "—"}</div>

                        <div className="text-slate-700">Term</div>
                        <div className="text-right font-semibold tabular-nums text-slate-900">{currentTerm}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-white">
                    {historyContracts.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">No contract rows found.</div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 border-b border-slate-200">
                          <div className="col-span-3">Years</div>
                          <div className="col-span-3">Team</div>
                          <div className="col-span-3 text-right">Total</div>
                          <div className="col-span-3 text-right">AAV</div>
                        </div>

                        {historyContracts.slice(0, 8).map((r, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm">
                            <div className="col-span-3 font-semibold tabular-nums">
                              {r.startYear && r.endYear ? `${r.startYear}–${r.endYear}` : "—"}
                            </div>
                            <div className="col-span-3 truncate">{r.team ?? "—"}</div>
                            <div className="col-span-3 text-right tabular-nums font-semibold">{formatMoneyShort(r.total)}</div>
                            <div className="col-span-3 text-right tabular-nums">{formatMoneyShort(r.aav)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <MarketValueChartClient playerName={p.name} points={marketPoints} />
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="mv-panel overflow-hidden">
              <div className="mv-panel-header">
                <div className="text-sm font-semibold text-slate-900">Career Arc</div>
                <div className="mt-1 text-xs text-slate-500">WAR by season (from your DB).</div>
              </div>
              <div className="p-4">
                <PlayerChartClient playerName={player.name} seasons={chartSeasons} />
              </div>
            </div>
          </div>

          <div className="mt-6 mv-panel overflow-hidden">
            <div className="mv-panel-header">
              <div className="text-sm font-semibold text-slate-900">Season History</div>
              <div className="mt-1 text-xs text-slate-500">
                Team uses season rows when present; otherwise falls back to player team.
              </div>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {seasonsDesc.map((s, idx) => {
                const share = warSharePct(s.war ?? null);
                const roll3 = s.season != null ? rolling3BySeasonYear.get(s.season) ?? null : null;

                return (
                  <div key={`${s.season}-${idx}`} className="grid grid-cols-16 gap-3 px-4 py-3 text-sm">
                    <div className="col-span-2 font-semibold">{s.season}</div>
                    <div className="col-span-4 truncate">{s.team ?? player.team ?? "—"}</div>
                    <div className="col-span-2 text-right tabular-nums">{fmt2(s.war ?? null)}</div>
                    <div className="col-span-2 text-right tabular-nums">{fmtPct(share)}</div>
                    <div className="col-span-2 text-right tabular-nums">{fmt2(roll3)}</div>
                    <div className="col-span-2 text-right tabular-nums">{s.games_played == null ? "—" : s.games_played}</div>
                    <div className="col-span-2 text-right tabular-nums">{s.tps == null ? "—" : fmt2(s.tps)}</div>
                  </div>
                );
              })}

              {seasonsDesc.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-500">No seasons found for this player.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
