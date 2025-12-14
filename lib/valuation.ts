interface Player {
  age: number | null
  position: string
  war?: number
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

// Base value: $8M per WAR (industry standard)
const WAR_VALUE = 8_000_000

// Age multipliers - adjusted to be less punishing
function getAgeFactor(age: number | null): number {
  if (!age) return 1.0
  
  if (age < 25) return 1.25  // Young with upside
  if (age <= 27) return 1.15 // Rising star
  if (age <= 30) return 1.0  // Peak years (extended)
  if (age <= 33) return 0.9  // Still productive (less penalty)
  if (age <= 36) return 0.75 // Veteran
  return 0.5 // Late career
}

// Position scarcity multipliers
function getPositionFactor(position: string): number {
  const scarcity: { [key: string]: number } = {
    'SS': 1.15,   // Shortstop - scarce
    'C': 1.12,    // Catcher - scarce
    'CF': 1.08,   // Center field - athletic
    '3B': 1.05,   // Third base
    '2B': 1.0,    // Second base
    '1B': 0.95,   // First base
    'LF': 0.98,   // Left field
    'RF': 0.98,   // Right field
    'SP': 1.1,    // Starting pitcher
    'RP': 0.8,    // Relief pitcher
    'DH': 0.85,   // Designated hitter
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

// Calculate performance score (0-100 scale based on WAR)
function getPerformanceScore(war?: number): number {
  if (!war) return 50 // Average
  
  // Convert WAR to 0-100 scale
  // 0 WAR = 0, 10 WAR = 100, linear scale
  const score = Math.min(Math.max(war * 10, 0), 100)
  return Math.round(score)
}

// Main valuation function
export function calculateTradeValue(player: Player, war: number = 3.0): ValuationBreakdown {
  // Use provided WAR or default to 3.0 (average starter)
  const performanceValue = war * WAR_VALUE
  
  // Get multipliers
  const ageFactor = getAgeFactor(player.age)
  const positionFactor = getPositionFactor(player.position)
  const controlFactor = getControlFactor(player.yearsControl)
  
  // Calculate dollar value
  const estimatedDollarValue = Math.round(
    performanceValue * ageFactor * positionFactor * controlFactor
  )
  
  // Calculate 0-100 Trade Value Index using logarithmic scale
  // This creates smooth distribution where 100 is asymptotic (never quite reached)
  // Formula: 100 * (1 - e^(-value/scaleFactor))
  const scaleFactor = 45_000_000 // Tuned so $90M ≈ 88, $120M ≈ 93
  let tradeValueIndex = 100 * (1 - Math.exp(-estimatedDollarValue / scaleFactor))
  
  // Round to 1 decimal place
  tradeValueIndex = Math.round(tradeValueIndex * 10) / 10
  
  // Get performance score
  const performanceScore = getPerformanceScore(war)
  
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