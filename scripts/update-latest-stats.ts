import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updatePlayerStats() {
  console.log('🔄 Updating players with latest season stats...')
  
  // Get all players with historical data
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, mlb_id')
    .not('mlb_id', 'is', null)
  
  if (error) {
    console.error('Error fetching players:', error)
    return
  }
  
  let updated = 0
  let failed = 0
  
  for (const player of players || []) {
    // Get most recent season for this player
    const { data: latestSeason, error: seasonError } = await supabase
      .from('player_seasons')
      .select('tps, team, position, season')
      .eq('player_id', player.id)
      .order('season', { ascending: false })
      .limit(1)
      .single()
    
    if (seasonError || !latestSeason) {
      failed++
      continue
    }
    
    // Calculate current age based on latest season
    // We'll keep the original age from players table and just update TPS
    const { error: updateError } = await supabase
      .from('players')
      .update({
        tps: latestSeason.tps,
        team: latestSeason.team,
        position: latestSeason.position
      })
      .eq('id', player.id)
    
    if (updateError) {
      console.error(`Failed to update ${player.name}:`, updateError)
      failed++
    } else {
      console.log(`✅ Updated ${player.name} - TPS: ${latestSeason.tps?.toFixed(2)} (${latestSeason.season})`)
      updated++
    }
  }
  
  console.log(`\n✅ Complete! Updated ${updated} players, ${failed} failed`)
}

updatePlayerStats()