export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            MLB Valuations
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            The definitive platform for MLB player market valuations
          </p>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              Coming Soon
            </div>
            <p className="text-gray-600">
              We're building something special.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}