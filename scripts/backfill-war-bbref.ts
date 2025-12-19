import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'

console.log('START backfill-war-bbref (UPDATE mode)')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// -------- CONFIG --------
const ZIP_PATH = path.join(process.cwd(), 'data', 'bbref', 'war_archive.zip')
const EXTRACT_DIR = path.join(process.cwd(), 'data', 'bbref', 'war_archive')
const START_SEASON = 2015
const END_SEASON = 2025
// ------------------------

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

function toNum(v?: string): number | null {
  const s = (v ?? '').trim()
  if (!s || s === 'NULL') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function main() {
  // unzip archive (idempotent)
  if (!fs.existsSync(EXTRACT_DIR)) {
    fs.mkdirSync(EXTRACT_DIR, { recursive: true })
    execSync(`unzip -q "${ZIP_PATH}" -d "${EXTRACT_DIR}"`)
  }

  const batFile = path.join(EXTRACT_DIR, 'war_daily_bat.txt')
  const pitFile = path.join(EXTRACT_DIR, 'war_daily_pitch.txt')
  if (!fs.existsSync(batFile) || !fs.existsSync(pitFile)) {
    throw new Error('Expected war_daily_bat.txt and war_daily_pitch.txt in extracted archive')
  }

  // Load players by bbref_id
  const { data: players, error } = await supabase
    .from('players')
    .select('id, bbref_id')
    .not('bbref_id', 'is', null)

  if (error) throw error
  if (!players?.length) throw new Error('No players with bbref_id found')

  const bbrefToPlayerId = new Map<string, number>()
  for (const p of players as any[]) bbrefToPlayerId.set(p.bbref_id, p.id)
  console.log('Players with bbref_id:', bbrefToPlayerId.size)

  type UpdateRow = { player_id: number; season: number; war: number }

  function buildUpdates(filePath: string): UpdateRow[] {
    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
    const header = rows[0].map(h => h.trim())

    const idIdx = header.indexOf('player_ID')
    const yearIdx = header.indexOf('year_ID')
    const warIdx = header.indexOf('WAR')
    if (idIdx === -1 || yearIdx === -1 || warIdx === -1) {
      throw new Error(`Missing columns in ${path.basename(filePath)} (need player_ID, year_ID, WAR)`)
    }

    const out: UpdateRow[] = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const bbrefId = (r[idIdx] ?? '').trim()
      const year = toNum(r[yearIdx])
      const war = toNum(r[warIdx])

      if (!bbrefId || year === null || war === null) continue
      if (year < START_SEASON || year > END_SEASON) continue

      const playerId = bbrefToPlayerId.get(bbrefId)
      if (!playerId) continue

      out.push({ player_id: playerId, season: Math.trunc(year), war })
    }
    return out
  }

  const batUpdates = buildUpdates(batFile)
  const pitUpdates = buildUpdates(pitFile)

  console.log('Prepared bat WAR rows:', batUpdates.length)
  console.log('Prepared pitch WAR rows:', pitUpdates.length)

  // Merge: if both bat + pitch exist for same player-season, add them (two-way)
  const merged = new Map<string, number>()
  for (const u of batUpdates) merged.set(`${u.player_id}:${u.season}`, u.war)
  for (const u of pitUpdates) {
    const k = `${u.player_id}:${u.season}`
    merged.set(k, (merged.get(k) ?? 0) + u.war)
  }

  const mergedRows: UpdateRow[] = Array.from(merged.entries()).map(([k, war]) => {
    const [player_id, season] = k.split(':').map(Number)
    return { player_id, season, war }
  })

  console.log('Merged WAR rows (final):', mergedRows.length)

  const now = new Date().toISOString()
  const chunkSize = 200

  for (let i = 0; i < mergedRows.length; i += chunkSize) {
    const chunk = mergedRows.slice(i, i + chunkSize)

    const results = await Promise.all(
      chunk.map(r =>
        supabase
          .from('player_seasons')
          .update({
            war: r.war,
            war_source: 'bbref',
            war_partial: false,
            war_updated_at: now,
          })
          .eq('player_id', r.player_id)
          .eq('season', r.season)
      )
    )

    const firstErr = results.find(x => x.error)?.error
    if (firstErr) throw firstErr

    console.log(`Updated ${Math.min(i + chunkSize, mergedRows.length)} / ${mergedRows.length}`)
  }

  console.log('DONE backfill-war-bbref')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
