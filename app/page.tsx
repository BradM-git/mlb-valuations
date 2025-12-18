import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { calculateTradeValue, calculateHistoricalMetrics, formatDollarValue, getRatingLabel } from '@/lib/valuation'

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
  age: number
  team: string
  position: string
}

async function getTopPlayers() {
  // Get all players with TPS
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .not('tps', 'is', null)

  if (!players) return []

  // Get ALL player seasons - Fetch in batches to avoid 1000 row limit
  const playerIds = players.map(p => p.id)
  
  let allSeasons: SeasonStats[] = []
  const batchSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: seasonBatch } = await supabase
      .from('player_seasons')
      .select('*')
      .in('player_id', playerIds)
      .order('season', { ascending: false })
      .range(offset, offset + batchSize - 1)
    
    if (seasonBatch && seasonBatch.length > 0) {
      allSeasons = [...allSeasons, ...seasonBatch]
      offset += batchSize
      hasMore = seasonBatch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Group seasons by player_id
  const seasonsByPlayer = new Map<number, SeasonStats[]>()
  allSeasons?.forEach(season => {
    if (!seasonsByPlayer.has(season.player_id)) {
      seasonsByPlayer.set(season.player_id, [])
    }
    seasonsByPlayer.get(season.player_id)!.push(season)
  })

  // Calculate ETV for each player with historical context
  const playersWithETV = players.map(player => {
    const playerSeasons = seasonsByPlayer.get(player.id) || []
    
    // Calculate historical metrics if we have season data
    const historicalData = playerSeasons.length > 0 
      ? calculateHistoricalMetrics(playerSeasons)
      : undefined

    const valuation = calculateTradeValue(
      player, 
      player.tps || player.war || 2.0,
      historicalData
    )

    return {
      ...player,
      etv: valuation.estimatedDollarValue
    }
  })

  // Sort by ETV (highest to lowest) and take top 10
  return playersWithETV
    .sort((a, b) => b.etv - a.etv)
    .slice(0, 10)
}

export default async function Home() {
  const topPlayers = await getTopPlayers()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              MLB Valuations
            </Link>
            <div className="flex gap-6">
              <Link href="/players" className="text-gray-700 hover:text-blue-600 font-medium">
                Browse Players
              </Link>
              <Link href="/methodology" className="text-gray-700 hover:text-blue-600 font-medium">
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold text-gray-900 mb-6">
              MLB Trade Valuations
            </h1>
            <p className="text-2xl text-gray-600 mb-4">
              Proprietary player valuations based on performance, age, and market dynamics
            </p>
            <p className="text-lg text-gray-500 mb-8">
              Powered by our Trade Power Score (TPS) - a comprehensive metric analyzing 
              multi-year performance for over 1,150 MLB players
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/players"
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
              >
                Browse All Players
              </Link>
              <Link 
                href="/methodology"
                className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg border-2 border-blue-600 hover:bg-blue-50 transition"
              >
                Learn Our Methodology
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16">
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 text-center">
              <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2 break-words">1,150+</div>
              <div className="text-gray-600 font-medium">MLB Players</div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 text-center">
              <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2 break-words">588</div>
              <div className="text-gray-600 font-medium">With 2024 Stats</div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 text-center">
              <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2 break-words">30</div>
              <div className="text-gray-600 font-medium">MLB Teams</div>
            </div>
          </div>

          {/* Top 10 Players */}
          <div className="mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
              Top 10 Most Valuable Players
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {topPlayers.map((player, index) => {
                // Note: We don't recalculate here since we already have etv from getTopPlayers
                const etv = player.etv
                
                return (
                  <Link 
                    key={player.id}
                    href={`/player/${player.id}`}
                    className="bg-white rounded-lg shadow-lg hover:shadow-xl transition p-6 flex items-center gap-6"
                  >
                    <div className="text-3xl font-bold text-gray-400 w-12">
                      #{index + 1}
                    </div>
                    <img
                      src={player.image_url}
                      alt={player.name}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">
                        {player.name}
                      </h3>
                      <div className="text-gray-600 mb-2">
                        {player.position} • {player.team} • Age {player.age}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-bold text-green-600">
                          {formatDollarValue(etv)}
                        </div>
                        <div className="text-sm text-gray-500">
                          TPS: {player.tps?.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-blue-600 rounded-lg p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to explore player valuations?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Search, filter, and compare trade values for every MLB player
            </p>
            <Link 
              href="/players"
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition"
            >
              Browse All Players →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p>© 2024 MLB Valuations. Player valuations based on proprietary Trade Power Score (TPS).</p>
          <p className="mt-2 text-sm">Data updated December 2024. Not affiliated with MLB.</p>
        </div>
      </footer>
    </div>
  )
}