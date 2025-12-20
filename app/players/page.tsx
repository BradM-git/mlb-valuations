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

  const minGames = 50;
  const stable =
    (curG == null || curG >= minGames) && (prevG == null || prevG >= minGames);

  const delta = curWar - prevWar;
  const threshold = stable ? 0.5 : 1.0;

  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "steady";
}

function parseIdsCsv(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function uniq(nums: number[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const n of nums) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function makeHref(q: string, page: number, limit: number, compare: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (compare) params.set("compare", compare);
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
  compare,
}: {
  q: string;
  page: number;
  totalPages: number;
  limit: number;
  compare: string;
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
          href={makeHref(q, page - 1, limit, compare)}
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
          href={makeHref(q, page + 1, limit, compare)}
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
              href={makeHref(q, it, limit, compare)}
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
        {compare ? <input type="hidden" name="compare" value={compare} /> : null}
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
  searchParams?: Promise<{ q?: string; page?: string; limit?: string; compare?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const page = toInt(sp.page, 1);
  const limit = toInt(sp.limit, 25);

  const compareRaw = String(sp.compare ?? "").trim();
  const compareIds = uniq(parseIdsCsv(compareRaw));
  const compare = compareIds.length ? compareIds.join(",") : "";
  const compareList = new Set<number>(compareIds);

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
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

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

  const playerProfileHref = (id: number) => {
    if (!compare) return `/players/${id}`;
    return `/players/${id}?compare=${encodeURIComponent(compare)}`;
  };

  const compareHrefFor = (id: number) => {
    if (!compare) return `/compare?add=${id}`;
    return `/compare?ids=${encodeURIComponent(compare)}&add=${id}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-slate-600">Browse and compare current player standings.</p>

          <div className="mt-2 flex gap-4 text-sm font-semibold">
            <Link href="/players/risers" className="text-green-700 hover:underline">
              Biggest Risers
            </Link>
            <Link href="/players/fallers" className="text-red-700 hover:underline">
              Biggest Fallers
            </Link>
          </div>

          {compare ? (
            <div className="mt-2 text-xs text-slate-500">
              Compare active ({compareIds.length}):{" "}
              <Link
                href={`/compare?ids=${encodeURIComponent(compare)}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                view comparison →
              </Link>
            </div>
          ) : null}
        </div>

        <form action="/players" method="get" className="flex w-full gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search player name…"
            className="w-full sm:w-96 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input type="hidden" name="limit" value={limit} />
          {compare ? <input type="hidden" name="compare" value={compare} /> : null}
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mb-4">
        <Pager q={q} page={page} totalPages={totalPages} limit={limit} compare={compare} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500">
          <div className="col-span-6 sm:col-span-4">Player</div>
          <div className="hidden sm:block sm:col-span-2">Team</div>
          <div className="hidden sm:block sm:col-span-1">Pos</div>
          <div className="hidden sm:block sm:col-span-2">Outlook</div>
          <div className="col-span-4 sm:col-span-2 text-right">Est. Value</div>
          <div className="col-span-2 sm:col-span-1 text-right">Compare</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-200">
          {rows.map((p) => {
            const playerSeasons = seasonsByPlayer.get(p.id) ?? [];
            const outlook = getOutlookFromSeasons(playerSeasons, "steady");
            const o = outlookLabel(outlook);

            const inCompare = compareList.has(p.id);
            const compareHref = inCompare
              ? `/compare?ids=${encodeURIComponent(compare)}`
              : compareHrefFor(p.id);

            return (
              <div key={p.id} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
                {/* Player */}
                <div className="col-span-6 sm:col-span-4">
                  <Link
                    href={playerProfileHref(p.id)}
                    className="flex items-center gap-4 min-w-0 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
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
                      <div className="truncate text-base font-semibold text-slate-900">{p.name}</div>
                      <div className="truncate text-xs text-slate-500 sm:hidden">
                        {p.team ?? "—"} · {p.position ?? "—"}
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="hidden sm:block sm:col-span-2 text-sm truncate">{p.team ?? "—"}</div>
                <div className="hidden sm:block sm:col-span-1 text-sm">{p.position ?? "—"}</div>

                <div className={`hidden sm:block sm:col-span-2 text-sm font-semibold ${o.cls} whitespace-nowrap`}>
                  {o.icon} {o.label}
                </div>

                <div className="col-span-4 sm:col-span-2 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                  {formatMoney(p.valuation?.estimatedDollarValue)}
                </div>

                <div className="col-span-2 sm:col-span-1 text-right whitespace-nowrap">
                  {compare && inCompare ? (
                    <span className="text-xs font-semibold text-slate-400 cursor-default">
                      In compare
                    </span>
                  ) : (
                    <Link
                      href={compareHref}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                      title="Add to compare"
                      prefetch={false}
                    >
                      Compare +
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <Pager q={q} page={page} totalPages={totalPages} limit={limit} compare={compare} />
      </div>
    </div>
  );
}
