import Link from 'next/link'

export default function MethodologyPage() {
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

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            How We Calculate Trade Values
          </h1>
          
          <p className="text-xl text-gray-600 mb-12">
            Our proprietary methodology combines performance metrics, market dynamics, 
            and player context to estimate what teams would give up to acquire each player.
          </p>

          {/* Trade Power Score */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              1. Trade Power Score (TPS)
            </h2>
            <p className="text-gray-700 mb-4">
              Our proprietary performance metric, calculated from 2024 MLB statistics. 
              Similar to WAR (Wins Above Replacement), but built from the ground up using 
              our own formula.
            </p>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              For Position Players:
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm mb-4">
              <div className="text-gray-800">Offensive Value = (OPS × 10) + (Stolen Bases × 0.15) + (Total Bases ÷ 10)</div>
              <div className="mt-2 text-gray-800">Games Factor = Games Played ÷ 162</div>
              <div className="mt-2 text-gray-800">Position Adjustment = SS/C: +1.0, CF/2B/3B: +0.5, DH: -0.5</div>
              <div className="mt-4 font-bold text-gray-900">TPS = (Offensive Value × Games Factor) + Position Adjustment</div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              For Pitchers:
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
              <div className="text-gray-800">Starters: TPS = (IP ÷ 20) + (K ÷ 25) + (3.5 - ERA)</div>
              <div className="mt-2 text-gray-800">Relievers: TPS = (Saves ÷ 10) + (K ÷ 15) + (3.0 - ERA)</div>
            </div>

            <p className="text-gray-600 mt-4 text-sm">
              TPS typically ranges from 0-12, with elite players scoring 8+
            </p>
          </div>

          {/* Trade Value Calculation */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              2. Estimated Trade Value (Dollars)
            </h2>
            <p className="text-gray-700 mb-4">
              We convert TPS into a dollar value by applying market adjustments:
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Base Value</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <code className="text-gray-800">TPS × $8M</code>
                  <p className="text-sm text-gray-600 mt-2">
                    Industry standard: 1 point of value ≈ $8M in free agent market
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Age Adjustment</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <ul className="text-sm space-y-1 text-gray-700">
                    <li>Under 24: 1.08× (young, elite talent)</li>
                    <li>24-26: 1.05× (rising star)</li>
                    <li>27-29: 1.03× (prime years)</li>
                    <li>30-32: 1.0× (peak/late prime)</li>
                    <li>33-34: 0.85× (starting decline)</li>
                    <li>35-36: 0.70× (clear decline)</li>
                    <li>37+: 0.5× (late career)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Position Scarcity</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <ul className="text-sm space-y-1 text-gray-700">
                    <li>SS: 1.05× (premium position)</li>
                    <li>C: 1.05× (scarce skill set)</li>
                    <li>CF: 1.03× (athleticism required)</li>
                    <li>SP: 1.05× (starting pitchers are valuable)</li>
                    <li>DH: 0.90× (limited defensive value)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Team Control</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Players with more years of team control (before free agency) are more 
                    valuable in trades. Currently simplified to 1.0× for MVP; will be refined 
                    with contract data.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mt-6">
              <p className="font-semibold text-blue-900 mb-2">Final Formula:</p>
              <code className="text-sm text-blue-800">
                Trade Value = TPS × $8M × Age Factor × Position Factor × Control Factor
              </code>
            </div>
          </div>

          {/* Trade Value Index */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              3. Trade Value Index (TVI)
            </h2>
            <p className="text-gray-700 mb-4">
              A 0-100 scale for easy comparison, calculated as:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <code className="text-gray-800">TVI = (Estimated Trade Value ÷ $60M) × 100</code>
              <p className="text-sm text-gray-600 mt-2">
                Capped at 100. Players worth $60M+ in trade value receive the maximum score.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Rating Scale:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-purple-600 font-bold">90-100</span>
                  <span className="text-gray-700">Elite</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-blue-600 font-bold">80-89</span>
                  <span className="text-gray-700">Star</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-green-600 font-bold">70-79</span>
                  <span className="text-gray-700">Above Average</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-yellow-600 font-bold">60-69</span>
                  <span className="text-gray-700">Solid Starter</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-orange-600 font-bold">50-59</span>
                  <span className="text-gray-700">Average</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-gray-600 font-bold">0-49</span>
                  <span className="text-gray-700">Below Average / Backup</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Differences */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How This Differs From Other Metrics
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">vs. MLB The Show Ratings</h3>
                <p className="text-gray-700">
                  The Show rates <strong>current playing ability</strong>. We rate <strong>trade acquisition value</strong>, 
                  which includes age, contract, and team control. A 31-year-old star might be 
                  rated 93 in The Show but have lower trade value due to age and contract.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">vs. WAR (Wins Above Replacement)</h3>
                <p className="text-gray-700">
                  WAR measures past performance. Our Trade Power Score is similar but proprietary, 
                  and we add market adjustments (age, position, control) to estimate future trade value.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">vs. Actual Salaries</h3>
                <p className="text-gray-700">
                  Player salaries reflect contracts signed years ago. Trade value represents 
                  <strong> current market worth</strong> if a team wanted to acquire them today.
                </p>
              </div>
            </div>
          </div>

          {/* Transparency */}
          <div className="bg-blue-50 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Our Commitment to Transparency
            </h2>
            <p className="text-gray-700 mb-4">
              We believe trade valuations should be open and defensible. That's why we:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Show our complete formula and methodology</li>
              <li>Display the breakdown of each valuation component</li>
              <li>Use publicly available MLB statistics</li>
              <li>Continuously refine our model based on actual trade outcomes</li>
              <li>Welcome feedback and debate on player valuations</li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link 
              href="/players"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
            >
              Explore Player Valuations →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}