// lib/valuation.ts
// WAR-first valuation. WAR = production. TPS = small modifier.
// Backwards-compatible: exposes BOTH fanValueIndex and tradeValueIndex.

export interface Player {
  age: number | null
  position: string
  tps?: number
  games_played?: number | null
}

export interface SeasonStats {
  season: number
  tps: number
  games_played: number
  war?: number | null
}

export interface PlayerHistoricalData {
  seasons: SeasonStats[]
  currentTPS: number
  threeYearAvgTPS?: number
  careerPeakTPS?: number
  yearsElite?: number
  consistencyScore?: number

  currentWAR?: number
  threeYearAvgWAR?: number
  careerPeakWAR?: number
}

export interface TradeValueBreakdown {
  // 👇 alias so existing pages don’t break
  fanValueIndex: number

  tradeValueIndex: number
  estimatedDollarValue: number
  breakdown: {
    warUsed: number
    tpsUsed: number
    tpsModifier: number
    age: number
    positionFactor: number
    playingTimeFactor: number
    horizonYears: number
    pv: number
  }
}

/* -----------------------
   Constants
------------------------ */

const DOLLARS_PER_WAR_FAN = 11_000_000
const DISCOUNT_RATE = 0.06

/* -----------------------
   Helpers
------------------------ */

