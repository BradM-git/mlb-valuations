import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

console.log('START sync-player-id-map')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Robust enough CSV parser for Chadwick (quotes + commas)
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

function toInt(v: string | undefined): number | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function toText(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

async function main() {
  const dir = path.join(process.cwd(), 'data', 'chadwick')
  const files = fs.readdirSync(dir).filter(f => /^people-[0-9a-f]\.csv$/.test(f)).sort()
  console.log('Found Chadwick files:', files.length)
  if (files.length !== 16) throw new Error(`Expected 16 people-*.csv, found ${files.length}`)

  const combined = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  console.log('Parsing Chadwick CSV...')
  const rows = parseCsv(combined)
  if (rows.length < 2) throw new Error('No rows parsed from Chadwick CSV')

  const header = rows[0]
  const mlbamIdx = header.indexOf('key_mlbam')
  const fgIdx = header.indexOf('key_fangraphs')
  const bbrefIdx = header.indexOf('key_bbref')
  if (mlbamIdx === -1 || fgIdx === -1 || bbrefIdx === -1) throw new Error('Missing required Chadwick columns')

  const idMap = new Map<number, { fg: number | null; bbref: string | null }>()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const mlbam = toInt(r[mlbamIdx])
    if (!mlbam) continue
    const fg = toInt(r[fgIdx])
    const bbref = toText(r[bbrefIdx])
    if (fg || bbref) idMap.set(mlbam, { fg, bbref })
  }
  console.log('Mapped MLBAM IDs:', idMap.size)

  console.log('Fetching players...')
  const { data: players, error } = await supabase
    .from('players')
    .select('id, mlb_id')
    .not('mlb_id', 'is', null)
    .not('name', 'is', null)

  if (error) throw error
  if (!players?.length) throw new Error('No players returned')

  const now = new Date().toISOString()

  const updates = (players as Array<{ id: number; mlb_id: number }>).flatMap(p => {
    const m = idMap.get(p.mlb_id)
    if (!m) return []
    return [{
      id: p.id,
      fangraphs_id: m.fg,
      bbref_id: m.bbref,
      id_map_source: 'chadwick',
      id_map_updated_at: now,
    }]
  })

  console.log('Prepared updates:', updates.length)

  const chunkSize = 200
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const results = await Promise.all(
      chunk.map(u =>
        supabase.from('players')
          .update({
            fangraphs_id: u.fangraphs_id,
            bbref_id: u.bbref_id,
            id_map_source: u.id_map_source,
            id_map_updated_at: u.id_map_updated_at,
          })
          .eq('id', u.id)
      )
    )
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) throw firstErr
    console.log(`Updated ${Math.min(i + chunkSize, updates.length)} / ${updates.length}`)
  }

  console.log('DONE')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
