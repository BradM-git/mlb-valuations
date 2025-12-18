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
// CORE AGE CURVE - Peak Performance > Youth, BUT Elite Players Age Better
// ============================================================================
function getAgeFactor(age: number | null, currentTPS?: number): number {
  if (!age) return 1.0
  
  // If player is currently elite (TPS 45+), soften age penalties
  const isCurrentlyElite = currentTPS && currentTPS >= 45.0
  
  // Young prospects - valuable but not more than proven stars
  if (age <= 23) return 1.04  // High upside (reduced from 1.05)
  if (age <= 25) return 1.06  // Entering prime (reduced from 1.08)
  
  // THE PEAK - Proven elite players in their prime are MOST valuable
  if (age <= 29) return 1.12  // Prime window - peak value
  if (age === 30) return 1.10  // Still in prime
  
  // Decline phase - but elite performers decline slower
  if (age === 31) return isCurrentlyElite ? 1.02 : 1.00  // Elite players at 31 still very valuable
  if (age === 32) return 0.92  // Early decline
  if (age === 33) return isCurrentlyElite ? 0.88 : 0.80  // Elite players maintain value longer
  if (age === 34) return isCurrentlyElite ? 0.82 : 0.72  // Elite players decline slower
  if (age <= 36) return isCurrentlyElite ? 0.70 : 0.62
  return 0.45
}

// ============================================================================
// REDUCED POSITION MULTIPLIERS - Elite Talent > Position Scarcity
// ============================================================================
function getPositionFactor(position: string): number {
  const scarcity: { [key: string]: number } = {
    'SS': 1.00,   // Shortstop - NO premium (too many SS in top 10)
    'C': 1.00,    // Catcher - NO premium
    'CF': 1.00,   // Center field - NO premium
    '3B': 1.00,   // Third base
    '2B': 1.00,   // Second base
    '1B': 0.99,   // First base - slight penalty
    'LF': 0.99,   // Left field - slight penalty
    'RF': 0.99,   // Right field - slight penalty
    'SP': 1.01,   // Starting pitcher - minimal premium
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
  // This is the most unique skill in baseball - should dominate valuation
  if (player.position === 'TWP') {
    premium *= 1.27  // Unprecedented two-way value (increased from 1.25)
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
    premium *= 1.12  // Elite eye at the plate (increased from 1.10)
  } else if (plateDisciplineScore && plateDisciplineScore >= 75) {
    premium *= 1.06  // Very good plate discipline (increased from 1.05)
  }
  
  // ELITE POWER + CONSISTENCY (Judge, Stanton when healthy)
  if (powerScore && powerScore >= 90 && currentTPS >= 45.0) {
    premium *= 1.08  // Game-changing power (increased from 1.06)
  } else if (powerScore && powerScore >= 80 && currentTPS >= 40.0) {
    premium *= 1.04  // Very good power
  }
  
  // ELITE SPEED + BASERUNNING (De La Cruz, Acuña)
  if (speedScore && speedScore >= 85 && currentTPS >= 4.0) {
    premium *= 1.06  // Dynamic baserunning threat (increased from 1.04)
  }
  
  // SUSTAINED EXCELLENCE BONUS (3+ truly elite years, TPS >= 40)
  // NOTE: These bonuses should be SMALLER than raw performance differences
  if (yearsElite && yearsElite >= 3) {
    premium *= 1.06  // Proven track record (reduced from 1.10)
  }
  
  // SUPER ELITE BONUS (5+ elite years) - Generational talents
  if (yearsElite && yearsElite >= 5) {
    premium *= 1.05  // Additional bonus for true superstars (reduced from 1.08)
  }
  
  // ULTRA ELITE (7+ elite years) - Hall of Fame trajectory
  if (yearsElite && yearsElite >= 7) {
    premium *= 1.03  // Sustained greatness (reduced from 1.05)
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
    
    // Major breakout year (sudden spike without sustained elite performance)
    if (dropoff > 2.0 && yearsElite && yearsElite < 2) {
      return 0.78  // MORE skeptical of sudden spike
    }
    
    // Consistent elite performer (TPS consistently >= 40)
    if (consistencyScore && consistencyScore >= 80 && yearsElite && yearsElite >= 3) {
      return 1.15  // Proven excellence (increased from 1.12)
    }
    
    // Solid 3+ year starter (above average but not elite)
    if (threeYearAvgTPS >= 35.0) {
      return 1.04  // Established player (increased from 1.03)
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
  
  // Years elite (TPS >= 40 for truly elite seasons)
  const yearsElite = sorted.filter(s => s.tps >= 40.0).length
  
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
  
  // CRITICAL: Balance current performance with historical average
  // GMs value both recent performance AND sustained excellence
  if (historicalData && historicalData.threeYearAvgTPS && historicalData.seasons.length >= 3) {
    const currentTPS = playerTPS
    const historicalAvg = historicalData.threeYearAvgTPS
    
    // Calculate decline/improvement
    const tpsChange = currentTPS - historicalAvg
    const percentChange = (tpsChange / historicalAvg) * 100
    
    // If player is significantly declining (>10% drop from historical), penalize heavily
    if (percentChange < -10) {
      // Major decline: 80% current, 20% historical (recent form matters most)
      playerTPS = (currentTPS * 0.8) + (historicalAvg * 0.2)
    } else if (percentChange < -5) {
      // Moderate decline: 70% current, 30% historical
      playerTPS = (currentTPS * 0.7) + (historicalAvg * 0.3)
    } else if (percentChange < 5) {
      // Stable: 50/50 blend
      playerTPS = (currentTPS * 0.5) + (historicalAvg * 0.5)
    } else {
      // Improving: 60% current, 40% historical (reward current excellence)
      playerTPS = (currentTPS * 0.6) + (historicalAvg * 0.4)
    }
  } else if (historicalData && historicalData.seasons.length === 2) {
    // For 2-year players, use 60/40 blend
    const twoYearAvg = historicalData.seasons.slice(0, 2).reduce((sum, s) => sum + s.tps, 0) / 2
    playerTPS = (playerTPS * 0.6) + (twoYearAvg * 0.4)
  }
  
  // Calculate base value from TPS
  const performanceValue = playerTPS * WAR_VALUE
  
  // Get all multipliers
  const ageFactor = getAgeFactor(player.age, playerTPS)  // Pass current TPS for elite aging
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