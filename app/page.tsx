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
  // Treat Nov+ (>=10) as "season complete"
  return month >= 10 ? year : year - 1;
}

// Keep Top 10 WAR-driven (not shown) — homepage shows no metrics.
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

type MovementItem = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;
  deltaWar: number; // NOT displayed
};

async function getMovementWatchTop5(): Promise<{ risers: MovementItem[]; fallers: MovementItem[] }> {
  const currentSeason = getMostRecentCompletedSeason();
  const priorSeason = currentSeason - 1;

  // Pull both seasons with joined player info (league-size; should be manageable)
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
    .in("season", [priorSeason, currentSeason])
    .not("war", "is", null);

  if (error) {
    console.error("Homepage Movement Watch query failed:", error.message);
    return { risers: [], fallers: [] };
  }

  const rows = (data ?? []) as unknown as SeasonJoinRow[];

  // Map: player_id -> { currentWar, priorWar, player }
  const byPlayer = new Map<
    number,
    {
      p: PlayerCard;
      currentWar: number | null;
      priorWar: number | null;
    }
  >();

  for (const r of rows) {
    const p = normalizePlayer(r.players);
    if (!p?.id) continue;

    if (!byPlayer.has(r.player_id)) {
      byPlayer.set(r.player_id, {
        p: {
          id: p.id,
          name: p.name,
          team: p.team ?? null,
          position: p.position ?? null,
          age: p.age ?? null,
          image_url: p.image_url ?? null,
        },
        currentWar: null,
        priorWar: null,
      });
    }

    const rec = byPlayer.get(r.player_id)!;
    const war = typeof r.war === "number" ? r.war : null;

    if (r.season === currentSeason) rec.currentWar = war;
    if (r.season === priorSeason) rec.priorWar = war;
  }

  const movers: MovementItem[] = [];
  for (const rec of byPlayer.values()) {
    if (rec.currentWar == null || rec.priorWar == null) continue;
    const deltaWar = rec.currentWar - rec.priorWar;

    // Ignore tiny noise
    if (!Number.isFinite(deltaWar) || Math.abs(deltaWar) < 0.5) continue;

    movers.push({
      ...rec.p,
      deltaWar,
    });
  }

  const risers = movers
    .slice()
    .sort((a, b) => b.deltaWar - a.deltaWar)
    .slice(0, 5);

  const fallers = movers
    .slice()
    .sort((a, b) => a.deltaWar - b.deltaWar)
    .slice(0, 5);

  return { risers, fallers };
}

function MiniPlayerRow({ p }: { p: PlayerCard }) {
  return (
    <Link
      href={`/players/${p.id}`}
      className="group flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-slate-50 transition"
    >
      <div className="h-9 w-9 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image_url ?? "/placeholder.png"}
          alt={p.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 group-hover:underline">
          {p.name}
        </div>
        <div className="truncate text-xs text-slate-600">
          {(p.position ?? "—") + " · " + (p.team ?? "—")}
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [topPlayers, movement] = await Promise.all([
    getTopPlayersRightNow(),
    getMovementWatchTop5(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Above-the-fold dashboard header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">MLB Signal Board</h1>
        <p className="mt-2 text-sm text-slate-600">
          Recent impact and trajectory — built for fans, fantasy research, and betting-adjacent context (not picks).
        </p>
      </header>

      {/* Dashboard grid: panels + more above the fold */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: Hero + Top 10 */}
        <div className="lg:col-span-8">
          {/* HERO / PROMISE PANEL */}
          <section className="mb-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Know who’s trending before the headlines catch up.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                Authority-first signals focused on <span className="font-semibold">what’s happening now</span> and
                <span className="font-semibold"> where it’s headed</span>.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Link
                  href="/players"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
                >
                  <div className="text-sm font-bold text-slate-900">Browse Players</div>
                  <div className="mt-1 text-xs text-slate-600">Search any player and compare context.</div>
                </Link>

                <Link
                  href="/players/risers"
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition"
                >
                  <div className="text-sm font-bold text-slate-900">Biggest Risers</div>
                  <div className="mt-1 text-xs text-slate-600">Who’s moving up fastest.</div>
                </Link>

                <Link
                  href="/players/fallers"
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition"
                >
                  <div className="text-sm font-bold text-slate-900">Biggest Fallers</div>
                  <div className="mt-1 text-xs text-slate-600">Who’s sliding most.</div>
                </Link>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>
                    <span className="font-semibold text-slate-900">What this is:</span> a defensible signal board.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">What it isn’t:</span> projections, picks, or betting advice.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Top 10 panel (UNCHANGED LIST MARKUP INSIDE) */}
          <section>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Top MLB Players Right Now
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Ranked by recent on-field impact and trajectory
                  </p>
                </div>
                <Link href="/players" className="text-sm font-semibold text-slate-700 hover:underline">
                  Browse →
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
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
            </div>
          </section>
        </div>

        {/* Right column: Movement Watch (top 5 teasers) */}
        <aside className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Movement Watch</h2>
              <Link href="/players" className="text-sm font-semibold text-slate-700 hover:underline">
                Players →
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900">Biggest Risers</div>
                  <Link href="/players/risers" className="text-sm font-semibold text-green-700 hover:underline">
                    View all →
                  </Link>
                </div>
                <div className="mt-3 space-y-3">
                  {movement.risers.length > 0 ? (
                    movement.risers.map((p) => <MiniPlayerRow key={p.id} p={p} />)
                  ) : (
                    <div className="text-sm text-slate-600">No risers available.</div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900">Biggest Fallers</div>
                  <Link href="/players/fallers" className="text-sm font-semibold text-red-700 hover:underline">
                    View all →
                  </Link>
                </div>
                <div className="mt-3 space-y-3">
                  {movement.fallers.length > 0 ? (
                    movement.fallers.map((p) => <MiniPlayerRow key={p.id} p={p} />)
                  ) : (
                    <div className="text-sm text-slate-600">No fallers available.</div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Movement is based on change in WAR between the two most recent completed seasons. Shown for context only.
              </p>
            </div>
          </div>

          {/* Optional secondary panel: How this works (keeps dashboard feel) */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-900">How this works</div>
            <p className="mt-1 text-xs text-slate-600">
              Transparent, defensible signals. No projections. No picks.
            </p>
            <Link href="/methodology" className="mt-3 inline-block text-sm font-semibold hover:underline">
              Read methodology →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
