import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hllnxuwwmjekcbngwgnq.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error("Missing Supabase anon key env var");

const supabase = createClient(supabaseUrl, supabaseKey)

interface PlayerStats {
  games_played: number
  at_bats: number
  hits: number
  doubles: number
  triples: number
  home_runs: number
  walks: number
  strikeouts: number
  stolen_bases: number
  ops: number
  total_bases: number
  innings_pitched: number
  earned_runs: number
  era: number
  pitcher_strikeouts: number
  saves: number
  is_pitcher: boolean
  tps: number
}

async function fetchPlayerStats(mlbId: number): Promise<Partial<PlayerStats> | null> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=season&season=2024&group=hitting,pitching`
    )
    const data = await response.json()

    if (!data.stats || data.stats.length === 0) {
      return null
    }

    let stats: Partial<PlayerStats> = {}
    
    // Check for hitting stats
    const hittingStats = data.stats.find((s: any) => s.group.displayName === 'hitting')
    if (hittingStats && hittingStats.splits && hittingStats.splits.length > 0) {
      const stat = hittingStats.splits[0].stat
      
      stats = {
        games_played: stat.gamesPlayed || 0,
        at_bats: stat.atBats || 0,
        hits: stat.hits || 0,
        doubles: stat.doubles || 0,
        triples: stat.triples || 0,
        home_runs: stat.homeRuns || 0,
        walks: stat.baseOnBalls || 0,
        strikeouts: stat.strikeOuts || 0,
        stolen_bases: stat.stolenBases || 0,
        ops: parseFloat(stat.ops) || 0,
        total_bases: stat.totalBases || 0,
        is_pitcher: false
      }
    }

    // Check for pitching stats
    const pitchingStats = data.stats.find((s: any) => s.group.displayName === 'pitching')
    if (pitchingStats && pitchingStats.splits && pitchingStats.splits.length > 0) {
      const stat = pitchingStats.splits[0].stat
      
      // If player has significant pitching stats, they're primarily a pitcher
      if (parseFloat(stat.inningsPitched) > 20) {
        stats = {
          games_played: stat.gamesPlayed || 0,
          innings_pitched: parseFloat(stat.inningsPitched) || 0,
          earned_runs: stat.earnedRuns || 0,
          era: parseFloat(stat.era) || 0,
          pitcher_strikeouts: stat.strikeOuts || 0,
          saves: stat.saves || 0,
          is_pitcher: true
        }
      }
    }

    return stats

  } catch (error) {
    console.error(`Error fetching stats for player ${mlbId}:`, error)
    return null
  }
}

function calculateTPS(stats: Partial<PlayerStats>, position: string): number {
  if (stats.is_pitcher) {
    // Pitcher TPS
    const ip = stats.innings_pitched || 0
    const k = stats.pitcher_strikeouts || 0
    const era = stats.era || 5.0
    const saves = stats.saves || 0

    if (ip > 50) {
      // Starter
      return Math.max(0, (ip / 20) + (k / 25) + (3.5 - era))
    } else {
      // Reliever
      return Math.max(0, (saves / 10) + (k / 15) + (3.0 - era))
    }
  } else {
    // Position player TPS
    const ops = stats.ops || 0
    const sb = stats.stolen_bases || 0
    const tb = stats.total_bases || 0
    const games = stats.games_played || 0

    if (games < 20) return 0 // Not enough playing time

    const offensiveValue = (ops * 10) + (sb * 0.15) + (tb / 10)
    const gamesFactor = games / 162
    
    // Position adjustment
    let positionAdj = 0
    if (['SS', 'C'].includes(position)) positionAdj = 1.0
    else if (['CF', '2B', '3B'].includes(position)) positionAdj = 0.5
    else if (position === 'DH') positionAdj = -0.5

    return Math.max(0, (offensiveValue * gamesFactor) + positionAdj)
  }
}

async function main() {
  console.log('🚀 Fetching 2024 stats for all players...\n')

  // Get all players
  const { data: players, error } = await supabase
    .from('players')
    .select('id, mlb_id, name, position')

  if (error || !players) {
    console.error('Error fetching players:', error)
    return
  }

  console.log(`Found ${players.length} players to process\n`)

  let updated = 0
  let noStats = 0

  for (const player of players) {
    console.log(`Fetching stats for ${player.name}...`)

    const stats = await fetchPlayerStats(player.mlb_id)

    if (!stats || Object.keys(stats).length === 0) {
      console.log(`  ⚠️  No 2024 stats found`)
      noStats++
    } else {
      // Calculate TPS
      const tps = calculateTPS(stats, player.position)
      
      // Update player
      const { error: updateError } = await supabase
        .from('players')
        .update({ ...stats, tps })
        .eq('id', player.id)

      if (updateError) {
        console.error(`  ❌ Error updating:`, updateError.message)
      } else {
        console.log(`  ✓ Updated with TPS: ${tps.toFixed(1)}`)
        updated++
      }
    }

    // Rate limit - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`\n🎉 Done! Updated ${updated} players. ${noStats} had no 2024 stats.`)
}

main()