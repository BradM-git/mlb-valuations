import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

console.log('START backfill-war')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ====== CONFIG ======
const START_SEASON = 2015
const END_SEASON = 2025
const WAR_SOURCE = 'fangraphs'

// NOTE: You must set these URLs to your chosen WAR CSV exports.
// You can start by pasting the per-season CSV export URLs you’re using.
function warCsvUrlForSeason(season: number): string {
  // TODO: replace with your actual per-season export URL pattern
  // Throwing forces you to supply real URLs instead of silently doing the wrong thing.
  throw new Error(`Set warCsvUrlForSeason(${season}) to a real Fangraphs WAR CSV export URL`)
}

// ====== CSV PARSER (quotes + commas) ======
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++ }
      else inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []; cell = ''
      continue
    }
    cell += ch
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function toNum(v: string | undefined): number | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function main() {
  // 1) Load players with fangraphs_id and internal id
  console.log('Loading players with fangraphs_id...')
  const { data: players, error } = await supabase
    .from('players')
    .select('id, fangraphs_id')
    .not('fangraphs_id', 'is', null)

  if (error) throw error
  if (!players?.length) throw new Error('No players with fangraphs_id found')

  const fgToPlayerId = new Map<number, number>()
  for (const p of players as Array<{ id: number; fangraphs_id: number }>) {
    fgToPlayerId.set(p.fangraphs_id, p.id)
  }
  console.log('Players with fangraphs_id:', fgToPlayerId.size)

  // 2) For each season: download WAR CSV, parse, upsert into player_seasons.war
  for (let season = START_SEASON; season <= END_SEASON; season++) {
    console.log(`Season ${season}: downloading WAR CSV...`)
    const url = warCsvUrlForSeason(season)

    const res = await fetch(url, { headers: { 'User-Agent': 'mlb-valuations/1.0' } })
    if (!res.ok) throw new Error(`WAR CSV download failed for ${season}: ${res.status} ${res.statusText}`)
    const text = await res.text()

    console.log(`Season ${season}: parsing CSV...`)
    const rows = parseCsv(text)
    if (rows.length < 2) throw new Error(`Season ${season}: CSV had no data rows`)

    const header = rows[0].map(h => h.trim())

    // These column names depend on your Fangraphs export.
    // We’ll locate by common names; if not found we fail loudly.
    const fgIdIdx =
      header.findIndex(h => h.toLowerCase() === 'playerid' || h.toLowerCase() === 'playerid (fangraphs)')
    const warIdx =
      header.findIndex(h => h.toLowerCase() === 'war' || h.toLowerCase() === 'war (fangraphs)' || h.toLowerCase() === 'fwar')

    if (fgIdIdx === -1) throw new Error(`Season ${season}: could not find Fangraphs player id column in CSV header`)
    if (warIdx === -1) throw new Error(`Season ${season}: could not find WAR column in CSV header`)

    const now = new Date().toISOString()
    const upserts: any[] = []

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const fgId = toNum(r[fgIdIdx])
      const war = toNum(r[warIdx])

      if (!fgId || war === null) continue
      const playerId = fgToPlayerId.get(Math.trunc(fgId))
      if (!playerId) continue

      upserts.push({
        player_id: playerId,
        season,
        war,
        war_source: WAR_SOURCE,
        war_partial: false,
        war_updated_at: now,
      })
    }

    console.log(`Season ${season}: upserting ${upserts.length} WAR rows...`)

    // Upsert by (player_id, season) — you already added this unique constraint
    const chunkSize = 1000
    for (let i = 0; i < upserts.length; i += chunkSize) {
      const chunk = upserts.slice(i, i + chunkSize)
      const { error: upsertErr } = await supabase
        .from('player_seasons')
        .upsert(chunk, { onConflict: 'player_id,season' })

      if (upsertErr) throw upsertErr
      console.log(`Season ${season}: upserted ${Math.min(i + chunkSize, upserts.length)} / ${upserts.length}`)
    }
  }

  console.log('DONE backfill-war')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
