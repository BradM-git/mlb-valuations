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

const CURRENT_SEASON = 2025;

// Keep the underlying ranking logic WAR-first, but DO NOT show it on the homepage.
async function getTopPlayersRightNow(): Promise<PlayerCard[]> {
  // Pull recent-season WAR rows and join the player record.
  // If you later want a games_played threshold, add `.gte("games_played", X)` here.
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
    .eq("season", CURRENT_SEASON)
    .order("war", { ascending: false, nullsFirst: false })
    .limit(25); // pull a few extra in case of null joins

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

          {topPlayers.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              Unable to load Top 10 right now.
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Rankings reflect recent performance context, not long-term value.
        </p>
      </section>
    </div>
  );
}
