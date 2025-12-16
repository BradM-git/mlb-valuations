import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface MLBPlayer {
  id: number
  name: string
  mlb_id?: number
}

interface SeasonStats {
  season: number
  games_played: number
  batting_avg?: number
  ops?: number
  home_runs?: number
  stolen_bases?: number
  total_bases?: number
  innings_pitched?: number
  era?: number
  strikeouts?: number
  saves?: number
  age: number
  team: string
  position: string
}

// Calculate TPS from season stats
function calculateSeasonTPS(stats: SeasonStats, position: string): number {
  // For batters
  if (stats.batting_avg !== undefined && stats.ops !== undefined) {
    const offensiveValue = 
      (stats.ops * 10) + 
      ((stats.stolen_bases || 0) * 0.15) + 
      ((stats.total_bases || 0) / 10)
    
    const gamesFactor = stats.games_played / 162
    
    // Position adjustment
    let positionAdj = 0
    if (['SS', 'C'].includes(position)) positionAdj = 1.0
    else if (['CF', '2B', '3B'].includes(position)) positionAdj = 0.5
    else if (position === 'DH') positionAdj = -0.5
    
    return (offensiveValue * gamesFactor) + positionAdj
  }
  
  // For pitchers
  if (stats.innings_pitched !== undefined && stats.era !== undefined) {
    const isStarter = (stats.innings_pitched || 0) > 100
    
    if (isStarter) {
      return (
        ((stats.innings_pitched || 0) / 20) +
        ((stats.strikeouts || 0) / 25) +
        (3.5 - (stats.era || 5))
      )
    } else {
      return (
        ((stats.saves || 0) / 10) +
        ((stats.strikeouts || 0) / 15) +
        (3.0 - (stats.era || 4))
      )
    }
  }
  
  return 0
}

async function fetchMLBPlayerStats(mlbId: number): Promise<SeasonStats[]> {
  try {
    // MLB Stats API - get player's career stats
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${mlbId}?hydrate=stats(group=[hitting,pitching],type=[yearByYear])`
    )
    
    if (!response.ok) {
      console.log(`Failed to fetch stats for MLB ID ${mlbId}`)
      return []
    }
    
    const data = await response.json()
    const player = data.people[0]
    
    if (!player) return []
    
    const seasons: SeasonStats[] = []
    
    // Process hitting stats
    if (player.stats) {
      for (const statGroup of player.stats) {
        if (statGroup.group?.displayName === 'hitting') {
          for (const split of statGroup.splits || []) {
            const stat = split.stat
            const season = parseInt(split.season)
            
            if (season < 2015 || !stat) continue // Only get 2015+
            
            seasons.push({
              season,
              games_played: stat.gamesPlayed || 0,
              batting_avg: parseFloat(stat.avg || '0'),
              ops: parseFloat(stat.ops || '0'),
              home_runs: stat.homeRuns || 0,
              stolen_bases: stat.stolenBases || 0,
              total_bases: stat.totalBases || 0,
              age: split.player?.currentAge || 0,
              team: split.team?.name || 'Unknown',
              position: player.primaryPosition?.abbreviation || 'OF'
            })
          }
        }
        
        // Process pitching stats
        if (statGroup.group?.displayName === 'pitching') {
          for (const split of statGroup.splits || []) {
            const stat = split.stat
            const season = parseInt(split.season)
            
            if (season < 2015 || !stat) continue
            
            seasons.push({
              season,
              games_played: stat.gamesPlayed || 0,
              innings_pitched: parseFloat(stat.inningsPitched || '0'),
              era: parseFloat(stat.era || '0'),
              strikeouts: stat.strikeOuts || 0,
              saves: stat.saves || 0,
              age: split.player?.currentAge || 0,
              team: split.team?.name || 'Unknown',
              position: 'P'
            })
          }
        }
      }
    }
    
    return seasons
  } catch (error) {
    console.error(`Error fetching MLB stats for ID ${mlbId}:`, error)
    return []
  }
}

async function main() {
  console.log('🔍 Fetching all players from database...')
  
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, mlb_id, position')
    .not('mlb_id', 'is', null) // All players with MLB IDs
  
  if (error) {
    console.error('Error fetching players:', error)
    return
  }
  
  console.log(`📊 Found ${players?.length || 0} players with MLB IDs`)
  
  let processed = 0
  let failed = 0
  
  for (const player of players || []) {
    console.log(`\n⚾ Processing ${player.name} (${player.id})...`)
    
    if (!player.mlb_id) {
      console.log(`  ⏭️  Skipping - no MLB ID`)
      continue
    }
    
    // Fetch career stats from MLB API
    const seasons = await fetchMLBPlayerStats(player.mlb_id)
    
    if (seasons.length === 0) {
      console.log(`  ⚠️  No stats found`)
      failed++
      continue
    }
    
    console.log(`  📈 Found ${seasons.length} seasons`)
    
    // Calculate TPS and insert each season
    for (const seasonStats of seasons) {
      const tps = calculateSeasonTPS(seasonStats, player.position)
      
      const { error: insertError } = await supabase
        .from('player_seasons')
        .upsert({
          player_id: player.id,
          season: seasonStats.season,
          games_played: seasonStats.games_played,
          batting_avg: seasonStats.batting_avg,
          ops: seasonStats.ops,
          home_runs: seasonStats.home_runs,
          stolen_bases: seasonStats.stolen_bases,
          total_bases: seasonStats.total_bases,
          innings_pitched: seasonStats.innings_pitched,
          era: seasonStats.era,
          strikeouts: seasonStats.strikeouts,
          saves: seasonStats.saves,
          tps: tps,
          age: seasonStats.age,
          team: seasonStats.team,
          position: seasonStats.position
        }, {
          onConflict: 'player_id,season'
        })
      
      if (insertError) {
        console.error(`    ❌ Error inserting season ${seasonStats.season}:`, insertError)
      } else {
        console.log(`    ✅ Saved ${seasonStats.season} (TPS: ${tps.toFixed(2)})`)
      }
    }
    
    processed++
    
    // Rate limiting - wait 500ms between players
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log(`\n✅ Complete! Processed ${processed} players, ${failed} failed`)
}

main()