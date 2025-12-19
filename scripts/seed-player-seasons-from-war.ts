// scripts/seed-player-seasons-from-war.ts
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

console.log('START seed-player-seasons-from-war')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// paths
const ZIP_PATH = path.join(process.cwd(), 'data', 'bbref', 'war_archive.zip')
const EXTRACT_DIR = path.join(process.cwd(), 'data', 'bbref', 'war_archive')

// players table MLBAM column name
const MLBAM_COL = 'mlb_id'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }

  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function toNum(v?: string): number | null {
  const s = (v ?? '').trim()
  if (!s || s === 'NULL') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function ensureExtracted() {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`Missing ${ZIP_PATH}. Put war_archive.zip in data/bbref/`)
  }
  if (!fs.existsSync(EXTRACT_DIR)) fs.mkdirSync(EXTRACT_DIR, { recursive: true })

  const batFile = path.join(EXTRACT_DIR, 'war_daily_bat.txt')
  const pitFile = path.join(EXTRACT_DIR, 'war_daily_pitch.txt')
  if (fs.existsSync(batFile) && fs.existsSync(pitFile)) return

  execSync(`unzip -q -o "${ZIP_PATH}" -d "${EXTRACT_DIR}"`)
}

async function main() {
  await ensureExtracted()

  const batFile = path.join(EXTRACT_DIR, 'war_daily_bat.txt')
  const pitFile = path.join(EXTRACT_DIR, 'war_daily_pitch.txt')

  console.log('Using files:', { batFile, pitFile })

  // ✅ Load ALL players (paged) to avoid Supabase row cap
  console.log('Loading players mappings (paged)...')

  const mlbamToPlayerId = new Map<number, number>()
  const bbrefToPlayerId = new Map<string, number>()

  const PAGE = 1000
  let offset = 0

  while (true) {
    const { data: batch, error } = await supabase
      .from('players')
      .select(`id, ${MLBAM_COL}, bbref_id`)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) throw error
    if (!batch || batch.length === 0) break

    for (const p of batch as any[]) {
      const mid = Math.trunc(Number(p[MLBAM_COL]))
      if (Number.isFinite(mid) && mid > 0) mlbamToPlayerId.set(mid, p.id)
      if (p.bbref_id) bbrefToPlayerId.set(String(p.bbref_id).trim(), p.id)
    }

    offset += PAGE
    if (batch.length < PAGE) break
  }

  console.log(`Players mapped by ${MLBAM_COL}:`, mlbamToPlayerId.size)
  console.log('Players mapped by bbref_id:', bbrefToPlayerId.size)

  type Row = { player_id: number; season: number; war: number; games_played: number | null }

  function readWarFile(filePath: string): Row[] {
    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
    const header = rows[0].map(h => h.trim())

    const mlbamIdx = header.indexOf('mlb_ID')
    const bbrefIdx = header.indexOf('player_ID')
    const yearIdx = header.indexOf('year_ID')
    const warIdx = header.indexOf('WAR')
    const gIdx = header.indexOf('G')

    if (yearIdx === -1 || warIdx === -1) {
      throw new Error(`Missing required columns in ${path.basename(filePath)}`)
    }
    if (mlbamIdx === -1 && bbrefIdx === -1) {
      throw new Error(`Need mlb_ID or player_ID in ${path.basename(filePath)}`)
    }

    const out: Row[] = []

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const year = toNum(r[yearIdx])
      const war = toNum(r[warIdx])
      const g = gIdx === -1 ? null : toNum(r[gIdx])

      if (year == null || war == null) continue

      let pid: number | undefined

      // Prefer MLBAM match
      if (mlbamIdx !== -1) {
        const mlbam = toNum(r[mlbamIdx])
        if (mlbam != null) pid = mlbamToPlayerId.get(Math.trunc(mlbam))
      }

      // Fallback: BBRef id match (optional)
      if (!pid && bbrefIdx !== -1) {
        const bbref = (r[bbrefIdx] ?? '').trim()
        if (bbref) pid = bbrefToPlayerId.get(bbref)
      }

      if (!pid) continue

      out.push({
        player_id: pid,
        season: Math.trunc(year),
        war,
        games_played: g == null ? null : Math.trunc(g),
      })
    }

    return out
  }

  console.log('Parsing WAR files...')
  const bat = readWarFile(batFile)
  const pit = readWarFile(pitFile)

  // Merge bat+pitch by player-season (sum WAR)
  const merged = new Map<string, Row>()
  for (const r of bat) merged.set(`${r.player_id}:${r.season}`, r)
  for (const r of pit) {
    const k = `${r.player_id}:${r.season}`
    const existing = merged.get(k)
    if (!existing) merged.set(k, r)
    else merged.set(k, { ...existing, war: existing.war + r.war })
  }

  const finalRows = Array.from(merged.values())
  console.log('Upserting rows into player_seasons:', finalRows.length)

  const chunkSize = 500
  for (let i = 0; i < finalRows.length; i += chunkSize) {
    const chunk = finalRows.slice(i, i + chunkSize).map(r => ({
      player_id: r.player_id,
      season: r.season,
      war: r.war,
      games_played: r.games_played,
      war_source: 'bbref',
      war_partial: false,
      war_updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('player_seasons')
      .upsert(chunk, { onConflict: 'player_id,season' })

    if (error) throw error
    console.log(`Upserted ${Math.min(i + chunkSize, finalRows.length)} / ${finalRows.length}`)
  }

  console.log('DONE seed-player-seasons-from-war')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
