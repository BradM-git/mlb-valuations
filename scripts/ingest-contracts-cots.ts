import dotenv from 'dotenv'
dotenv.config({ path: '.env.local', override: true })

import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

type DbPlayer = { mlb_id: number; name: string; team: string | null }

type InsertRow = {
  mlb_id: number
  source: string
  effective_date: string
  years_control: number | null
  aav: number | null
  contract_total: number | null
  contract_total_remaining: number | null
  contract_start_year: number | null
  contract_end_year: number | null
  team: string | null
  notes: string | null
}

const COTS_ROOT = 'https://legacy.baseballprospectus.com/compensation/cots/'
const SOURCE = 'cots'
const EFFECTIVE_DATE = new Date().toISOString().slice(0, 10)

function getCurrentSeasonYear(): number {
  const d = new Date()
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  return month >= 10 ? year + 1 : year
}

/**
 * Normalization:
 * - remove diacritics
 * - lowercase
 * - remove punctuation
 * - collapse whitespace
 */
function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'".,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Some sources include suffix punctuation differences:
 *  "Jr." vs "Jr"
 *  "III" etc
 *
 * We normalize suffix tokens by removing dots and ensuring spacing.
 */
function normalizeNameForKey(raw: string): string {
  let s = raw.trim()

  // Standardize suffixes (remove periods)
  s = s.replace(/\bJr\.\b/g, 'Jr').replace(/\bSr\.\b/g, 'Sr')

  // Remove stray punctuation and normalize
  s = normalize(s)

  // Ensure suffixes are kept as tokens (already)
  return s
}

/**
 * Strips trailing position tokens:
 *  - "Pete Alonso 1b" -> "Pete Alonso"
 *  - "Jazz Chisholm Jr. of-2b" -> "Jazz Chisholm Jr."
 *  - "Ceddanne Rafaela 3b-of" -> "Ceddanne Rafaela"
 */
function stripTrailingPosition(raw: string): string {
  const s = raw.trim()
  const parts = s.split(/\s+/)
  if (parts.length < 2) return s

  const last = parts[parts.length - 1].toLowerCase()

  // Matches: 1b, 2b, 3b, ss, cf, rf, lf, dh, c, sp, rp, of
  // And combos: 2b-3b, of-2b, 2b-ss, 1b-c, etc.
  const positionToken = /^[0-9]?[a-z]{1,3}(-[0-9]?[a-z]{1,3})*$/

  if (positionToken.test(last)) {
    return parts.slice(0, -1).join(' ')
  }
  return s
}

function looksLikePlayerName(s: string): boolean {
  const t = s.trim()
  if (t.length < 5) return false
  if (/\$/.test(t)) return false
  if (/\d{1,2}\/\d{1,2}\/\d{2}/.test(t)) return false
  if (t.includes('Search') || t.includes('Primary Menu') || t.includes('Skip to content')) return false
  if (t.split(/\s+/).length < 2) return false

  const low = t.toLowerCase()

  // Headings / nav / boilerplate
  const badStarts = [
    "cot's",
    'cots',
    'service time',
    'award bonuses',
    'league info',
    'al east',
    'al west',
    'al central',
    'nl east',
    'nl west',
    'nl central',
    'the pay',
    'baseball prospectus',
    'bp compensation',
    'cot’s contracts',
  ]
  if (badStarts.some((b) => low.startsWith(b))) return false

  // Staff/title lines
  if (/(owner|manager|general manager|chief baseball officer)/i.test(t)) return false

  // Transactions / clause / note lines (anywhere)
  if (
    /(full no-trade|no-trade|limited no-trade|perks:|bonus|assignment bonus|award bonuses|service time|opt out|declined|renewed by|signed by|selected by|at signing|as part of the deal|acquired|traded|re-signed|outrighted|designated for assignment|released)/i.test(
      t
    )
  ) {
    return false
  }

  // "may" + certain verbs is usually a clause/note
  if (/\bmay\b/i.test(t) && /\b(opt|terminate|decline|void|exercise)\b/i.test(t)) return false

  return true
}

function parseMoneyToDollars(raw: string): number | null {
  const s = raw.replace(/\s+/g, '').replace(/^\$/, '')
  if (!s) return null

  const mult = s.endsWith('B') ? 1_000_000_000 : s.endsWith('M') ? 1_000_000 : 1
  const cleaned = s.replace(/[BM]$/, '').replace(/,/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * mult)
}

