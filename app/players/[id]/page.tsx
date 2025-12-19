// app/players/[id]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PlayerChartClient from "./PlayerChartClient";

type SeasonRow = {
  season: number;
  games_played?: number | null;
  war?: number | null;
  tps?: number | null;
  team?: string | null; // now provided by API
};

type ApiResponse = {
  player: {
    id: number;
    name: string;
    team: string | null;
    position: string | null;
    age: number | null;
    tps?: number | null;
    games_played?: number | null;
    image_url: string | null;
  };
  seasons: SeasonRow[];
  valuation?: {
    estimatedDollarValue?: number | null;
    breakdown?: {
      warUsed?: number | null;
      tpsModifier?: number | null;
    };
  };
};

async function getBaseUrl() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (siteUrl) return siteUrl;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

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

  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/players/${playerId}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok)
    throw new Error(
      `Failed to load player ${playerId}: ${res.status} ${res.statusText}`
    );

  const data = (await res.json()) as ApiResponse;
  if (!data?.player) notFound();

  const p = data.player;

  const seasonsDesc = (data.seasons ?? [])
    .slice()
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));

  const warUsed = data.valuation?.breakdown?.warUsed ?? null;
  const tpsMod = data.valuation?.breakdown?.tpsModifier ?? null;
  const est = data.valuation?.estimatedDollarValue ?? null;

  // Chart data expects ascending years
  const chartSeasons = (data.seasons ?? [])
    .slice()
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0))
    .map((s) => ({
      season: s.season,
      war: s.war ?? null,
      games: s.games_played ?? null,
      team: (s as any).team ?? p.team ?? null, // still safe fallback
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
                  src={p.image_url ?? "/placeholder.png"}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
                <div className="mt-1 text-sm text-slate-600">
                  {p.team ?? "—"} · {p.position ?? "—"} · Age {p.age ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">
                  WAR Used
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {warUsed ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">
                  TPS Modifier
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {tpsMod ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">
                  Est. Value
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {formatMoney(est)}
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Client-rendered chart (after page load) */}
          <div className="mt-6">
            <PlayerChartClient playerName={p.name} seasons={chartSeasons} />
          </div>

          {/* Table */}
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
              <div className="col-span-2">Season</div>
              <div className="col-span-4">Team</div>
              <div className="col-span-2 text-right">WAR</div>
              <div className="col-span-2 text-right">Games</div>
              <div className="col-span-2 text-right">TPS</div>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {seasonsDesc.map((s, idx) => (
                <div
                  key={`${s.season}-${idx}`}
                  className="grid grid-cols-12 gap-3 px-4 py-3 text-sm"
                >
                  <div className="col-span-2 font-semibold">{s.season}</div>
                  <div className="col-span-4 truncate text-slate-700">
                    {s.team ?? p.team ?? "—"}
                  </div>
                  <div className="col-span-2 text-right tabular-nums">
                    {fmt2(s.war ?? null)}
                  </div>
                  <div className="col-span-2 text-right tabular-nums">
                    {s.games_played ?? "—"}
                  </div>
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
