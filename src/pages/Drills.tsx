import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, Target, Zap } from 'lucide-react';
import { Header } from '@/components/Header';
import { drillsData } from '@/lib/drillsData';

const metricLabels: Record<string, string> = {
  head_drift_cm: 'Head Control',
  attack_angle_deg: 'Attack Angle',
  hip_shoulder_sep_deg: 'Separation',
  bat_lag_deg: 'Bat Lag',
  exit_velocity_mph: 'Exit Velo',
  hip_rotation_deg: 'Hip Rotation',
  bat_speed_mph: 'Bat Speed',
  pelvis_tilt_deg: 'Pelvis Tilt',
  swing_plane_deg: 'Swing Plane',
  extension_cm: 'Extension',
  time_to_contact_ms: 'Timing',
  launch_angle_deg: 'Launch Angle',
  shoulder_angle_deg: 'Shoulder Angle'
};

export default function Drills() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black pb-28">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-[#0F172A]/95 to-black/95 backdrop-blur-xl text-white safe-area-top border-b border-white/10">
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <Header 
            leftAction={
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            }
            rightAction={<div className="w-8" />}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Hero Section */}
          <Card className="bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent border-emerald-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-6 h-6 text-emerald-400" />
                <h1 className="text-2xl font-black">Training Drills</h1>
              </div>
              <p className="text-white/80 text-sm">
                Level up your swing with these coach-approved drills. Each one targets a specific metric to help you improve faster.
              </p>
            </div>
          </Card>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white/5 border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-emerald-400">{drillsData.length}</div>
              <div className="text-xs text-white/60 mt-1">Total Drills</div>
            </Card>
            <Card className="bg-white/5 border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-cyan-400">
                {new Set(drillsData.map(d => d.goalMetric)).size}
              </div>
              <div className="text-xs text-white/60 mt-1">Metrics Covered</div>
            </Card>
          </div>

          {/* Drills List */}
          <div className="space-y-3">
            {drillsData.map((drill) => (
              <Card
                key={drill.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => navigate(`/drills/${drill.id}`)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6 text-emerald-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-white font-black text-base leading-tight">
                        {drill.name}
                      </h3>
                      <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                    
                    <p className="text-white/70 text-sm mb-3 line-clamp-2">
                      {drill.purpose}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        {metricLabels[drill.goalMetric] || drill.goalMetric}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-white/60 border-white/20">
                        {drill.reps}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Bottom CTA */}
          <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-center text-white">
            <p className="text-sm text-white/80 mb-3">
              💪 Pick a drill that matches your focus metric and get to work!
            </p>
            <Button 
              onClick={() => navigate('/analysis')} 
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
            >
              Record a Swing
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
