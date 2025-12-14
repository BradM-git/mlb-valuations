import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { calculateTradeValue, formatDollarValue, getRatingLabel, getRatingColor } from '@/lib/valuation'

interface PlayerPageProps {
  params: {
    id: string
  }
}

async function getPlayer(id: string) {
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !player) {
    return null
  }

  return player
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params
  const player = await getPlayer(id)

  if (!player) {
    notFound()
  }

  // Calculate trade value using real WAR (or default to 2.0 if not available)
  const valuation = calculateTradeValue(player, player.war || 2.0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Player Header */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <div className="flex items-start gap-6">
              {/* Player Photo */}
              <img
                src={player.image_url}
                alt={player.name}
                className="w-32 h-32 rounded-lg object-cover"
              />
              
              {/* Player Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {player.name}
                </h1>
                <div className="flex gap-4 text-lg text-gray-600 mb-4">
                  <span>{player.position}</span>
                  <span>•</span>
                  <span>{player.team}</span>
                  <span>•</span>
                  <span>Age {player.age}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Value Section */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-8 mb-6">
            <div className="text-center mb-6">
              <div className="text-sm text-gray-600 uppercase tracking-wide mb-2">
                Trade Value Index
              </div>
              <div className={`text-7xl font-bold ${getRatingColor(valuation.tradeValueIndex)} mb-2`}>
                {valuation.tradeValueIndex}
              </div>
              <div className="text-xl text-gray-700 font-semibold">
                {getRatingLabel(valuation.tradeValueIndex)}
              </div>
              <div className="text-gray-600 mt-2">
                Estimated Value: {formatDollarValue(valuation.estimatedDollarValue)}
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-gray-300 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rating Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Performance</span>
                  <div className="flex items-center gap-3">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(valuation.breakdown.performanceScore, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-12 text-right">
                      {valuation.breakdown.performanceScore}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Age Factor</span>
                  <div className="flex items-center gap-3">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(valuation.breakdown.ageFactor, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-12 text-right">
                      {valuation.breakdown.ageFactor}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Position Value</span>
                  <div className="flex items-center gap-3">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(valuation.breakdown.positionFactor, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-12 text-right">
                      {valuation.breakdown.positionFactor}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Team Control</span>
                  <div className="flex items-center gap-3">
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(valuation.breakdown.controlFactor, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-12 text-right">
                      {valuation.breakdown.controlFactor}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Info */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Player Information
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600">2024 WAR</div>
                <div className="text-lg font-semibold">
                  {player.war ? player.war.toFixed(1) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Birth Date</div>
                <div className="text-lg font-semibold">
                  {player.birth_date || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">MLB Debut</div>
                <div className="text-lg font-semibold">
                  {player.debut_date || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Position</div>
                <div className="text-lg font-semibold">
                  {player.position}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Team</div>
                <div className="text-lg font-semibold">
                  {player.team}
                </div>
              </div>
            </div>
          </div>

          {/* Methodology Note */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              💡 How We Calculate Trade Value
            </h3>
            <p className="text-gray-700 text-sm">
              Our Trade Value Index (0-100) combines performance, age, position scarcity, 
              and team control to estimate a player's value in trade scenarios. This differs 
              from MLB The Show ratings, which measure pure baseball ability. A young player 
              with team control may have higher trade value than a better but older/expensive player.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}