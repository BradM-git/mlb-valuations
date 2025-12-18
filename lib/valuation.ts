interface Player {
  age: number | null
  position: string
  tps?: number
  yearsControl?: number
  salary?: number
}

interface SeasonStats {
  season: number
  tps: number
  war: number
  games_played: number
  batting_avg?: number
  walks?: number
  strikeouts?: number
  home_runs?: number
  stolen_bases?: number
  at_bats?: number
}

interface PlayerHistoricalData {
  seasons: SeasonStats[]
  currentTPS: number
  threeYearAvgTPS?: number
  careerPeakTPS?: number
  yearsElite?: number // Seasons with TPS > 4.0
  consistencyScore?: number
  plateDisciplineScore?: number
  speedScore?: number
  powerScore?: number
}

interface ValuationBreakdown {
  tradeValueIndex: number
  estimatedDollarValue: number
  breakdown: {
    performanceScore: number
    ageFactor: number
    positionFactor: number
    controlFactor: number
    eliteSkillPremium?: number
    consistencyBonus?: number
    trackRecordMultiplier?: number
  }
}

// Base value: $8M per TPS point (WAR standard)
const WAR_VALUE = 8_000_000

// ============================================================================
// CORE AGE CURVE - Ages 26-30 are THE PEAK
// ============================================================================
function getAgeFactor(age: number | null): number {
  if (!age) return 1.0
  
  // Young prospects with upside
  if (age <= 23) return 1.08  // Lottery ticket (Elly De La Cruz: 23) - increased from 1.06
  if (age <= 25) return 1.12  // Rising star entering prime (Bobby Witt Jr: 25) - increased from 1.09
  
  // THE PEAK - This is what GMs pay for in trades
  if (age <= 30) return 1.15  // Prime window (Soto: 27, Raleigh: 29) - increased from 1.12
  
  // Decline phase begins
  if (age === 31) return 0.98  // Just past peak (Ohtani: 31) - reduced from 1.00
  if (age === 32) return 0.88  // Early decline (Lindor: 32) - reduced from 0.92
  if (age <= 34) return 0.72  // Clear decline - reduced from 0.75
  if (age <= 36) return 0.55  // Late career - reduced from 0.60
  return 0.40 // Twilight - reduced from 0.45
}

// ============================================================================
// REDUCED POSITION MULTIPLIERS - Performance > Scarcity
// ============================================================================
function getPositionFactor(position: string): number {
  const scarcity: { [key: string]: number } = {
    'SS': 1.02,   // Shortstop (down from 1.03)
    'C': 1.00,    // Catcher (down from 1.02) - CRITICAL FIX
    'CF': 1.01,   // Center field (down from 1.02)
    '3B': 1.00,   // Third base (down from 1.01)
    '2B': 1.00,   // Second base
    '1B': 0.99,   // First base
    'LF': 0.99,   // Left field
    'RF': 0.99,   // Right field
    'SP': 1.02,   // Starting pitcher (down from 1.03)
    'RP': 0.85,   // Relief pitcher
    'DH': 0.90,   // Designated hitter
    'TWP': 1.0,   // Two-way player (base, before elite premium)
  }
  
  return scarcity[position] || 1.0
}

// ============================================================================
// ELITE SKILL PREMIUMS - Detect Generational Talents
// ============================================================================
function getEliteSkillPremium(
  player: Player, 
  historicalData?: PlayerHistoricalData
): number {
  let premium = 1.0
  
  // TWO-WAY PLAYER PREMIUM (Literally only Ohtani)
  if (player.position === 'TWP') {
    premium *= 1.18  // Unprecedented two-way value
  }
  
  if (!historicalData) return premium
  
  const { 
    plateDisciplineScore, 
    powerScore, 
    speedScore,
    yearsElite,
    currentTPS 
  } = historicalData
  
  // GENERATIONAL PLATE DISCIPLINE (Soto, Judge)
  // Elite BB% + low K% + high TPS = ages extremely well
  if (plateDisciplineScore && plateDisciplineScore >= 85) {
    premium *= 1.10  // Elite eye at the plate (increased from 1.08)
  } else if (plateDisciplineScore && plateDisciplineScore >= 75) {
    premium *= 1.05  // Very good plate discipline
  }
  
  // ELITE POWER + CONSISTENCY (Judge, Stanton when healthy)
  if (powerScore && powerScore >= 90 && currentTPS >= 4.5) {
    premium *= 1.06  // Game-changing power (increased from 1.05)
  }
  
  // ELITE SPEED + BASERUNNING (De La Cruz, Acuña)
  if (speedScore && speedScore >= 85 && currentTPS >= 4.0) {
    premium *= 1.06  // Dynamic baserunning threat (increased from 1.04)
  }
  
  // SUSTAINED EXCELLENCE BONUS (3+ elite years)
  if (yearsElite && yearsElite >= 3) {
    premium *= 1.08  // Proven track record (increased from 1.06)
  }
  
  // SUPER ELITE BONUS (5+ elite years) - Generational talents
  if (yearsElite && yearsElite >= 5) {
    premium *= 1.06  // Additional bonus for true superstars (increased from 1.04)
  }
  
  return premium
}