function pv(amount: number, year: number): number {
  return amount / Math.pow(1 + DISCOUNT_RATE, year)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function safeNumber(n: any, fallback = 0): number {
  const x = Number(n)
  return Number.isFinite(x) ? x : fallback
}

function isPitcher(pos: string): boolean {
  return ['SP', 'RP', 'P'].includes((pos || '').toUpperCase())
}

function getPositionFactor(position: string): number {
  const p = (position || '').toUpperCase()
  return {
    SS: 1.06,
    C: 1.05,
    CF: 1.04,
    '2B': 1.02,
    '3B': 1.02,
    RF: 1.01,
    LF: 1.0,
    '1B': 0.98,
    DH: 0.95,
    SP: 1.0,
    RP: 0.88,
    P: 1.0,
    TWP: 1.1,
  }[p] ?? 1.0
}

function playingTimeFactor(g?: number | null): number {
  const gp = safeNumber(g, 0)
  if (gp <= 0) return 0.92
  return 0.85 + 0.15 * clamp(gp / 162, 0.35, 1)
}

function fanHorizonYears(age: number, position: string): number {
  const pitcher = isPitcher(position)
  const base = pitcher ? 4 : 6
  const adj = clamp(31 - age, -3, 6)
  return clamp(base + Math.floor(adj / 2), pitcher ? 3 : 4, pitcher ? 6 : 8)
}

/* -----------------------
   Historical Metrics
------------------------ */

export function calculateHistoricalMetrics(seasons: SeasonStats[]): PlayerHistoricalData {
  if (!seasons.length) return { seasons: [], currentTPS: 0 }

  const s = [...seasons].sort((a, b) => b.season - a.season)

  const currentTPS = safeNumber(s[0].tps)
  const recent = s.slice(0, 3)

  const threeYearAvgTPS =
    recent.reduce((sum, x) => sum + safeNumber(x.tps), 0) / recent.length

  const tpsVals = s.map(x => safeNumber(x.tps))
  const mean = tpsVals.reduce((a, b) => a + b, 0) / tpsVals.length
  const variance =
    tpsVals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / tpsVals.length
  const consistencyScore = clamp(100 - Math.sqrt(variance), 0, 100)

  const warVals = s.map(x => x.war).filter(x => x != null) as number[]

  return {
    seasons: s,
    currentTPS,
    threeYearAvgTPS,
    careerPeakTPS: Math.max(...tpsVals),
    yearsElite: tpsVals.filter(x => x >= 40).length,
    consistencyScore,

    currentWAR: s[0].war ?? undefined,
    threeYearAvgWAR:
      warVals.length >= 3
        ? warVals.slice(0, 3).reduce((a, b) => a + b, 0) / 3
        : undefined,
    careerPeakWAR: warVals.length ? Math.max(...warVals) : undefined,
  }
}

/* -----------------------
   Core valuation logic
------------------------ */

function blendedWAR(h?: PlayerHistoricalData): number {
  if (!h?.seasons?.length) return 0

  const s = h.seasons
  const w1 = s[0]?.war ?? null
  const w2 = s[1]?.war ?? null
  const w3 = s[2]?.war ?? null

  if (w1 != null && w2 != null && w3 != null) return w1 * 0.5 + w2 * 0.3 + w3 * 0.2
  if (w1 != null && w2 != null) return w1 * 0.625 + w2 * 0.375
  return w1 ?? 0
}

function blendedTPS(tps: number, h?: PlayerHistoricalData): number {
  if (!h?.seasons?.length) return tps
  return tps * 0.65 + safeNumber(h.threeYearAvgTPS, tps) * 0.35
}

function tpsModifier(tps: number): number {
  return clamp(1 + ((tps - 25) / 25) * 0.06, 0.92, 1.08)
}

function computeIndex(
  war: number,
  tps: number,
  age: number,
  pos: number,
  pt: number
): number {
  const warScore = clamp((war / 8) * 100, 0, 100)
  const ageAdj =
    age <= 23 ? 6 :
    age <= 26 ? 4 :
    age <= 29 ? 2 :
    age <= 31 ? 0 :
    age <= 33 ? -3 :
    age <= 35 ? -6 : -10

  return Math.round(
    clamp(
      warScore +
        ageAdj +
        (pos - 1) * 50 +
        (pt - 0.92) * 60 +
        (tpsModifier(tps) - 1) * 60,
      0,
      100
    )
  )
}

function estimatePV(
  player: Player,
  war: number,
  tps: number,
  h?: PlayerHistoricalData
) {
  const age = safeNumber(player.age, 27)
  const horizon = fanHorizonYears(age, player.position)
  const pos = getPositionFactor(player.position)
  const pt = playingTimeFactor(player.games_played)
  const tpsMod = tpsModifier(tps)

  let total = 0
  for (let y = 1; y <= horizon; y++) {
    total += pv(war * DOLLARS_PER_WAR_FAN * pos * pt * tpsMod, y)
  }

  if (h?.consistencyScore)
    total *= clamp(h.consistencyScore / 100, 0.9, 1.05)

  return { total, pos, pt, horizon, age, tpsMod }
}

/* -----------------------
   PUBLIC API
------------------------ */

export function calculateTradeValue(
  player: any,
  _legacy?: any,
  historical?: PlayerHistoricalData
): TradeValueBreakdown {
  const p: Player = {
    age: player.age,
    position: player.position,
    tps: player.tps,
    games_played: player.games_played ?? player.gamesPlayed,
  }

  const h = historical
  const warUsed = blendedWAR(h)
  const tpsUsed = blendedTPS(safeNumber(p.tps), h)

  const { total, pos, pt, horizon, age, tpsMod } = estimatePV(
    p,
    warUsed,
    tpsUsed,
    h
  )

  const tradeValueIndex = computeIndex(warUsed, tpsUsed, age, pos, pt)

  return {
    fanValueIndex: tradeValueIndex, // alias
    tradeValueIndex,
    estimatedDollarValue: Math.round(total),
    breakdown: {
      warUsed: Number(warUsed.toFixed(2)),
      tpsUsed: Number(tpsUsed.toFixed(2)),
      tpsModifier: Number(tpsMod.toFixed(3)),
      age,
      positionFactor: Math.round(pos * 100),
      playingTimeFactor: Math.round(pt * 100),
      horizonYears: horizon,
      pv: Math.round(total),
    },
  }
}

export function getPlayerValuation(player: any, seasons: any[]) {
  const mapped = seasons.map(s => ({
    season: s.season,
    tps: safeNumber(s.tps),
    games_played: safeNumber(s.games_played),
    war: s.war,
  }))

  const historical = mapped.length ? calculateHistoricalMetrics(mapped) : undefined
  return { valuation: calculateTradeValue(player, null, historical), historicalData: historical }
}

/* -----------------------
   Display helpers
------------------------ */

export function formatDollarValue(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

export function getRatingLabel(index: number): string {
  if (index >= 90) return 'MVP'
  if (index >= 80) return 'All-Star'
  if (index >= 70) return 'Great'
  if (index >= 60) return 'Very Good'
  if (index >= 50) return 'Good'
  if (index >= 40) return 'Average'
  return 'Role Player'
}

export function getRatingColor(index: number): string {
  if (index >= 90) return 'text-purple-600'
  if (index >= 80) return 'text-blue-600'
  if (index >= 70) return 'text-green-600'
  if (index >= 60) return 'text-yellow-600'
  if (index >= 50) return 'text-orange-600'
  return 'text-gray-600'
}
