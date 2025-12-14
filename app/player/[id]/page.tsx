'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { calculateTradeValue, formatDollarValue, getRatingLabel, getRatingColor } from '@/lib/valuation'

interface Player {
  id: number
  name: string
  team: string
  position: string
  age: number
  war?: number
  tps?: number
  image_url: string
  yearsControl?: number
  salary?: number
}

export default function PlayerPage() {
  const params = useParams()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchPlayer()
    }
  }, [params.id])

  async function fetchPlayer() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', params.id)
      .single()

    if (data) {
      setPlayer(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading player...</div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Player not found</div>
      </div>
    )
  }

  const valuation = calculateTradeValue(player, player.tps || player.war || 2.0)

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Player Header */}
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8 mb-6 md:mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
              <img
                src={player.image_url}
                alt={player.name}
                className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover mx-auto md:mx-0"
              />
              <div className="flex-1 text-center md:text-left w-full">
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2 break-words">
                  {player.name}
                </h1>
                <div className="text-base md:text-xl text-gray-600 mb-2 md:mb-4 flex flex-wrap justify-center md:justify-start gap-2">
                  <span>{player.position}</span>
                  <span>•</span>
                  <span className="break-words">{player.team}</span>
                  <span>•</span>
                  <span>Age {player.age}</span>
                </div>
                
                {/* Trade Value */}
                <div className="bg-green-50 rounded-lg p-4 md:p-6">
                  <div className="text-sm md:text-base text-gray-600 mb-1">Estimated Trade Value</div>
                  <div className="text-3xl md:text-5xl font-bold text-green-600 mb-2 break-words">
                    {formatDollarValue(valuation.estimatedDollarValue)}
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm md:text-base">
                    <div>
                      <span className="text-gray-600">Trade Value Index: </span>
                      <span className={`font-bold ${getRatingColor(valuation.tradeValueIndex)}`}>
                        {valuation.tradeValueIndex}/100
                      </span>
                    </div>
                    <div className="hidden md:block text-gray-400">•</div>
                    <div>
                      <span className="text-gray-600">Rating: </span>
                      <span className={`font-bold ${getRatingColor(valuation.tradeValueIndex)}`}>
                        {getRatingLabel(valuation.tradeValueIndex)}
                      </span>
                    </div>
                  </div>
                  {player.tps && (
                    <div className="mt-2 text-sm md:text-base text-gray-600">
                      Trade Power Score (TPS): <span className="font-bold">{player.tps.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Valuation Breakdown */}
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8 mb-6 md:mb-8">
            
            {/* Rating Breakdown */}
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Rating Breakdown</h3>
              <div className="space-y-3 md:space-y-4">
                
                <div>
                  <div className="flex justify-between mb-2 text-sm md:text-base">
                    <span className="text-gray-700 font-medium">Performance Score</span>
                    <span className="font-bold text-gray-900">{valuation.breakdown.performanceScore}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${valuation.breakdown.performanceScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2 text-sm md:text-base">
                    <span className="text-gray-700 font-medium">Age Factor</span>
                    <span className="font-bold text-gray-900">{valuation.breakdown.ageFactor}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 overflow-hidden">
                    <div 
                      className="bg-green-600 h-full rounded-full transition-all"
                      style={{ width: `${valuation.breakdown.ageFactor}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2 text-sm md:text-base">
                    <span className="text-gray-700 font-medium">Position Factor</span>
                    <span className="font-bold text-gray-900">{valuation.breakdown.positionFactor}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all"
                      style={{ width: `${valuation.breakdown.positionFactor}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2 text-sm md:text-base">
                    <span className="text-gray-700 font-medium">Control Factor</span>
                    <span className="font-bold text-gray-900">{valuation.breakdown.controlFactor}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 overflow-hidden">
                    <div 
                      className="bg-orange-600 h-full rounded-full transition-all"
                      style={{ width: `${valuation.breakdown.controlFactor}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Explanation */}
            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-200">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">How This Value Is Calculated</h3>
              <div className="space-y-3 text-sm md:text-base text-gray-700">
                <p>
                  <strong>Performance Score:</strong> Based on the player's Trade Power Score (TPS), 
                  which combines offensive production, defensive value, and overall contribution.
                </p>
                <p>
                  <strong>Age Factor:</strong> Players in their prime years (24-32) receive the highest 
                  multipliers. Young players with upside and veterans still performing well are adjusted accordingly.
                </p>
                <p>
                  <strong>Position Factor:</strong> Reflects the scarcity and value of different positions. 
                  Premium positions like SS, C, and CF receive higher multipliers.
                </p>
                <p>
                  <strong>Control Factor:</strong> Years of team control significantly impact trade value. 
                  More control = higher value.
                </p>
              </div>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <Link 
              href="/players"
              className="inline-block bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold hover:bg-blue-700 transition text-sm md:text-base"
            >
              ← Back to All Players
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}