// ============================================================================
// TRACK RECORD MULTIPLIER - Prevent One-Year Wonders
// ============================================================================
function getTrackRecordMultiplier(historicalData?: PlayerHistoricalData): number {
  if (!historicalData || !historicalData.seasons || historicalData.seasons.length === 0) {
    return 0.75 // HEAVILY penalize players with no history (likely breakouts or flukes)
  }
  
  const { seasons, currentTPS, threeYearAvgTPS, yearsElite, consistencyScore } = historicalData
  
  // Rookie or 1-year player
  if (seasons.length === 1) {
    // High TPS rookie could be legit (like Witt Jr's debut)
    if (currentTPS >= 5.0) return 0.88
    return 0.75  // One year = high risk (reduced from 0.80)
  }
  
  // 2-year players
  if (seasons.length === 2) {
    if (yearsElite && yearsElite >= 2) return 0.92
    return 0.83  // Reduced from 0.88
  }
  
  // 3+ year track record
  if (threeYearAvgTPS && currentTPS) {
    const dropoff = currentTPS - threeYearAvgTPS
    
    // Major breakout year (Jarren Duran scenario)
    if (dropoff > 2.0 && yearsElite && yearsElite < 2) {
      return 0.78  // MORE skeptical of sudden spike (reduced from 0.85)
    }
    
    // Consistent elite performer
    if (consistencyScore && consistencyScore >= 80 && yearsElite && yearsElite >= 3) {
      return 1.12  // Proven excellence (increased from 1.08)
    }
    
    // Solid 3+ year starter
    if (threeYearAvgTPS >= 3.5) {
      return 1.03  // Established player (increased from 1.02)
    }
  }
  
  return 1.0 // Default for 3+ years
}

// ============================================================================
// CONSISTENCY BONUS - Reward Reliable Performance
// ============================================================================
function getConsistencyBonus(historicalData?: PlayerHistoricalData): number {
  if (!historicalData || !historicalData.consistencyScore) {
    return 1.0
  }
  
  const score = historicalData.consistencyScore
  
  if (score >= 90) return 1.05  // Extremely reliable (rare)
  if (score >= 80) return 1.03  // Very consistent
  if (score >= 70) return 1.01  // Above average consistency
  return 1.0
}

// ============================================================================
// TEAM CONTROL MULTIPLIER
// ============================================================================
function getControlFactor(yearsControl?: number): number {
  if (!yearsControl) return 1.0 // Assume average control
  
  if (yearsControl >= 4) return 1.5  // Extremely valuable
  if (yearsControl >= 2) return 1.2  // Good control
  if (yearsControl >= 1) return 1.0  // Rental
  return 0.8 // Free agent pending
}

// ============================================================================
// PERFORMANCE SCORE (0-100)
// ============================================================================
function getPerformanceScore(tps?: number): number {
  if (!tps) return 50
  const score = Math.min(Math.max(tps * 10, 0), 100)
  return Math.round(score)
}

// ============================================================================
// CALCULATE HISTORICAL METRICS FROM SEASONS DATA
// ============================================================================
export function calculateHistoricalMetrics(seasons: SeasonStats[]): PlayerHistoricalData {
  if (!seasons || seasons.length === 0) {
    return {
      seasons: [],
      currentTPS: 0
    }
  }
  
  // Sort by season descending (most recent first)
  const sorted = [...seasons].sort((a, b) => b.season - a.season)
  const currentTPS = sorted[0].tps
  
  // 3-year average TPS
  const recentThree = sorted.slice(0, 3)
  const threeYearAvgTPS = recentThree.reduce((sum, s) => sum + s.tps, 0) / recentThree.length
  
  // Career peak TPS
  const careerPeakTPS = Math.max(...sorted.map(s => s.tps))
  
  // Years elite (TPS > 4.0)
  const yearsElite = sorted.filter(s => s.tps >= 4.0).length
  
  // Consistency score (how stable is performance)
  const tpsValues = sorted.map(s => s.tps)
  const mean = tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length
  const variance = tpsValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / tpsValues.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = (stdDev / mean) * 100
  const consistencyScore = Math.max(0, Math.min(100, 100 - coefficientOfVariation))
  
  // Plate discipline score (if we have the data)
  let plateDisciplineScore: number | undefined
  const recentSeason = sorted[0]
  if (recentSeason.walks && recentSeason.strikeouts && recentSeason.at_bats) {
    const bbRate = (recentSeason.walks / recentSeason.at_bats) * 100
    const kRate = (recentSeason.strikeouts / recentSeason.at_bats) * 100
    
    // Elite plate discipline: High BB%, Low K%
    // Soto: ~18% BB, ~16% K = Elite
    // Judge: ~15% BB, ~24% K = Very Good
    const disciplineRating = (bbRate * 2) - (kRate * 0.5) + 50
    plateDisciplineScore = Math.max(0, Math.min(100, disciplineRating))
  }
  
  // Speed score (stolen bases + games played)
  let speedScore: number | undefined
  if (recentSeason.stolen_bases && recentSeason.games_played) {
    const sbPer100 = (recentSeason.stolen_bases / recentSeason.games_played) * 100
    speedScore = Math.min(100, sbPer100 * 3) // Normalize to 0-100
  }
  
  // Power score (home runs + games played)
  let powerScore: number | undefined
  if (recentSeason.home_runs && recentSeason.games_played) {
    const hrPer100 = (recentSeason.home_runs / recentSeason.games_played) * 100
    powerScore = Math.min(100, hrPer100 * 2) // Normalize to 0-100
  }
  
  return {
    seasons: sorted,
    currentTPS,
    threeYearAvgTPS,
    careerPeakTPS,
    yearsElite,
    consistencyScore,
    plateDisciplineScore,
    speedScore,
    powerScore
  }
}

