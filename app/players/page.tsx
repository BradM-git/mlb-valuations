'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { calculateTradeValue, formatDollarValue } from '@/lib/valuation'

interface Player {
  id: number
  name: string
  team: string
  position: string
  age: number
  war?: number
  tps?: number  // Add TPS field
  image_url: string
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'team' | 'etv'>('etv')

  useEffect(() => {
    fetchPlayers()
  }, [])

  useEffect(() => {
    filterAndSortPlayers()
  }, [players, searchTerm, teamFilter, positionFilter, sortBy])

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name')

    if (data) {
      setPlayers(data)
    }
    setLoading(false)
  }

  function filterAndSortPlayers() {
    let filtered = [...players]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Team filter
    if (teamFilter !== 'all') {
      filtered = filtered.filter(p => p.team === teamFilter)
    }

    // Position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.position === positionFilter)
    }

    // Sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'team') {
      filtered.sort((a, b) => a.team.localeCompare(b.team))
    } else if (sortBy === 'etv') {
      filtered.sort((a, b) => {
        const aVal = calculateTradeValue(a, a.tps || a.war || 2.0)
        const bVal = calculateTradeValue(b, b.tps || b.war || 2.0)
        return bVal.estimatedDollarValue - aVal.estimatedDollarValue
      })
    }

    setFilteredPlayers(filtered)
  }

  const teams = Array.from(new Set(players.map(p => p.team))).sort()
  const positions = Array.from(new Set(players.map(p => p.position))).sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading players...</div>
      </div>
    )
  }

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
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              MLB Player Valuations
            </h1>
            <p className="text-gray-600">
              Browse all {players.length} players and their estimated trade values
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Players
                </label>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {/* Position Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position
                </label>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="etv">Trade Value (High to Low)</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="team">Team (A-Z)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredPlayers.length} of {players.length} players
            </div>
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map(player => {
              const valuation = calculateTradeValue(player, player.tps || player.war || 2.0)
              
              return (
                <Link 
                  key={player.id} 
                  href={`/player/${player.id}`}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={player.image_url}
                      alt={player.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900 truncate">
                        {player.name}
                      </h3>
                      <div className="text-sm text-gray-600 mb-2">
                        {player.position} • {player.team}
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatDollarValue(valuation.estimatedDollarValue)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          TVI: {valuation.tradeValueIndex}/100
                          {player.tps && ` • TPS: ${player.tps.toFixed(1)}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">
                No players found matching your filters
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}