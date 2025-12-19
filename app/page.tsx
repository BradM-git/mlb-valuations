// app/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const WEIGHT_CURRENT = 0.7;
const WEIGHT_PREV = 0.3;

const MIN_GAMES_HITTER_CURRENT = 100;
const MIN_GAMES_PITCHER_CURRENT = 20;

// Track record soft requirements (used for penalties, not hard exclusion)
const MIN_GAMES_HITTER_PREV = 80;
const MIN_GAMES_PITCHER_PREV = 15;

const PITCHER_DAMPEN = 0.9;

// Candidate pool derived from current season WAR (no TPS gate)
const CANDIDATE_LIMIT_CURRENT_SEASON = 250;

type PlayerObj = {
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
  // Supabase may return join as array depending on relationship typing
  players: PlayerObj[] | PlayerObj | null;
};

type SeasonRow = {
  player_id: number;
  season: number;
  war: number | null;
  games_played: number | null;
};

type PlayerCard = {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  age: number | null;
  image_url: string | null;

  // internal (not displayed)
  fanScore: number;
  warCurrent: number;
  warPrev: number;
  seasonCurrent: number;
};

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPitcher(pos?: string | null) {
  if (!pos) return false;
  return /\bP\b/.test(pos) || pos.includes("P");
}

function ageMultiplier(age?: number | null) {
  const a = Number(age);
  if (!Number.isFinite(a) || a <= 0) return 1;

  if (a <= 30) return 1;
  if (a <= 34) return Math.pow(0.98, a - 30);
  return 0.92 * Math.pow(0.96, a - 34);
}

function normalizePlayer(p: SeasonJoinRow["players"]): PlayerObj | null {
  if (!p) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}

async function resolveMostRecentSeason(): Promise<number | null> {
  const { data, error } = await supabase
    .from("player_seasons")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);

  if (error) return null;
  const s = data?.[0]?.season;
  return Number.isFinite(s) ? s : null;
}

export default async function HomePage() {
  const seasonCurrent = await resolveMostRecentSeason();
  const seasonPrev = seasonCurrent != null ? seasonCurrent - 1 : null;

  let topPlayers: PlayerCard[] = [];

  if (seasonCurrent != null && seasonPrev != null) {
    const { data: curRows, error: curErr } = await supabase
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
      .eq("season", seasonCurrent)
      .not("war", "is", null)
      .order("war", { ascending: false })
      .limit(CANDIDATE_LIMIT_CURRENT_SEASON);

    if (!curErr && Array.isArray(curRows) && curRows.length) {
      const candidates = (curRows as unknown as SeasonJoinRow[])
        .map((r) => ({ ...r, players: normalizePlayer(r.players) }))
        .filter((r) => r.players && Number.isFinite(r.players.id))
        .filter((r) => {
          const pos = r.players?.position ?? null;
          const gp = num(r.games_played);
          const minGp = isPitcher(pos) ? MIN_GAMES_PITCHER_CURRENT : MIN_GAMES_HITTER_CURRENT;
          return gp >= minGp;
        });

      const ids = candidates.map((r) => r.player_id);

      const { data: prevRows, error: prevErr } = await supabase
        .from("player_seasons")
        .select("player_id,season,war,games_played")
        .in("player_id", ids)
        .eq("season", seasonPrev);

      const prevByPlayer = new Map<number, SeasonRow>();
      if (!prevErr && Array.isArray(prevRows)) {
        for (const r of prevRows as SeasonRow[]) {
          const pid = Number((r as any).player_id);
          if (!Number.isFinite(pid)) continue;
          prevByPlayer.set(pid, r);
        }
      }

      const scored: PlayerCard[] = candidates.map((r) => {
        const p = r.players as PlayerObj;
        const pos = p.position ?? null;

        const warCur = num(r.war);
        const prev = prevByPlayer.get(r.player_id);
        const warPrev = num(prev?.war);

        let score = WEIGHT_CURRENT * warCur + WEIGHT_PREV * warPrev;

        if (isPitcher(pos)) score *= PITCHER_DAMPEN;

        // Track record penalty
        const gpPrev = num(prev?.games_played);
        const minPrev = isPitcher(pos) ? MIN_GAMES_PITCHER_PREV : MIN_GAMES_HITTER_PREV;
        if (gpPrev < minPrev) score *= 0.92;
        if (warPrev <= 0) score *= 0.9;

        score *= ageMultiplier(p.age);

        return {
          id: p.id,
          name: p.name,
          team: p.team,
          position: p.position,
          age: p.age,
          image_url: p.image_url,
          fanScore: score,
          warCurrent: warCur,
          warPrev,
          seasonCurrent,
        };
      });

      scored.sort((a, b) => b.fanScore - a.fanScore);
      topPlayers = scored.slice(0, 10);
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          See who’s actually driving wins
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          MLB Valuations helps you compare players fast — searchable profiles, season-by-season performance,
          and a clear way to see who’s impacting games right now.
        </p>

        <div className="mt-6 text-slate-600 max-w-3xl">
          <ul className="list-disc list-inside space-y-1">
            <li>Browse and search any player to pull up their profile instantly</li>
            <li>See performance history and trends year over year</li>
            <li>Understand impact with simple, consistent metrics (explained in Methodology)</li>
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
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Top 10 Players Right Now</h2>
          <p className="text-sm text-slate-600">
            Ranked by recent on-field impact, weighted toward the most recent season.
          </p>
        </div>

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

                {/* No visible metric on homepage (intentionally) */}
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
