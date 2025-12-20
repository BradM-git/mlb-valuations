// app/players/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerValuation } from "@/lib/valuation";

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
  };
};

type SeasonRow = {
  player_id: number;
  season: number;
  war: number | null;
  games_played: number | null;
};

function toInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function outlookLabel(v?: "up" | "steady" | "down") {
  if (v === "up") return { label: "Up", icon: "↑", cls: "text-green-600" };
  if (v === "down") return { label: "Down", icon: "↓", cls: "text-red-600" };
  return { label: "Steady", icon: "→", cls: "text-slate-500" };
}

function makeHref(q: string, page: number, limit: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `/players?${params.toString()}`;
}

// Outlook v1 (defensible + simple): compare WAR current vs prior, with games played as stability proxy
function getOutlookFromSeasons(
  seasons: SeasonRow[],
  fallback: "steady" = "steady"
): "up" | "steady" | "down" {
  if (!seasons || seasons.length === 0) return fallback;

  const bySeason = new Map<number, SeasonRow>();
  for (const s of seasons) bySeason.set(s.season, s);

  const years = Array.from(bySeason.keys()).sort((a, b) => a - b);
  if (years.length < 2) return fallback;

  const curYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  const cur = bySeason.get(curYear);
  const prev = bySeason.get(prevYear);

  const curWar = cur?.war ?? null;
  const prevWar = prev?.war ?? null;
  const curG = cur?.games_played ?? null;
  const prevG = prev?.games_played ?? null;

  if (curWar == null || prevWar == null) return fallback;

  // Stability proxy: if player barely played either year, avoid strong directional call
  const minGames = 50;
  const stable =
    (curG == null || curG >= minGames) && (prevG == null || prevG >= minGames);

  const delta = curWar - prevWar;

  // Small changes should be "steady"
  const threshold = stable ? 0.5 : 1.0;

  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "steady";
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string; limit?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const page = toInt(sp.page, 1);
  const limit = toInt(sp.limit, 25);

  const offset = (page - 1) * limit;

  let query = supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url", {
      count: "exact",
    });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: players, count, error } = await query
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const safePlayers = (players ?? []) as PlayerRow[];
  const total = typeof count === "number" ? count : safePlayers.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const playerIds = safePlayers.map((p) => p.id);

  const { data: seasons, error: seasonsError } = await supabase
    .from("player_seasons")
    .select("player_id,season,war,games_played")
    .in("player_id", playerIds);

  if (seasonsError) throw new Error(seasonsError.message);

  const seasonsByPlayer = new Map<number, SeasonRow[]>();
  for (const s of (seasons ?? []) as SeasonRow[]) {
    if (!seasonsByPlayer.has(s.player_id)) seasonsByPlayer.set(s.player_id, []);
    seasonsByPlayer.get(s.player_id)!.push(s);
  }

  const rows = safePlayers.map((player) => {
    const playerSeasons = seasonsByPlayer.get(player.id) ?? [];
    const { valuation } = getPlayerValuation(player as any, playerSeasons as any);
    return { ...player, valuation };
  });

  rows.sort(
    (a, b) =>
      (b.valuation?.estimatedDollarValue ?? 0) -
      (a.valuation?.estimatedDollarValue ?? 0)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-slate-600">
            Browse and compare current player standings.
          </p>

          <div className="mt-2 flex gap-4 text-sm font-semibold">
            <Link href="/players/risers" className="text-green-700 hover:underline">
              Biggest Risers
            </Link>
            <Link href="/players/fallers" className="text-red-700 hover:underline">
              Biggest Fallers
            </Link>
          </div>
        </div>

        <form action="/players" method="get" className="flex w-full gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search player name…"
            className="w-full sm:w-96 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input type="hidden" name="limit" value={limit} />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500">
          <div className="col-span-6 sm:col-span-4">Player</div>
          <div className="hidden sm:block sm:col-span-2">Team</div>
          <div className="hidden sm:block sm:col-span-2">Pos</div>
          <div className="hidden sm:block sm:col-span-2">Outlook</div>
          <div className="col-span-6 sm:col-span-2 text-right">Est. Value</div>
        </div>

        <div className="divide-y divide-slate-200">
          {rows.map((p) => {
            const playerSeasons = seasonsByPlayer.get(p.id) ?? [];
            const outlook = getOutlookFromSeasons(playerSeasons, "steady");
            const o = outlookLabel(outlook);

            return (
              <div key={p.id} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
                <div className="col-span-6 sm:col-span-4">
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url ?? "/placeholder.png"}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{p.name}</div>
                    </div>
                  </Link>
                </div>

                <div className="hidden sm:block sm:col-span-2 text-sm">{p.team ?? "—"}</div>
                <div className="hidden sm:block sm:col-span-2 text-sm">{p.position ?? "—"}</div>

                <div className={`hidden sm:block sm:col-span-2 text-sm font-semibold ${o.cls}`}>
                  {o.icon} {o.label}
                </div>

                <div className="col-span-6 sm:col-span-2 text-right text-sm font-semibold">
                  {formatMoney(p.valuation?.estimatedDollarValue)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
