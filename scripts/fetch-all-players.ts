import { createClient } from '@supabase/supabase-js'

// Supabase credentials
const supabaseUrl = 'https://hllnxuwwmjekcbngwgnq.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error("Missing Supabase anon key env var");

const supabase = createClient(supabaseUrl, supabaseKey)

// All 30 MLB team IDs
const MLB_TEAM_IDS = [
  108, // Angels
  109, // Diamondbacks
  110, // Orioles
  111, // Red Sox
  112, // Cubs
  113, // Reds
  114, // Guardians
  115, // Rockies
  116, // Tigers
  117, // Astros
  118, // Royals
  119, // Dodgers
  120, // Nationals
  121, // Mets
  133, // Athletics
  134, // Pirates
  135, // Padres
  136, // Mariners
  137, // Giants
  138, // Cardinals
  139, // Rays
  140, // Rangers
  141, // Blue Jays
  142, // Twins
  143, // Phillies
  144, // Braves
  145, // White Sox
  146, // Marlins
  147, // Yankees
  158, // Brewers
]

async function fetchTeamRoster(teamId: number) {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}`
    )
    const teamData = await response.json()
    const teamName = teamData.teams[0].name

    const rosterResponse = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active`
    )
    const rosterData = await rosterResponse.json()
    
    if (!rosterData.roster) {
      console.log(`No roster found for team ${teamId}`)
      return []
    }

    return rosterData.roster.map((player: any) => ({
      id: player.person.id,
      team: teamName
    }))
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error)
    return []
  }
}

async function fetchPlayer(mlbId: number, teamName: string) {
  try {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}`)
    const data = await response.json()
    
    if (!data.people || data.people.length === 0) {
      return null
    }

    const player = data.people[0]
    
    return {
      mlb_id: player.id,
      name: player.fullName,
      team: teamName,  // Use the team from roster
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
  console.log('🚀 Starting to fetch ALL active MLB players...')
  console.log('This will take 5-10 minutes. Grab a coffee! ☕\n')
  
  let totalPlayers = 0
  let successfulInserts = 0
  
  // Fetch rosters for all 30 teams
  for (const teamId of MLB_TEAM_IDS) {
    console.log(`\n📋 Fetching roster for team ${teamId}...`)
    
    const playerIds = await fetchTeamRoster(teamId)
    console.log(`   Found ${playerIds.length} players`)
    
    // Fetch each player's details
    for (const player of playerIds) {
      totalPlayers++
      
      const playerData = await fetchPlayer(player.id, player.team)
      
      if (playerData) {
        const { error } = await supabase
          .from('players')
          .upsert(playerData, { onConflict: 'mlb_id' })
        
        if (error) {
          console.error(`   ❌ Error inserting ${playerData.name}:`, error.message)
        } else {
          successfulInserts++
          console.log(`   ✓ ${successfulInserts}/${totalPlayers} - ${playerData.name}`)
        }
      }
      
      // Be nice to the API - wait 50ms between requests
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  console.log(`\n🎉 Done! Successfully inserted ${successfulInserts} out of ${totalPlayers} players`)
}

main()