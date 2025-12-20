// app/players/risers/page.tsx
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
  tps: number | null;
};

function getMostRecentCompletedSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  // Nov/Dec => offseason => treat current year as most recent completed season
  return month >= 10 ? year : year - 1;
}

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDelta(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + formatMoney(n);
}

async function fetchCurrentSeasonPlayers(season: number): Promise<Player[]> {
  // Pull full-league player list via player_seasons join (paged)
  const PAGE = 1000;
  let offset = 0;

  const out: Player[] = [];
  const seen = new Set<number>();

  while (true) {
    const { data, error } = await supabase
      .from("player_seasons")
      .select(
        `
        player_id,
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
      .eq("season", season)
      .order("player_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Failed to load current season players: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as any[]) {
      const p = Array.isArray(row.players) ? row.players[0] : row.players;
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        id: p.id,
        name: p.name,
        team: p.team ?? null,
        position: p.position ?? null,
        age: p.age ?? null,
        image_url: p.image_url ?? null,
      });
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

async function fetchSeasonsForPlayers(playerIds: number[], seasons: number[]): Promise<SeasonRow[]> {
  const PAGE = 1000;
  const out: SeasonRow[] = [];

  for (let i = 0; i < playerIds.length; i += PAGE) {
    const ids = playerIds.slice(i, i + PAGE);

    const { data, error } = await supabase
      .from("player_seasons")
      .select("player_id,season,war,games_played,tps")
      .in("player_id", ids)
      .in("season", seasons);

    if (error) throw new Error(`Failed to load player seasons: ${error.message}`);
    if (data && data.length) out.push(...(data as SeasonRow[]));
  }

  return out;
}

export default async function RisersPage() {
  const currentSeason = getMostRecentCompletedSeason();
  const priorSeason = currentSeason - 1;

  const players = await fetchCurrentSeasonPlayers(currentSeason);
  const playerIds = players.map((p) => p.id);

  const seasonRows = await fetchSeasonsForPlayers(playerIds, [priorSeason, currentSeason]);

  const seasonsByPlayer = new Map<number, SeasonRow[]>();
  for (const s of seasonRows) {
    if (!seasonsByPlayer.has(s.player_id)) seasonsByPlayer.set(s.player_id, []);
    seasonsByPlayer.get(s.player_id)!.push(s);
  }

  type Mover = {
    player: Player;
    currentValue: number;
    priorValue: number;
    delta: number;
  };

  const movers: Mover[] = [];

  for (const p of players) {
    const all = seasonsByPlayer.get(p.id) ?? [];
    const upToCurrent = all.filter((r) => r.season <= currentSeason);
    const upToPrior = all.filter((r) => r.season <= priorSeason);

    const { valuation: vCur } = getPlayerValuation(p as any, upToCurrent as any);
    const { valuation: vPrev } = getPlayerValuation(p as any, upToPrior as any);

    const cur = vCur?.estimatedDollarValue ?? null;
    const prev = vPrev?.estimatedDollarValue ?? null;
    if (cur == null || prev == null) continue;

    movers.push({
      player: p,
      currentValue: cur,
      priorValue: prev,
      delta: cur - prev,
    });
  }

  movers.sort((a, b) => b.delta - a.delta);

  const top = movers.slice(0, 50);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Biggest Risers</h1>
        <p className="mt-2 text-sm text-slate-600">
          Largest estimated standing increases from {priorSeason} → {currentSeason}.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500">
          <div className="col-span-6 sm:col-span-5">Player</div>
          <div className="hidden sm:block sm:col-span-2">Team</div>
          <div className="hidden sm:block sm:col-span-2">Pos</div>
          <div className="col-span-3 sm:col-span-1 text-right">Δ</div>
          <div className="col-span-3 sm:col-span-2 text-right">Now</div>
        </div>

        <div className="divide-y divide-slate-200">
          {top.map((m) => (
            <div key={m.player.id} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
              <div className="col-span-6 sm:col-span-5">
                <Link
                  href={`/players/${m.player.id}`}
                  className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
                  prefetch={false}
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.player.image_url ?? "/placeholder.png"}
                      alt={m.player.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{m.player.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {formatMoney(m.priorValue)} → {formatMoney(m.currentValue)}
                    </div>
                  </div>
                </Link>
              </div>

              <div className="hidden sm:block sm:col-span-2 truncate text-sm">{m.player.team ?? "—"}</div>
              <div className="hidden sm:block sm:col-span-2 truncate text-sm">
                {m.player.position ?? "—"}
              </div>

              <div className="col-span-3 sm:col-span-1 text-right text-sm font-semibold text-green-700">
                {formatDelta(m.delta)}
              </div>

              <div className="col-span-3 sm:col-span-2 text-right text-sm font-semibold">
                {formatMoney(m.currentValue)}
              </div>
            </div>
          ))}

          {top.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              No movers available.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/players"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Back to Browse
        </Link>
        <Link
          href="/players/fallers"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          View Fallers
        </Link>
      </div>
    </div>
  );
}
