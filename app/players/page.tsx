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
    breakdown?: {
      warUsed?: number | null;
      tpsModifier?: number | null;
    };
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

function makeHref(q: string, page: number, limit: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `/players?${params.toString()}`;
}

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

function Pager({
  q,
  page,
  totalPages,
  limit,
}: {
  q: string;
  page: number;
  totalPages: number;
  limit: number;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const items = getPageItems(page, totalPages);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={!hasPrev}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            hasPrev
              ? "bg-white border-slate-200 hover:bg-slate-50"
              : "pointer-events-none bg-white border-slate-200 opacity-50 text-slate-400"
          }`}
          href={makeHref(q, page - 1, limit)}
        >
          Prev
        </Link>

        <Link
          aria-disabled={!hasNext}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            hasNext
              ? "bg-white border-slate-200 hover:bg-slate-50"
              : "pointer-events-none bg-white border-slate-200 opacity-50 text-slate-400"
          }`}
          href={makeHref(q, page + 1, limit)}
        >
          Next
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {items.map((it, idx) => {
          if (it === "...") {
            return (
              <span key={`dots-${idx}`} className="px-2 text-slate-400">
                …
              </span>
            );
          }

          const isActive = it === page;
          return (
            <Link
              key={it}
              href={makeHref(q, it, limit)}
              className={`min-w-9 text-center rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50"
              }`}
            >
              {it}
            </Link>
          );
        })}
      </div>

      <form action="/players" method="get" className="flex items-center gap-2">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <input type="hidden" name="limit" value={limit} />
        <label className="text-sm text-slate-600">Jump</label>
        <input
          name="page"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={page}
          className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
        >
          Go
        </button>
      </form>
    </div>
  );
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

  // ✅ Query players directly (do NOT fetch your own API from SSR)
  let query = supabase
    .from("players")
    .select("id,name,team,position,age,tps,games_played,image_url", { count: "exact" });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: players, count, error: playersError } = await query
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (playersError) {
    throw new Error(`Failed to load players: ${playersError.message}`);
  }

  const safePlayers = (players ?? []) as PlayerRow[];
  const total = typeof count === "number" ? count : safePlayers.length;
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

  if (safePlayers.length === 0) {
    return (
      <div className="text-base">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Players</h1>
            <p className="text-slate-600">Search and open any player to see their current value.</p>
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

        <div className="mb-4">
          <Pager q={q} page={page} totalPages={totalPages} limit={limit} />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-14 text-center text-sm text-slate-500">No players found.</div>
        </div>

        <div className="mt-6">
          <Pager q={q} page={page} totalPages={totalPages} limit={limit} />
        </div>
      </div>
    );
  }

  // ✅ Load seasons in one query for valuation (WAR-first)
  const playerIds = safePlayers.map((p) => p.id);

  const { data: seasons, error: seasonsError } = await supabase
    .from("player_seasons")
    .select("player_id,season,tps,games_played,war")
    .in("player_id", playerIds);

  if (seasonsError) {
    throw new Error(`Failed to load player seasons: ${seasonsError.message}`);
  }

  const seasonsByPlayer = new Map<number, any[]>();
  for (const s of seasons ?? []) {
    const pid = (s as any).player_id as number;
    if (!seasonsByPlayer.has(pid)) seasonsByPlayer.set(pid, []);
    seasonsByPlayer.get(pid)!.push(s);
  }

  const rows: PlayerRow[] = safePlayers.map((player) => {
    const playerSeasons = seasonsByPlayer.get(player.id) ?? [];
    const { valuation } = getPlayerValuation(player as any, playerSeasons);
    return { ...player, valuation };
  });

  // Keep your sort by valuation
  rows.sort((a, b) => (b.valuation?.estimatedDollarValue ?? 0) - (a.valuation?.estimatedDollarValue ?? 0));

  return (
    <div className="text-base">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-slate-600">Search and open any player to see their current value.</p>
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

      <div className="mb-4">
        <Pager q={q} page={page} totalPages={totalPages} limit={limit} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500">
          <div className="col-span-6 sm:col-span-5">Player</div>
          <div className="col-span-3 sm:col-span-2">Team</div>
          <div className="col-span-3 sm:col-span-2">Pos</div>
          <div className="hidden sm:col-span-1 sm:block">Age</div>
          <div className="hidden sm:col-span-2 sm:block text-right">Est. Value</div>
        </div>

        <div className="divide-y divide-slate-200">
          {rows.map((p) => {
            const est = p.valuation?.estimatedDollarValue ?? null;
            const warUsed = p.valuation?.breakdown?.warUsed ?? null;
            const tpsMod = p.valuation?.breakdown?.tpsModifier ?? null;

            return (
              <div key={p.id} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
                <div className="col-span-6 sm:col-span-5">
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-4 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
                    prefetch={false}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url ?? "/placeholder.png"}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        WAR used: {warUsed ?? "—"} · TPS mod: {tpsMod ?? "—"}
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="col-span-3 sm:col-span-2 truncate text-sm">{p.team ?? "—"}</div>
                <div className="col-span-3 sm:col-span-2 truncate text-sm">{p.position ?? "—"}</div>
                <div className="hidden sm:block sm:col-span-1 text-sm">{p.age ?? "—"}</div>
                <div className="hidden sm:block sm:col-span-2 text-right text-sm font-semibold">
                  {formatMoney(est)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <Pager q={q} page={page} totalPages={totalPages} limit={limit} />
      </div>
    </div>
  );
}
