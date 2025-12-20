// app/players/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerChartClient from "./PlayerChartClient";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";

export const dynamic = "force-dynamic";

type SeasonRow = {
  season: number;
  games_played?: number | null;
  war?: number | null;
  tps?: number | null;
  team?: string | null;
};

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmt2(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId) || playerId <= 0) notFound();

  // ✅ Query Supabase directly (no SSR fetch to /api)
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url")
    .eq("id", playerId)
    .maybeSingle();

  if (pErr) throw new Error(`Failed to load player ${playerId}: ${pErr.message}`);
  if (!player) notFound();

  const { data: seasons, error: sErr } = await supabase
    .from("player_seasons")
    .select("season,tps,games_played,war,team")
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  if (sErr) throw new Error(`Failed to load seasons for player ${playerId}: ${sErr.message}`);

  const safeSeasons: SeasonRow[] = (seasons ?? []) as any;

  const { valuation } = getPlayerValuation(player as any, safeSeasons as any);

  const warUsed = valuation?.breakdown?.warUsed ?? null;
  const tpsMod = valuation?.breakdown?.tpsModifier ?? null;
  const est = valuation?.estimatedDollarValue ?? null;

  const seasonsDesc = safeSeasons
    .slice()
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));

  // Chart data expects ascending years
  const chartSeasons = safeSeasons
    .slice()
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0))
    .map((s) => ({
      season: s.season,
      war: s.war ?? null,
      games: s.games_played ?? null,
      team: s.team ?? player.team ?? null, // fallback if season team missing
    }));

  return (
    <div className="text-base">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={player.image_url ?? "/placeholder.png"}
                  alt={player.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">{player.name}</h1>
                <div className="mt-1 text-sm text-slate-600">
                  {player.team ?? "—"} · {player.position ?? "—"} · Age {player.age ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">WAR Used</div>
                <div className="text-lg font-bold text-slate-900">{warUsed ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">TPS Modifier</div>
                <div className="text-lg font-bold text-slate-900">{tpsMod ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">Est. Value</div>
                <div className="text-lg font-bold text-slate-900">{formatMoney(est)}</div>
              </div>

              <Link
                href={`/compare?ids=${player.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm sm:col-span-3"
              >
                Add to Compare →
              </Link>
            </div>
          </div>

          {/* ✅ Client-rendered chart */}
          <div className="mt-6">
            <PlayerChartClient playerName={player.name} seasons={chartSeasons} />
          </div>

          {/* Table */}
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <div className="col-span-2">Season</div>
              <div className="col-span-4">Team</div>
              <div className="col-span-2 text-right">WAR</div>
              <div className="col-span-2 text-right">Games</div>
              <div className="col-span-2 text-right">TPS</div>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {seasonsDesc.map((s, idx) => (
                <div key={`${s.season}-${idx}`} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm">
                  <div className="col-span-2 font-semibold">{s.season}</div>
                  <div className="col-span-4 truncate">{s.team ?? player.team ?? "—"}</div>
                  <div className="col-span-2 text-right tabular-nums">{fmt2(s.war ?? null)}</div>
                  <div className="col-span-2 text-right tabular-nums">{s.games_played ?? "—"}</div>
                  <div className="col-span-2 text-right tabular-nums">
                    {s.tps == null ? "—" : fmt2(s.tps)}
                  </div>
                </div>
              ))}

              {seasonsDesc.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  No seasons found for this player.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
