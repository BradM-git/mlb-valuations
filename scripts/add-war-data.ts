import { createClient } from '@supabase/supabase-js'

// Supabase credentials
const supabaseUrl = 'https://hllnxuwwmjekcbngwgnq.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseKey) throw new Error("Missing Supabase anon key env var");

const supabase = createClient(supabaseUrl, supabaseKey)

// 2024 WAR data by player name
const WAR_DATA_BY_NAME: { [key: string]: number } = {
  // Angels
  'Mike Trout': 5.2,
  
  // Dodgers
  'Mookie Betts': 6.8,
  'Shohei Ohtani': 9.2,
  'Freddie Freeman': 4.1,
  
  // Yankees
  'Aaron Judge': 10.8,
  'Juan Soto': 7.9,
  
  // Braves
  'Ronald Acuña Jr.': 8.3,
  'Matt Olson': 5.1,
  'Austin Riley': 4.8,
  
  // Guardians
  'Jose Ramirez': 5.6,
  'José Ramírez': 5.6, // Alternative spelling
  
  // Blue Jays
  'Vladimir Guerrero Jr.': 4.9,
  
  // Phillies
  'Trea Turner': 4.2,
  'Bryce Harper': 4.9,
  
  // Red Sox
  'Rafael Devers': 6.4,
  
  // Royals
  'Bobby Witt Jr.': 8.5,
  
  // Mariners
  'Julio Rodriguez': 4.7,
  'Julio Rodríguez': 4.7, // Alternative spelling
  
  // Astros
  'Yordan Alvarez': 4.9,
  'Kyle Tucker': 6.5,
  
  // Mets
  'Pete Alonso': 3.2,
  
  // Orioles
  'Adley Rutschman': 5.8,
  'Gunnar Henderson': 8.9,
  
  // Rangers
  'Corey Seager': 5.2,
  'Marcus Semien': 3.8,
  
  // Tigers
  'Riley Greene': 4.3,
  
  // Marlins
  'Sandy Alcantara': 2.8,
  
  // Diamondbacks
  'Corbin Carroll': 4.1,
  
  // Reds
  'Elly De La Cruz': 4.6,
}

async function updateWAR() {
  console.log('🚀 Starting to update WAR data by player name...\n')
  
  let updated = 0
  let notFound = 0
  
  for (const [playerName, war] of Object.entries(WAR_DATA_BY_NAME)) {
    console.log(`Looking for: ${playerName}`)
    
    const { data, error } = await supabase
      .from('players')
      .update({ war: war })
      .eq('name', playerName)
      .select()
    
    if (error) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!data || data.length === 0) {
      console.log(`  ⚠️  Player "${playerName}" not found in database`)
      notFound++
    } else {
      console.log(`  ✓ Updated ${data[0].name} (ID: ${data[0].id}) with WAR: ${war}`)
      updated++
    }
    
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.log(`\n🎉 Done! Updated ${updated} players. ${notFound} not found.`)
}

updateWAR()