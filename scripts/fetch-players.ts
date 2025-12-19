import { createClient } from '@supabase/supabase-js'

// Supabase credentials
const supabaseUrl = 'https://hllnxuwwmjekcbngwgnq.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error("Missing Supabase anon key env var");

const supabase = createClient(supabaseUrl, supabaseKey)

// Top 50 MLB players by ID (manually curated list of stars)
const TOP_PLAYER_IDS = [
  660271, // Mike Trout
  545361, // Mookie Betts
  592450, // Aaron Judge
  665742, // Juan Soto
  608070, // Shohei Ohtani
  660670, // Ronald Acuña Jr.
  571448, // Jose Ramirez
  665487, // Vladimir Guerrero Jr.
  608369, // Trea Turner
  660271, // Fernando Tatis Jr.
  666185, // Bobby Witt Jr.
  663656, // Julio Rodriguez
  650402, // Yordan Alvarez
  621020, // Bryce Harper
  641319, // Rafael Devers
  663993, // Adley Rutschman
  656941, // Kyle Tucker
  666157, // Riley Greene
  665923, // Gunnar Henderson
  660644, // Pete Alonso
  665489, // Corey Seager
  608324, // Matt Olson
  641355, // Austin Riley
]

async function fetchPlayer(mlbId: number) {
  try {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}`)
    const data = await response.json()
    
    if (!data.people || data.people.length === 0) {
      console.log(`No data found for player ${mlbId}`)
      return null
    }

    const player = data.people[0]
    
    return {
      mlb_id: player.id,
      name: player.fullName,
      team: player.currentTeam?.name || 'Free Agent',
      position: player.primaryPosition?.abbreviation || 'Unknown',
      age: player.currentAge || null,
      birth_date: player.birthDate || null,
      debut_date: player.mlbDebutDate || null,
      image_url: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.id}/headshot/67/current`
    }
  } catch (error) {
    console.error(`Error fetching player ${mlbId}:`, error)
    return null
  }
}

async function main() {
  console.log('Starting to fetch MLB players...')
  
  for (const playerId of TOP_PLAYER_IDS) {
    console.log(`Fetching player ${playerId}...`)
    
    const playerData = await fetchPlayer(playerId)
    
    if (playerData) {
      const { error } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'mlb_id' })
      
      if (error) {
        console.error(`Error inserting player ${playerData.name}:`, error)
      } else {
        console.log(`✓ Inserted ${playerData.name}`)
      }
    }
    
    // Be nice to the API - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('Done!')
}

main()