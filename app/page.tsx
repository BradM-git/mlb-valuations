// app/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PlayerCard = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
};

type SeasonJoinRow = {
  player_id: number;
  season: number;
  war: number | null;
  games_played: number | null;
  players:
    | {
        id: number;
        name: string;
        team: string | null;
        position: string | null;
        age: number | null;
        image_url: string | null;
      }
    | {
        id: number;
        name: string;
        team: string | null;
        position: string | null;
        age: number | null;
        image_url: string | null;
      }[];
};

function normalizePlayer(p: SeasonJoinRow["players"]) {
  return Array.isArray(p) ? p[0] : p;
}

function getMostRecentCompletedSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 10 ? year : year - 1;
}

async function getTopPlayersRightNow(): Promise<PlayerCard[]> {
  const season = getMostRecentCompletedSeason();

  const { data, error } = await supabase
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
    .eq("season", season)
    .order("war", { ascending: false, nullsFirst: false })
    .limit(25);

  if (error) {
    console.error("Homepage Top 10 query failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as SeasonJoinRow[];

  const cards: PlayerCard[] = [];
  const seen = new Set<number>();

  for (const r of rows) {
    const p = normalizePlayer(r.players);
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);

    cards.push({
      id: p.id,
      name: p.name,
      team: p.team ?? null,
      position: p.position ?? null,
      age: p.age ?? null,
      image_url: p.image_url ?? null,
    });

    if (cards.length >= 10) break;
  }

  return cards;
}

export default async function HomePage() {
  const topPlayers = await getTopPlayersRightNow();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Top MLB Players Right Now</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ranked by recent on-field impact and trajectory
        </p>
      </header>

      {/* HERO / PROMISE PANEL */}
      <section className="mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Know who’s trending before the headlines catch up.
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-700">
            MLB Valuations is an authority-first signal board for{" "}
            <span className="font-semibold">recent impact and trajectory</span> — built for fans,
            fantasy prep, and betting-adjacent context{" "}
            <span className="font-semibold">(not picks)</span>.
          </p>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <ul className="space-y-2 text-sm text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">What you’re seeing:</span>{" "}
                a “best right now” Top 10 view — WAR-led and context-aware.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Why it matters:</span>{" "}
                quickly surfaces momentum, stability, and context in one glance.
              </li>
              <li>
                <span className="font-semibold text-slate-900">What it isn’t:</span>{" "}
                not projections, not betting advice, and not a front-office simulator.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4">
          {topPlayers.map((p, idx) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="group block rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 p-4 sm:p-5">
                <div className="w-10 text-sm font-semibold text-slate-500 tabular-nums">
                  #{idx + 1}
                </div>

                <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url ?? "/placeholder.png"}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-900 group-hover:underline">
                    {p.name}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-600">
                    {(p.position ?? "—") + " · " + (p.team ?? "—") + " · Age " + (p.age ?? "—")}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Rankings reflect recent performance context, not long-term value.
        </p>
      </section>
    </div>
  );
}
