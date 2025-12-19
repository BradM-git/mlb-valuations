// app/players/[id]/page.tsx
import { notFound } from "next/navigation";
import PlayerChartClient from "./PlayerChartClient";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPlayerValuation } from "@/lib/valuation";
import { ArrowUpRight, ArrowRight, ArrowDownRight } from "lucide-react";

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

type Outlook = {
  label: "Up" | "Steady" | "Down";
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
};

function computeOutlook(seasonsDesc: SeasonRow[]): Outlook {
  const last3 = seasonsDesc
    .filter((s) => Number.isFinite(s.season))
    .slice(0, 3);

  const s0 = last3[0]; // most recent
  const s1 = last3[1]; // prior
  const s2 = last3[2]; // two years ago (optional)

  const war0 = s0?.war ?? null;
  const war1 = s1?.war ?? null;

  const gp0 = s0?.games_played ?? null;
  const gp1 = s1?.games_played ?? null;

  if (war0 == null || war1 == null) {
    return {
      label: "Steady",
      confidence: "Low",
      reasons: ["Limited recent season data available."],
    };
  }

  const delta = war0 - war1;

  const upThresh = 0.75;
  const downThresh = -0.75;

  let label: Outlook["label"] = "Steady";
  if (delta >= upThresh) label = "Up";
  else if (delta <= downThresh) label = "Down";

  const gpMinHigh = 120;
  const gpMinMed = 70;

  let confidence: Outlook["confidence"] = "Medium";
  if ((gp0 != null && gp0 < gpMinMed) || (gp1 != null && gp1 < gpMinMed)) confidence = "Low";
  else if ((gp0 != null && gp0 >= gpMinHigh) && (gp1 != null && gp1 >= gpMinHigh)) confidence = "High";

  const reasons: string[] = [];

  if (war0 >= 6) reasons.push("Elite recent impact.");
  else if (war0 >= 4) reasons.push("All-Star level recent impact.");
  else if (war0 >= 2) reasons.push("Above-average recent impact.");
  else if (war0 >= 0) reasons.push("Around league-average recent impact.");
  else reasons.push("Recent impact has been below average.");

  if (label === "Up") reasons.push("Improving year over year.");
  if (label === "Down") reasons.push("Declined year over year.");
  if (label === "Steady") reasons.push("Similar level year over year.");

  if (confidence === "Low") reasons.push("Lower playing time makes signal less stable.");
  if (confidence === "High") reasons.push("Stable playing time supports signal.");

  if (s2?.war != null && Number.isFinite(s2.war)) {
    const war2 = s2.war as number;
    const avg3 = (war0 + war1 + war2) / 3;
    if (avg3 >= 4 && label !== "Down") reasons.push("Sustained high-level performance over multiple seasons.");
    if (avg3 < 2 && label === "Up") reasons.push("Recent improvement stands out vs. prior baseline.");
  }

  return {
    label,
    confidence,
    reasons: reasons.slice(0, 3),
  };
}

function outlookBadge(label: Outlook["label"]) {
  switch (label) {
    case "Up":
      return {
        icon: <ArrowUpRight className="h-5 w-5" />,
        textClass: "text-emerald-700",
        bgClass: "bg-emerald-50",
        borderClass: "border-emerald-200",
      };
    case "Down":
      return {
        icon: <ArrowDownRight className="h-5 w-5" />,
        textClass: "text-amber-800",
        bgClass: "bg-amber-50",
        borderClass: "border-amber-200",
      };
    default:
      return {
        icon: <ArrowRight className="h-5 w-5" />,
        textClass: "text-slate-700",
        bgClass: "bg-slate-50",
        borderClass: "border-slate-200",
      };
  }
}

function confidencePill(conf: Outlook["confidence"]) {
  // Subtle cue: higher confidence slightly stronger text color
  if (conf === "High") return "text-slate-900 bg-slate-100 border-slate-200";
  if (conf === "Low") return "text-slate-700 bg-white border-slate-200";
  return "text-slate-800 bg-slate-50 border-slate-200";
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId) || playerId <= 0) notFound();

  const { data: player, error: pErr } = await supabaseServer
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url")
    .eq("id", playerId)
    .maybeSingle();

  if (pErr) throw new Error(`Failed to load player ${playerId}: ${pErr.message}`);
  if (!player) notFound();

  const { data: seasons, error: sErr } = await supabaseServer
    .from("player_seasons")
    .select("season,tps,games_played,war,team")
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  if (sErr) throw new Error(`Failed to load seasons for player ${playerId}: ${sErr.message}`);

  const safeSeasons: SeasonRow[] = (seasons ?? []) as any;

  const { valuation } = getPlayerValuation(player as any, safeSeasons as any);

  const recentImpactValue = valuation?.breakdown?.warUsed ?? null;
  const stabilityValue = valuation?.breakdown?.tpsModifier ?? null;
  const longTermContextValue = valuation?.estimatedDollarValue ?? null;

  const seasonsDesc = safeSeasons
    .slice()
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));

  const chartSeasons = safeSeasons
    .slice()
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0))
    .map((s) => ({
      season: s.season,
      war: s.war ?? null,
      games: s.games_played ?? null,
      team: s.team ?? player.team ?? null,
    }));

  const outlook = computeOutlook(seasonsDesc);
  const badge = outlookBadge(outlook.label);

  return (
    <div className="text-base">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
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

                <p className="mt-2 text-sm text-slate-600">
                  Snapshot of recent performance and role stability. Not a projection or betting advice.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">Recent Impact</div>
                <div className="text-lg font-bold text-slate-900">{recentImpactValue ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">Stability</div>
                <div className="text-lg font-bold text-slate-900">{stabilityValue ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">Long-Term Context</div>
                <div className="text-lg font-bold text-slate-900">{formatMoney(longTermContextValue)}</div>
              </div>
            </div>
          </div>

          {/* ✅ Player Outlook v1 w/ subtle color + arrow icons */}
          <div className={`mt-6 rounded-xl border ${badge.borderClass} ${badge.bgClass} shadow-sm`}>
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`${badge.textClass} mt-0.5`}>{badge.icon}</div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Player Outlook
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className={`text-xl font-bold ${badge.textClass}`}>
                        {outlook.label}
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${confidencePill(
                          outlook.confidence
                        )}`}
                      >
                        Confidence: {outlook.confidence}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  Based on recent season impact and playing-time stability.
                </div>
              </div>

              <ul className="mt-4 list-disc pl-5 text-sm text-slate-800 space-y-1">
                {outlook.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <PlayerChartClient playerName={player.name} seasons={chartSeasons} />
          </div>

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
