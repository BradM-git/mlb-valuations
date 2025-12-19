// app/players/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

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

type PlayersApiResponse = {
  apiVersion?: string;
  page: number;
  pageSize: number;
  total: number;
  rows: PlayerRow[];
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

function makeHref(q: string, page: number, limit: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `/players?${params.toString()}`;
}

function getPageItems(current: number, total: number) {
  // Behavior:
  // - If total <= 12 => show all
  // - If near start => show 1..10 ... last
  // - If near end => show 1 ... last-9..last
  // - Else => show 1 ... (c-2..c+2) ... last
  const items: (number | "...")[] = [];
  if (total <= 12) {
    for (let i = 1; i <= total; i++) items.push(i);
    return items;
  }

  const c = Math.max(1, Math.min(total, current));

  const pushRange = (a: number, b: number) => {
    for (let i = a; i <= b; i++) items.push(i);
  };

  // near start
  if (c <= 6) {
    pushRange(1, 10);
    items.push("...");
    items.push(total);
    return items;
  }

  // near end
  if (c >= total - 5) {
    items.push(1);
    items.push("...");
    pushRange(total - 9, total);
    return items;
  }

  // middle
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
      {/* Prev/Next */}
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

      {/* Page numbers */}
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

      {/* Jump to page */}
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
  // ✅ Next.js 16: searchParams is a Promise
  searchParams?: Promise<{
    // legacy UI params (kept)
    q?: string;
    limit?: string;

    // canonical params (supported for forward compatibility)
    name?: string;
    pageSize?: string;

    page?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  // UI still uses q/limit, but we also accept name/pageSize if present
  const q = (sp.q ?? "").trim();
  const name = (sp.name ?? sp.q ?? "").trim();

  const page = toInt(sp.page, 1);

  const limit = toInt(sp.limit, 25);
  const pageSize = toInt(sp.pageSize ?? sp.limit, 25);

  const baseUrl = await getBaseUrl();

  // ✅ API expects name/page/pageSize
  const apiParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (name) apiParams.set("name", name);

  const url = `${baseUrl}/api/players?${apiParams.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok)
    throw new Error(`Failed to load players: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as PlayersApiResponse;

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const effectivePageSize = Number.isFinite(data?.pageSize) ? data.pageSize : pageSize;
  const total = Number.isFinite(data?.total) ? data.total : 0;
  const totalPages =
    effectivePageSize > 0 ? Math.max(1, Math.ceil(total / effectivePageSize)) : 1;

  return (
    <div className="text-base">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="text-slate-600">
            Search and open any player to see their current value.
          </p>
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

      {/* TOP pager */}
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

                <div className="col-span-3 sm:col-span-2 truncate text-sm">
                  {p.team ?? "—"}
                </div>
                <div className="col-span-3 sm:col-span-2 truncate text-sm">
                  {p.position ?? "—"}
                </div>
                <div className="hidden sm:block sm:col-span-1 text-sm">{p.age ?? "—"}</div>
                <div className="hidden sm:block sm:col-span-2 text-right text-sm font-semibold">
                  {formatMoney(est)}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              No players found.
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM pager */}
      <div className="mt-6">
        <Pager q={q} page={page} totalPages={totalPages} limit={limit} />
      </div>
    </div>
  );
}