function parseContractLine(line: string): { years: number; total: number; startYear: number; endYear: number } | null {
  const m = line.match(/(\d+)\s+years?\/\$(.+?)\s*\((\d{4})(?:-(\d{2,4}))?\)/i)
  if (!m) return null

  const years = Number(m[1])
  const total = parseMoneyToDollars(`$${m[2]}`)
  if (!total || !Number.isFinite(years) || years <= 0) return null

  const startYear = Number(m[3])

  let endYear: number
  if (m[4]) {
    const endRaw = m[4]
    if (endRaw.length === 2) endYear = Number(String(startYear).slice(0, 2) + endRaw)
    else endYear = Number(endRaw)
  } else {
    endYear = startYear
  }

  return { years, total, startYear, endYear }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': "mlb-valuations/1.0 (contract ingestion; credit: Cot's Baseball Contracts)",
      Accept: 'text/html,*/*',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`)
  return await res.text()
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function isTeamPageUrl(u: string): boolean {
  // Must be exactly: /compensation/cots/<category>/<slug>/
  if (!/\/compensation\/cots\/[^\/]+\/[^\/]+\/$/i.test(u)) return false

  const lower = u.toLowerCase()

  // Exclude non-team pages
  if (lower.includes('/compensation/cots/league-info/')) return false

  // Kill known dead/duplicate page
  if (lower.endsWith('/oakland-athletics/')) return false

  // Allow known team buckets
  const allowedPrefixes = [
    '/compensation/cots/al-',
    '/compensation/cots/nl-',
    '/compensation/cots/american-league/',
    '/compensation/cots/national-league/',
    '/compensation/cots/american-league-central/',
    '/compensation/cots/american-league-east/',
    '/compensation/cots/american-league-west/',
    '/compensation/cots/national-league-central/',
    '/compensation/cots/national-league-east/',
    '/compensation/cots/national-league-west/',
  ]

  return allowedPrefixes.some((p) => lower.includes(p))
}

function extractTeamName($: cheerio.CheerioAPI): string | null {
  const title = $('title').text().trim()
  if (title) {
    const parts = title.split('|').map((p) => p.trim())
    if (parts.length) return parts[0]
  }
  const h1 = $('h1').first().text().trim()
  if (h1 && !h1.toLowerCase().includes('cot')) return h1
  return null
}

function getMainContentText($: cheerio.CheerioAPI): string {
  const main = $('main').text()
  if (main && main.trim().length > 500) return main

  const article = $('article').text()
  if (article && article.trim().length > 500) return article

  return $('body').text()
}

/**
 * If direct match fails, try a "suffixless" key:
 * "Vladimir Guerrero Jr" -> "Vladimir Guerrero"
 * This is safe-ish because we STILL require MLB DB uniqueness to pick a single match.
 */
function removeSuffixForFallbackKey(name: string): string {
  return name.replace(/\b(jr|sr|ii|iii|iv|v)\b$/i, '').trim()
}

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing env vars in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Load DB players for matching by name
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('mlb_id,name,team')
    .not('mlb_id', 'is', null)

  if (pErr || !players) throw new Error(`Failed to load players: ${pErr?.message}`)

  const dbPlayers: DbPlayer[] = players.map((p: any) => ({
    mlb_id: Number(p.mlb_id),
    name: String(p.name),
    team: p.team ? String(p.team) : null,
  }))

  // Primary name index
  const byName = new Map<string, DbPlayer[]>()
  // Secondary: suffixless fallback index
  const byNameNoSuffix = new Map<string, DbPlayer[]>()

  for (const p of dbPlayers) {
    const k = normalizeNameForKey(p.name)
    byName.set(k, [...(byName.get(k) ?? []), p])

    const ns = normalizeNameForKey(removeSuffixForFallbackKey(p.name))
    if (ns && ns !== k) byNameNoSuffix.set(ns, [...(byNameNoSuffix.get(ns) ?? []), p])
  }

  // Collect team URLs from Cot's home page navigation
  const homeHtml = await fetchHtml(COTS_ROOT)
  const $home = cheerio.load(homeHtml)

  const teamUrls = new Set<string>()
  $home('a').each((_, a) => {
    const href = $home(a).attr('href')
    if (!href) return
    const abs = href.startsWith('http') ? href : new URL(href, COTS_ROOT).toString()
    if (!abs.includes('/compensation/cots/')) return
    if (abs === COTS_ROOT) return
    if (isTeamPageUrl(abs)) teamUrls.add(abs)
  })

  const urls = Array.from(teamUrls).sort()
  console.log(`Found ${urls.length} team pages.`)

  const seasonYear = getCurrentSeasonYear()
  console.log(`Using current season year: ${seasonYear}`)
  console.log(`Effective date: ${EFFECTIVE_DATE}`)

  const inserts: InsertRow[] = []
  const unmatched: Array<{ scraped_name: string; team: string; contract: string; reason: string }> = []
  const ambiguous: Array<{ scraped_name: string; team: string; matches: string[] }> = []
  const fetchFailures: string[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    console.log(`[${i + 1}/${urls.length}] ${url}`)

    let html: string
    try {
      html = await fetchHtml(url)
    } catch (e: any) {
      console.error(`Fetch error (continuing): ${e?.message ?? e}`)
      fetchFailures.push(url)
      continue
    }

    const $ = cheerio.load(html)
    const teamName = extractTeamName($) ?? 'Unknown Team'
    const teamNorm = normalize(teamName)

    const contentText = getMainContentText($)

    const lines = contentText
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('*'))
      .filter((l) => l.length < 140)

    for (let li = 0; li < lines.length - 1; li++) {
      const maybeNameRaw = lines[li]
      const maybeContractRaw = lines[li + 1]

      if (!looksLikePlayerName(maybeNameRaw)) continue

      const parsed = parseContractLine(maybeContractRaw)
      if (!parsed) continue

      const candidateName = stripTrailingPosition(maybeNameRaw)
      if (!looksLikePlayerName(candidateName)) continue

      const key = normalizeNameForKey(candidateName)

      let matches = byName.get(key) ?? []
      let usedFallback = false

      // If no match, try suffixless fallback
      if (matches.length === 0) {
        const key2 = normalizeNameForKey(removeSuffixForFallbackKey(candidateName))
        matches = byNameNoSuffix.get(key2) ?? []
        usedFallback = matches.length > 0
      }

      let chosen: DbPlayer | null = null

      if (matches.length === 1) {
        chosen = matches[0]
      } else if (matches.length === 0) {
        unmatched.push({
          scraped_name: candidateName,
          team: teamName,
          contract: maybeContractRaw,
          reason: usedFallback ? 'no_match_even_after_suffix_fallback' : 'no_match',
        })
        continue
      } else {
        // Disambiguate by team where possible
        const teamMatches = matches.filter((m) => m.team && normalize(m.team) === teamNorm)
        if (teamMatches.length === 1) {
          chosen = teamMatches[0]
        } else {
          ambiguous.push({
            scraped_name: candidateName,
            team: teamName,
            matches: matches.map((m) => `${m.name} (${m.team ?? 'no-team'}; mlb_id=${m.mlb_id})`),
          })
          continue
        }
      }

      const { years, total, startYear, endYear } = parsed
      const aav = Math.round(total / years)
      const yearsControl = endYear >= seasonYear ? endYear - seasonYear + 1 : 0
      if (yearsControl <= 0) continue

      inserts.push({
        mlb_id: chosen.mlb_id,
        source: SOURCE,
        effective_date: EFFECTIVE_DATE,
        years_control: yearsControl,
        aav,
        contract_total: total,
        contract_total_remaining: null,
        contract_start_year: startYear,
        contract_end_year: endYear,
        team: teamName,
        notes: null,
      })
    }

    await sleep(600)
  }

  console.log(`Matched contracts: ${inserts.length}`)
  console.log(`Unmatched: ${unmatched.length}`)
  console.log(`Ambiguous: ${ambiguous.length}`)
  console.log(`Fetch failures: ${fetchFailures.length}`)

  for (const [idx, c] of chunk(inserts, 500).entries()) {
    const { error } = await supabase.from('player_contracts').insert(c)
    if (error) throw new Error(`Insert chunk ${idx} failed: ${error.message}`)
    console.log(`Inserted chunk ${idx + 1}/${Math.ceil(inserts.length / 500)}`)
  }

  if (unmatched.length) {
    console.log('UNMATCHED sample:', unmatched.slice(0, 30))
    const reasons = unmatched.reduce<Record<string, number>>((acc, r) => {
      acc[r.reason] = (acc[r.reason] ?? 0) + 1
      return acc
    }, {})
    console.log('UNMATCHED reason counts:', reasons)
  }
  if (ambiguous.length) console.log('AMBIGUOUS sample:', ambiguous.slice(0, 20))

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
