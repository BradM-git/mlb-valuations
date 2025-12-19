// app/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

type PlayerRow = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
  valuation?: {
    estimatedDollarValue?: number | null;
  };
};

type PlayersApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  rows: PlayerRow[];
};

function formatMoneyMillions(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const mm = n / 1_000_000;
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(mm) + "M"
  );
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

export default async function HomePage() {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/players?page=1&limit=10`, { cache: "no-store" });

  let topPlayers: PlayerRow[] = [];
  if (res.ok) {
    const data = (await res.json()) as PlayersApiResponse;
    topPlayers = (Array.isArray(data?.rows) ? data.rows : []).slice(0, 10);
  }

  return (
    <div>
      {/* Hero */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          See who’s actually driving wins
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          MLB Valuations helps you compare players in seconds — rankings, searchable profiles, and a clean value estimate
          built around real on-field impact. If you follow trades, contracts, or team-building, this is your shortcut.
        </p>

        <div className="mt-6 text-slate-600 max-w-3xl">
          <ul className="list-disc list-inside space-y-1">
            <li>Browse the player list to compare value across the league</li>
            <li>Search any name to pull up a profile instantly</li>
            <li>Open a player to see their recent performance and how their value stacks up</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/players"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Browse Players
          </Link>
          <Link
            href="/methodology"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            How it’s calculated
          </Link>
        </div>
      </div>

      {/* Top players */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Top 10 Players Right Now</h2>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {topPlayers.map((p, idx) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50 transition"
              prefetch={false}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-slate-300 w-12">#{idx + 1}</div>

                <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url ?? "/placeholder.png"}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{p.name}</div>
                  <div className="truncate text-sm text-slate-600">
                    {p.position ?? "—"} · {p.team ?? "—"} · Age {p.age ?? "—"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">
                    {formatMoneyMillions(p.valuation?.estimatedDollarValue ?? null)}
                  </div>
                  <div className="text-xs text-slate-500">Est. value</div>
                </div>
              </div>
            </Link>
          ))}

          {topPlayers.length === 0 && (
            <div className="text-sm text-slate-600">Couldn’t load top players. Try refreshing.</div>
          )}
        </div>
      </section>
    </div>
  );
}
