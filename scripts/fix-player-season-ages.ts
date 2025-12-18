import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface Player {
  id: number
  name: string
  birth_date: string
}

interface Season {
  season: number
  age: number | null
}

// Calculate age from birth date and season year
function calculateAge(birthDate: string, season: number): number {
  const birth = new Date(birthDate)
  // Use July 1st of the season as reference (mid-season)
  const seasonDate = new Date(season, 6, 1)
  
  let age = seasonDate.getFullYear() - birth.getFullYear()
  const monthDiff = seasonDate.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && seasonDate.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

async function main() {
  console.log('🔧 Fixing player_season ages...\n')

  // Get all players with birth dates
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, birth_date')
    .not('birth_date', 'is', null)

  if (playersError || !players) {
    console.error('Error fetching players:', playersError)
    return
  }

  console.log(`Found ${players.length} players with birth dates\n`)

  let updated = 0
  let failed = 0

  for (const player of players as Player[]) {
    console.log(`Processing ${player.name}...`)

    // Get all seasons for this player
    const { data: seasons, error: seasonsError } = await supabase
      .from('player_seasons')
      .select('season, age')
      .eq('player_id', player.id)

    if (seasonsError || !seasons) {
      console.log(`  ⚠️  No seasons found`)
      failed++
      continue
    }

    // Update each season with correct age
    for (const season of seasons as Season[]) {
      if (season.age !== 0 && season.age !== null) {
        // Skip if age already set
        continue
      }

      const age = calculateAge(player.birth_date, season.season)
      
      const { error: updateError } = await supabase
        .from('player_seasons')
        .update({ age })
        .eq('player_id', player.id)
        .eq('season', season.season)

      if (updateError) {
        console.error(`  ❌ Error updating season ${season.season}:`, updateError)
        failed++
      } else {
        console.log(`  ✓ Set age ${age} for ${season.season} season`)
        updated++
      }
    }
  }

  console.log(`\n✅ Complete! Updated ${updated} season records, ${failed} failed`)
}

main()