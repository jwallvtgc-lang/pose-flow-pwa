import { Trophy, Star, Award, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppHeader';

export default function Achievements() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
      <AppHeader 
        leftAction={
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-[40px] animate-[glowpulse_7s_ease-in-out_infinite]" />
            <div className="relative bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full w-20 h-20 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.4)]">
              <Trophy className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Achievements</h1>
          <p className="text-xl text-white/60">Track your progress and celebrate milestones</p>
        </div>

        {/* Coming Soon Card */}
        <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(16,185,129,0.15)] p-12 text-center">
          <div className="flex justify-center space-x-4 mb-8">
            <div className="bg-emerald-500/20 rounded-full p-4 border border-emerald-500/30">
              <Star className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="bg-yellow-500/20 rounded-full p-4 border border-yellow-500/30">
              <Award className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="bg-cyan-500/20 rounded-full p-4 border border-cyan-500/30">
              <Trophy className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-4">Coming Soon!</h2>
          <p className="text-lg text-white/60 mb-8 max-w-2xl mx-auto">
            We're working on an exciting achievements system that will help you track your progress, 
            set goals, and celebrate your baseball milestones. Stay tuned for updates!
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-md mx-auto">
            <h3 className="font-semibold text-white mb-3">What's Coming:</h3>
            <ul className="text-left text-white/60 space-y-2">
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                Performance milestones
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                Swing consistency badges
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                Training streak rewards
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                Improvement tracking
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}