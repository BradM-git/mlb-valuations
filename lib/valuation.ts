interface Player {
  age: number | null
  position: string
  tps?: number
  yearsControl?: number
  salary?: number
}

interface ValuationBreakdown {
  tradeValueIndex: number
  estimatedDollarValue: number
  breakdown: {
    performanceScore: number
    ageFactor: number
    positionFactor: number
    controlFactor: number
  }
}

// Base value: $8M per TPS point (similar to WAR standard)
const WAR_VALUE = 8_000_000

// Age multipliers - peak performance weighted more heavily
function getAgeFactor(age: number | null): number {
  if (!age) return 1.0
  
  if (age < 24) return 1.08  // Elite young talent (reduced from 1.15)
  if (age <= 26) return 1.05 // Young star entering prime (reduced from 1.10)
  if (age <= 29) return 1.03 // Prime years (reduced from 1.05)
  if (age <= 32) return 1.0  // Peak/late prime - no penalty
  if (age <= 34) return 0.85 // Starting decline
  if (age <= 36) return 0.70 // Clear decline
  return 0.5 // Late career
}

// Position scarcity multipliers - reduced to let performance shine
function getPositionFactor(position: string): number {
  const scarcity: { [key: string]: number } = {
    'SS': 1.05,   // Shortstop (reduced from 1.10)
    'C': 1.05,    // Catcher
    'CF': 1.03,   // Center field
    '3B': 1.02,   // Third base
    '2B': 1.0,    // Second base
    '1B': 0.98,   // First base
    'LF': 0.99,   // Left field
    'RF': 0.99,   // Right field
    'SP': 1.05,   // Starting pitcher
    'RP': 0.85,   // Relief pitcher
    'DH': 0.90,   // Designated hitter
  }
  
  return scarcity[position] || 1.0
}

// Team control multiplier (simplified for MVP - we don't have this data yet)
function getControlFactor(yearsControl?: number): number {
  if (!yearsControl) return 1.0 // Assume average control
  
  if (yearsControl >= 4) return 1.5 // Extremely valuable
  if (yearsControl >= 2) return 1.2 // Good control
  if (yearsControl >= 1) return 1.0 // Rental
  return 0.8 // Free agent pending
}

// Calculate performance score (0-100 scale based on TPS)
function getPerformanceScore(tps?: number): number {
  if (!tps) return 50 // Average
  
  // Convert TPS to 0-100 scale
  // 0 TPS = 0, 10 TPS = 100, linear scale
  const score = Math.min(Math.max(tps * 10, 0), 100)
  return Math.round(score)
}

// Main valuation function using Trade Power Score
export function calculateTradeValue(player: Player, tps?: number): ValuationBreakdown {
  // Use provided TPS, or player's TPS, or default to 2.0
  const playerTPS = tps ?? player.tps ?? 2.0
  
  // Calculate base value from TPS (similar to WAR × $8M)
  const performanceValue = playerTPS * WAR_VALUE
  
  // Get multipliers
  const ageFactor = getAgeFactor(player.age)
  const positionFactor = getPositionFactor(player.position)
  const controlFactor = getControlFactor(player.yearsControl)
  
  // Calculate dollar value
  const estimatedDollarValue = Math.round(
    performanceValue * ageFactor * positionFactor * controlFactor
  )
  
  // Calculate 0-100 Trade Value Index (for secondary display)
  // Scale: $60M = 100 (elite)
  let tradeValueIndex = Math.round((estimatedDollarValue / 60_000_000) * 100)
  
  // Cap at 100
  tradeValueIndex = Math.min(tradeValueIndex, 100)
  
  // Get performance score (based on TPS)
  const performanceScore = getPerformanceScore(playerTPS)
  
  return {
    tradeValueIndex,
    estimatedDollarValue,
    breakdown: {
      performanceScore,
      ageFactor: Math.round(ageFactor * 100),
      positionFactor: Math.round(positionFactor * 100),
      controlFactor: Math.round(controlFactor * 100),
    }
  }
}

// Helper to format dollar values
export function formatDollarValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  return `$${(value / 1_000).toFixed(0)}K`
}

// Helper to get rating label
export function getRatingLabel(index: number): string {
  if (index >= 90) return 'Elite'
  if (index >= 80) return 'Star'
  if (index >= 70) return 'Above Average'
  if (index >= 60) return 'Solid Starter'
  if (index >= 50) return 'Average'
  if (index >= 40) return 'Below Average'
  return 'Backup'
}

// Helper to get rating color
export function getRatingColor(index: number): string {
  if (index >= 90) return 'text-purple-600'
  if (index >= 80) return 'text-blue-600'
  if (index >= 70) return 'text-green-600'
  if (index >= 60) return 'text-yellow-600'
  if (index >= 50) return 'text-orange-600'
  return 'text-gray-600'
}