// ============================================================================
// MAIN VALUATION FUNCTION - GM-REALISTIC MODEL
// ============================================================================
export function calculateTradeValue(
  player: Player, 
  tps?: number,
  historicalData?: PlayerHistoricalData
): ValuationBreakdown {
  // Use provided TPS, or player's TPS, or default to 2.0
  let playerTPS = tps ?? player.tps ?? 2.0
  
  // CRITICAL: Use historical average as PRIMARY metric to prevent recency bias
  // GMs care about sustained performance, not one-year spikes
  if (historicalData && historicalData.threeYearAvgTPS && historicalData.seasons.length >= 3) {
    // Use 3-year average as primary, with only 20% weight on current season
    // This heavily penalizes breakouts and rewards consistency
    playerTPS = (playerTPS * 0.2) + (historicalData.threeYearAvgTPS * 0.8)
  } else if (historicalData && historicalData.seasons.length === 2) {
    // For 2-year players, use 50/50 blend
    const twoYearAvg = historicalData.seasons.slice(0, 2).reduce((sum, s) => sum + s.tps, 0) / 2
    playerTPS = (playerTPS * 0.5) + (twoYearAvg * 0.5)
  }
  
  // Calculate base value from TPS
  const performanceValue = playerTPS * WAR_VALUE
  
  // Get all multipliers
  const ageFactor = getAgeFactor(player.age)
  const positionFactor = getPositionFactor(player.position)
  const controlFactor = getControlFactor(player.yearsControl)
  const eliteSkillPremium = getEliteSkillPremium(player, historicalData)
  const trackRecordMultiplier = getTrackRecordMultiplier(historicalData)
  const consistencyBonus = getConsistencyBonus(historicalData)
  
  // COMPREHENSIVE CALCULATION
  const estimatedDollarValue = Math.round(
    performanceValue * 
    ageFactor * 
    positionFactor * 
    controlFactor * 
    eliteSkillPremium * 
    trackRecordMultiplier * 
    consistencyBonus
  )
  
  // Calculate 0-100 Trade Value Index (for secondary display)
  let tradeValueIndex = Math.round((estimatedDollarValue / 60_000_000) * 100)
  tradeValueIndex = Math.min(tradeValueIndex, 100)
  
  // Get performance score (use the blended TPS)
  const performanceScore = getPerformanceScore(playerTPS)
  
  return {
    tradeValueIndex,
    estimatedDollarValue,
    breakdown: {
      performanceScore,
      ageFactor: Math.round(ageFactor * 100),
      positionFactor: Math.round(positionFactor * 100),
      controlFactor: Math.round(controlFactor * 100),
      eliteSkillPremium: Math.round(eliteSkillPremium * 100),
      consistencyBonus: Math.round(consistencyBonus * 100),
      trackRecordMultiplier: Math.round(trackRecordMultiplier * 100)
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
export function formatDollarValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  return `$${(value / 1_000).toFixed(0)}K`
}

export function getRatingLabel(index: number): string {
  if (index >= 90) return 'Elite'
  if (index >= 80) return 'Star'
  if (index >= 70) return 'Above Average'
  if (index >= 60) return 'Solid Starter'
  if (index >= 50) return 'Average'
  if (index >= 40) return 'Below Average'
  return 'Backup'
}

export function getRatingColor(index: number): string {
  if (index >= 90) return 'text-purple-600'
  if (index >= 80) return 'text-blue-600'
  if (index >= 70) return 'text-green-600'
  if (index >= 60) return 'text-yellow-600'
  if (index >= 50) return 'text-orange-600'
  return 'text-gray-600'
}