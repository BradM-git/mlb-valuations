// app/players/fallers/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";

export const dynamic = "force-dynamic";

type Player = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
};

type SeasonRow = {
  player_id: number;
  season: number;
  war: number | null;
  games_played: number | null;
};

function getMostRecentCompletedSeason(): number {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 10 ? y : y - 1;
}

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDelta(n: number) {
  const sign = n > 0 ? "+" : "";
  return sign + formatMoney(n);
}

export default async function FallersPage() {
  const currentSeason = getMostRecentCompletedSeason();
  const priorSeason = currentSeason - 1;

  const { data: seasonRows } = await supabase
    .from("player_seasons")
    .select(
      `
      player_id,
      season,
      war,
      games_played,
      players:players (
        id,
        name,
        team,
        position,
        age,
        image_url
      )
    `
    )
    .in("season", [priorSeason, currentSeason]);

  const byPlayer = new Map<number, { player: Player; rows: SeasonRow[] }>();

  for (const r of seasonRows ?? []) {
    const p = Array.isArray((r as any).players)
      ? (r as any).players[0]
      : (r as any).players;
    if (!p) continue;

    if (!byPlayer.has(p.id)) {
      byPlayer.set(p.id, {
        player: {
          id: p.id,
          name: p.name,
          team: p.team ?? null,
          position: p.position ?? null,
          age: p.age ?? null,
          image_url: p.image_url ?? null,
        },
        rows: [],
      });
    }
    byPlayer.get(p.id)!.rows.push(r as any);
  }

  const movers: {
    player: Player;
    delta: number;
    current: number;
  }[] = [];

  for (const { player, rows } of byPlayer.values()) {
    const upToCurrent = rows.filter((r) => r.season <= currentSeason);
    const upToPrior = rows.filter((r) => r.season <= priorSeason);

    const { valuation: cur } = getPlayerValuation(player as any, upToCurrent as any);
    const { valuation: prev } = getPlayerValuation(player as any, upToPrior as any);

    if (!cur?.estimatedDollarValue || !prev?.estimatedDollarValue) continue;

    const delta = cur.estimatedDollarValue - prev.estimatedDollarValue;
    if (delta >= 0) continue;

    movers.push({
      player,
      delta,
      current: cur.estimatedDollarValue,
    });
  }

  // Most negative first
  movers.sort((a, b) => a.delta - b.delta);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Biggest Fallers</h1>
        <p className="text-slate-600">
          Change in estimated standing from {priorSeason} → {currentSeason}.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500">
          <div className="col-span-6 sm:col-span-4">Player</div>
          <div className="hidden sm:block sm:col-span-2">Team</div>
          <div className="hidden sm:block sm:col-span-2">Pos</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Δ</div>
          <div className="col-span-6 sm:col-span-2 text-right">Now</div>
        </div>

        <div className="divide-y divide-slate-200">
          {movers.slice(0, 50).map(({ player, delta, current }) => (
            <div key={player.id} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
              <div className="col-span-6 sm:col-span-4">
                <Link
                  href={`/players/${player.id}`}
                  className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={player.image_url ?? "/placeholder.png"}
                      alt={player.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="truncate text-base font-semibold">
                    {player.name}
                  </div>
                </Link>
              </div>

              <div className="hidden sm:block sm:col-span-2 text-sm">{player.team ?? "—"}</div>
              <div className="hidden sm:block sm:col-span-2 text-sm">{player.position ?? "—"}</div>

              <div className="hidden sm:block sm:col-span-2 text-right text-sm font-semibold text-red-700">
                {formatDelta(delta)}
              </div>

              <div className="col-span-6 sm:col-span-2 text-right text-sm font-semibold">
                {formatMoney(current)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/players" className="text-sm font-semibold hover:underline">
          Back to Browse
        </Link>
        <Link href="/players/risers" className="text-sm font-semibold hover:underline">
          View Risers
        </Link>
      </div>
    </div>
  );
}
