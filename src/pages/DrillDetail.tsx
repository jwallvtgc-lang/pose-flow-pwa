import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Target, Zap, CheckCircle2, Package } from 'lucide-react';
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

export default function DrillDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const drill = drillsData.find(d => d.id === id);

  if (!drill) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <Card className="p-6 text-center max-w-md bg-white/5 border-white/10 text-white">
          <h3 className="text-lg font-black mb-2">Drill Not Found</h3>
          <p className="text-white/60 mb-4">This drill doesn't exist.</p>
          <Button onClick={() => navigate('/drills')} className="bg-emerald-500 hover:bg-emerald-600">
            Back to Drills
          </Button>
        </Card>
      </div>
    );
  }

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
                onClick={() => navigate('/drills')}
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
          {/* Drill Header */}
          <Card className="bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent border-emerald-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <Badge className="mb-3 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {metricLabels[drill.goalMetric] || drill.goalMetric}
              </Badge>
              <h1 className="text-3xl font-black mb-3">{drill.name}</h1>
              <p className="text-white/80 text-base font-medium">{drill.purpose}</p>
            </div>
          </Card>

          {/* Reps Card */}
          <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Reps</div>
                <div className="text-xl font-black text-emerald-400">{drill.reps}</div>
              </div>
            </div>
          </Card>

          {/* Setup Section */}
          <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Setup
            </h3>
            <ul className="space-y-2">
              {drill.setup.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-white/80 text-sm">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Steps Section */}
          <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Steps
            </h3>
            <ol className="space-y-3">
              {drill.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-white/80 text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black flex-shrink-0 border border-emerald-500/30">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          {/* Focus Cues Section */}
          <Card className="bg-gradient-to-br from-cyan-500/10 to-transparent border-cyan-500/20 rounded-2xl p-5 text-white shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Focus Cues
            </h3>
            <ul className="space-y-2">
              {drill.focusCues.map((cue, index) => (
                <li key={index} className="flex items-start gap-2 text-white/80 text-sm">
                  <span className="text-cyan-400 mt-0.5 text-lg">→</span>
                  <span className="font-medium">{cue}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Equipment Section */}
          <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-white/60" />
              Equipment
            </h3>
            <div className="flex flex-wrap gap-2">
              {drill.equipment.map((item, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-sm text-white/80 border-white/20 bg-white/5"
                >
                  {item}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Bottom CTA */}
          <Card className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 rounded-2xl p-5 text-center text-white">
            <p className="text-sm text-white/90 mb-4 font-medium">
              🔥 Get after it! Consistency beats intensity.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => navigate('/drills')} 
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                All Drills
              </Button>
              <Button 
                onClick={() => navigate('/analysis')} 
                className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              >
                Record Swing
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
