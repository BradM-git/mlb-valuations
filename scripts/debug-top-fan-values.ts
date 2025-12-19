import dotenv from 'dotenv'
dotenv.config({ path: '.env.local', override: true })

import { createClient } from '@supabase/supabase-js'

type PlayerRow = {
  id: number
  mlb_id: number | null
  name: string
  team: string | null
  position: string | null
  age: number | null
  tps: number | null
}

type SeasonRow = {
  player_id: number
  season: number
  tps: number | null
  war: number | null
  games_played: number | null
}

function num(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// "Fan MVP-ish" score: heavily favors current production, modestly favors prime age,
// ignores contracts entirely. This is ONLY for debugging rank weirdness.
function fanScore(args: {
  seasonTPS: number | null
  seasonWAR: number | null
  games: number | null
  age: number | null
  position: string | null
}): number {
  const tps = args.seasonTPS ?? 0
  const war = args.seasonWAR ?? 0
  const g = args.games ?? 0
  const age = args.age ?? 27

  // Reliability: downweight small samples
  const gpFactor =
    g >= 140 ? 1.0 :
    g >= 120 ? 0.95 :
    g >= 100 ? 0.90 :
    g >= 80  ? 0.80 :
    g >= 60  ? 0.65 :
    g >= 40  ? 0.50 :
    g >= 20  ? 0.35 : 0.20

  // Prime-age bump, older decline (light touch)
  const ageFactor =
    age <= 22 ? 0.92 :
    age === 23 ? 0.96 :
    age === 24 ? 1.00 :
    age === 25 ? 1.03 :
    age >= 26 && age <= 29 ? 1.05 :
    age === 30 ? 1.02 :
    age === 31 ? 0.98 :
    age === 32 ? 0.94 :
    age === 33 ? 0.90 :
    age === 34 ? 0.86 :
    age === 35 ? 0.82 : 0.75

  // Light positional scarcity (don’t go nuts)
  const pos = (args.position ?? '').toUpperCase()
  const posFactor: Record<string, number> = {
    SS: 1.03,
    C: 1.02,
    CF: 1.01,
    '2B': 1.00,
    '3B': 1.00,
    RF: 1.00,
    LF: 0.99,
    '1B': 0.98,
    DH: 0.96,
    TWP: 1.05,
    SP: 0.98,
    RP: 0.90,
    P: 0.98,
  }

  const p = posFactor[pos] ?? 1.0

  // Blend WAR + TPS (WAR primary for MVP logic, TPS backup)
  const base = (war * 10) + (tps * 0.5)

  return base * gpFactor * ageFactor * p
}

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing env vars in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // Pull a reasonable number of players with TPS to rank
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id,mlb_id,name,team,position,age,tps')
    .not('tps', 'is', null)
    .limit(2000)

  if (pErr) throw new Error(`players fetch error: ${pErr.message}`)
  const safePlayers = (players ?? []) as PlayerRow[]

  const ids = safePlayers.map(p => p.id)

  const { data: seasons, error: sErr } = await supabase
    .from('player_seasons')
    .select('player_id,season,tps,war,games_played')
    .in('player_id', ids)
    .order('player_id', { ascending: true })
    .order('season', { ascending: false })

  if (sErr) throw new Error(`player_seasons fetch error: ${sErr.message}`)

  // Pick latest season row per player_id
  const latestByPlayer = new Map<number, SeasonRow>()
  for (const row of (seasons ?? []) as any[]) {
    const pid = Number(row.player_id)
    if (!Number.isFinite(pid)) continue
    if (!latestByPlayer.has(pid)) latestByPlayer.set(pid, row as SeasonRow)
  }

  const ranked = safePlayers.map(p => {
    const s = latestByPlayer.get(p.id) ?? null

    const season = s?.season ?? null
    const seasonWAR = num(s?.war)
    const seasonTPS = num(s?.tps)
    const games = num(s?.games_played)

    const score = fanScore({
      seasonTPS,
      seasonWAR,
      games,
      age: p.age ?? null,
      position: p.position ?? null
    })

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      pos: p.position,
      age: p.age,
      player_tps: p.tps,
      latest_season: season,
      season_war: seasonWAR,
      season_tps: seasonTPS,
      games_played: games,
      score: Math.round(score * 10) / 10
    }
  })

  ranked.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  console.log('\n=== TOP 25 by DEBUG FAN SCORE (using latest season row) ===')
  console.table(ranked.slice(0, 25))

  const stars = [
    'Shohei Ohtani',
    'Bobby Witt Jr.',
    'Juan Soto',
    'Ronald Acuña Jr.',
    'Mookie Betts',
    'Aaron Judge',
    'Corey Seager',
    'Fernando Tatis Jr.',
    'Julio Rodríguez',
    'Gunnar Henderson'
  ]

  console.log('\n=== STAR CHECK (latest season row) ===')
  console.table(ranked.filter(r => stars.includes(r.name)))

  console.log('\n=== SAMPLE: missing latest season row ===')
  console.table(ranked.filter(r => r.latest_season == null).slice(0, 25))

  console.log('\n=== SAMPLE: latest season <= 2023 ===')
  console.table(ranked.filter(r => (r.latest_season ?? 0) <= 2023).slice(0, 25))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
