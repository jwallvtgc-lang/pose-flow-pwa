import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Search, ChevronRight } from 'lucide-react';
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

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Bat Speed', value: 'bat_speed_mph' },
  { label: 'Head Drift', value: 'head_drift_cm' },
  { label: 'Hip Rotation', value: 'hip_rotation_deg' },
  { label: 'Attack Angle', value: 'attack_angle_deg' },
  { label: 'Separation', value: 'hip_shoulder_sep_deg' },
  { label: 'Posture', value: 'shoulder_angle_deg' },
  { label: 'Launch Angle', value: 'launch_angle_deg' },
  { label: 'Contact Point', value: 'extension_cm' }
];

export default function Drills() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Filter and search drills
  const filteredDrills = useMemo(() => {
    let filtered = drillsData;

    // Apply metric filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(drill => drill.goalMetric === activeFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(drill =>
        drill.name.toLowerCase().includes(query) ||
        drill.purpose.toLowerCase().includes(query) ||
        metricLabels[drill.goalMetric]?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, activeFilter]);

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
          {/* Title Section */}
          <div className="text-center">
            <h1 className="text-3xl font-black text-white mb-2">⚾ Drills</h1>
            <p className="text-white/60 text-sm mb-2">
              Train smarter with focused movement patterns.
            </p>
            <div className="bg-gradient-to-r from-green-500/50 to-transparent h-[2px] w-1/3 mx-auto rounded-full" />
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search drills…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 px-4 py-3 pl-12 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterOptions.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeFilter === filter.value
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Results Count */}
          <div className="text-white/50 text-sm">
            {filteredDrills.length} {filteredDrills.length === 1 ? 'drill' : 'drills'} found
          </div>

          {/* Drills List */}
          <div className="space-y-4">
            {filteredDrills.map((drill, index) => (
              <Card
                key={drill.id}
                className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer active:scale-[0.97] group animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/drills/${drill.id}`)}
              >
                <div className="p-4">
                  {/* Drill Name */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white leading-tight">
                      🏋️ {drill.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-green-400 group-hover:translate-x-1 transition-transform flex-shrink-0 mt-1" />
                  </div>

                  {/* Purpose */}
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">
                    {drill.purpose}
                  </p>

                  {/* Focus Tag */}
                  <div className="text-green-400 text-xs font-semibold mb-2">
                    Focus: {metricLabels[drill.goalMetric] || drill.goalMetric}
                  </div>

                  {/* Separator */}
                  <div className="border-b border-white/10 my-2" />

                  {/* Equipment */}
                  <div className="text-white/50 text-xs">
                    Equipment: {drill.equipment.join(', ')}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {filteredDrills.length === 0 && (
            <Card className="bg-white/5 border-white/10 rounded-2xl p-8 text-center">
              <p className="text-white/60 mb-2">No drills found</p>
              <p className="text-white/40 text-sm">Try adjusting your search or filter</p>
            </Card>
          )}

          {/* Bottom CTA */}
          {filteredDrills.length > 0 && (
            <Card className="bg-white/5 border-white/10 rounded-2xl p-5 text-center text-white">
              <p className="text-sm text-white/80 mb-4 font-medium">
                💪 Pick a drill and level up your game!
              </p>
              <Button 
                onClick={() => navigate('/analysis')} 
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Record a Swing
              </Button>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
