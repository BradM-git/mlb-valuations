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
    outlook?: "up" | "steady" | "down";
    confidence?: "high" | "medium" | "low";
  };
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

  const { data: seasons } = await supabase
    .from("player_seasons")
    .select("player_id,season,war,games_played")
    .in("player_id", playerIds);

  const seasonsByPlayer = new Map<number, any[]>();
  for (const s of seasons ?? []) {
    const pid = (s as any).player_id;
    if (!seasonsByPlayer.has(pid)) seasonsByPlayer.set(pid, []);
    seasonsByPlayer.get(pid)!.push(s);
  }

  const rows = safePlayers.map((player) => {
    const playerSeasons = seasonsByPlayer.get(player.id) ?? [];
    const { valuation } = getPlayerValuation(player as any, playerSeasons);
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

          {/* NEW: secondary links */}
          <div className="mt-2 flex gap-4 text-sm font-semibold">
            <Link
              href="/players/risers"
              className="text-green-700 hover:underline"
            >
              Biggest Risers
            </Link>
            <Link
              href="/players/fallers"
              className="text-red-700 hover:underline"
            >
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
            const o = outlookLabel(p.valuation?.outlook);
            return (
              <div
                key={p.id}
                className="grid grid-cols-12 items-center gap-3 px-6 py-4"
              >
                <div className="col-span-6 sm:col-span-4">
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <img
                        src={p.image_url ?? "/placeholder.png"}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {p.name}
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="hidden sm:block sm:col-span-2 text-sm">
                  {p.team ?? "—"}
                </div>
                <div className="hidden sm:block sm:col-span-2 text-sm">
                  {p.position ?? "—"}
                </div>

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
