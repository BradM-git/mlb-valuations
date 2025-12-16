'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { calculateTradeValue } from '@/lib/valuation'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface SeasonData {
  season: number
  tps: number
  age: number
  team: string
  position: string
}

interface CareerChartProps {
  playerName: string
  seasons: SeasonData[]
  currentAge: number
}

export function CareerChart({ playerName, seasons, currentAge }: CareerChartProps) {
  if (!seasons || seasons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-500">No historical data available for this player</p>
      </div>
    )
  }

  // Sort by season
  const sortedSeasons = [...seasons].sort((a, b) => a.season - b.season)

  // Calculate trade values for each season
  const seasonsWithValues = sortedSeasons.map(season => {
    const valuation = calculateTradeValue(
      {
        age: season.age,
        position: season.position,
        tps: season.tps
      },
      season.tps
    )
    
    return {
      ...season,
      tradeValue: valuation.estimatedDollarValue
    }
  })

  // Prepare chart data
  const labels = seasonsWithValues.map(s => s.season.toString())
  
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Trade Value',
        data: seasonsWithValues.map(s => s.tradeValue / 1_000_000),
        borderColor: 'rgb(34, 197, 94)', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0, // Straight lines (not curved)
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // Hide legend since we only have one line
      },
      title: {
        display: true,
        text: `${playerName} - Career Trade Value Progression`,
        font: {
          size: 18,
          weight: 'bold' as const
        },
        padding: 20,
        color: '#111827'
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: 16,
        titleFont: {
          size: 15,
          weight: 'bold' as const
        },
        bodyFont: {
          size: 14
        },
        bodySpacing: 6,
        callbacks: {
          title: function(context: any) {
            const season = seasonsWithValues[context[0].dataIndex]
            return `${season.season} Season`
          },
          label: function(context: any) {
            const season = seasonsWithValues[context.dataIndex]
            return [
              `Trade Value: $${context.parsed.y.toFixed(1)}M`,
              `TPS: ${season.tps.toFixed(2)}`,
              `Age: ${season.age}`,
              `Team: ${season.team}`
            ]
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Season',
          font: {
            size: 14,
            weight: 'bold' as const
          },
          color: '#374151'
        },
        grid: {
          display: false
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12
          }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Trade Value ($ Millions)',
          font: {
            size: 14,
            weight: 'bold' as const
          },
          color: '#374151'
        },
        ticks: {
          color: '#6B7280',
          callback: function(value: number | string) {
            return '$' + value + 'M'
          },
          font: {
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      }
    }
  }

  const maxTPS = Math.max(...seasonsWithValues.map(s => s.tps))
  const maxValue = Math.max(...seasonsWithValues.map(s => s.tradeValue))
  const peakSeason = seasonsWithValues.find(s => s.tradeValue === maxValue)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
      <div style={{ height: '400px' }}>
        <Line data={chartData} options={options} />
      </div>
      
      {/* Career Stats Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Career Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Seasons</div>
            <div className="font-bold text-gray-900">{seasons.length}</div>
          </div>
          <div>
            <div className="text-gray-500">Peak TPS</div>
            <div className="font-bold text-blue-600">
              {maxTPS.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Peak Value</div>
            <div className="font-bold text-green-600">
              ${(maxValue / 1_000_000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div className="text-gray-500">Peak Season</div>
            <div className="font-bold text-gray-900">
              {peakSeason?.season || 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}