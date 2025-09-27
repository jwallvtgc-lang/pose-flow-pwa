import { Trophy, Star, Award } from 'lucide-react';

export default function Achievements() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Achievements</h1>
          <p className="text-xl text-gray-600">Track your progress and celebrate milestones</p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="flex justify-center space-x-4 mb-8">
            <div className="bg-blue-100 rounded-full p-4">
              <Star className="w-8 h-8 text-blue-600" />
            </div>
            <div className="bg-green-100 rounded-full p-4">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <div className="bg-purple-100 rounded-full p-4">
              <Trophy className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon!</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            We're working on an exciting achievements system that will help you track your progress, 
            set goals, and celebrate your baseball milestones. Stay tuned for updates!
          </p>
          
          <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto">
            <h3 className="font-semibold text-gray-900 mb-2">What's Coming:</h3>
            <ul className="text-left text-gray-600 space-y-2">
              <li>• Performance milestones</li>
              <li>• Swing consistency badges</li>
              <li>• Training streak rewards</li>
              <li>• Improvement tracking</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}