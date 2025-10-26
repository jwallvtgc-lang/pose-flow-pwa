import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Copy, UserPlus, AlertCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TeamData {
  id: string;
  name: string;
  logo_url: string | null;
  coach_id: string;
  invite_code: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  };
  avgScore?: number;
}

type TabType = 'roster' | 'leaderboard';

export default function TeamDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('roster');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadTeamData();
    }
  }, [user, id]);

  const loadTeamData = async () => {
    if (!user || !id) return;

    try {
      setIsLoading(true);

      // Load team data
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Load members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('team_id', id);

      if (membersError) throw membersError;

      // Get user's role
      const userMember = membersData?.find(m => m.user_id === user.id);
      if (userMember) {
        setUserRole(userMember.role);
      }

      // Load swing scores for members (placeholder for future implementation)
      // const { data: swingsData } = await supabase
      //   .from('swings')
      //   .select('id, score_phase1, session_id')
      //   .in('session_id', memberIds);

      // Calculate average scores (simplified - placeholder)
      const membersWithScores = (membersData || []).map(member => ({
        ...member,
        avgScore: 0 // Placeholder - would calculate from swings in production
      }));

      // Sort: coaches first, then by name
      membersWithScores.sort((a, b) => {
        if (a.role === 'coach' && b.role !== 'coach') return -1;
        if (a.role !== 'coach' && b.role === 'coach') return 1;
        const nameA = (a.profiles as any)?.full_name || '';
        const nameB = (b.profiles as any)?.full_name || '';
        return nameA.localeCompare(nameB);
      });

      setMembers(membersWithScores);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteCode = () => {
    if (team?.invite_code) {
      navigator.clipboard.writeText(team.invite_code);
      toast.success('Invite code copied to clipboard!');
    }
  };

  const handleLeaveTeam = async () => {
    if (!user || !id) return;

    if (!confirm('Are you sure you want to leave this team?')) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Left team successfully');
      navigate('/teams');
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error('Failed to leave team');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <Card className="p-6 text-center bg-white/5 border-white/10 text-white">
          <p>Please log in to view team details</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <div className="text-white/60">Loading team...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <Card className="p-6 text-center bg-white/5 border-white/10 text-white">
          <p>Team not found</p>
        </Card>
      </div>
    );
  }

  const isCoach = userRole === 'coach';

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
                onClick={() => navigate('/teams')}
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
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Team Header */}
        <Card className="bg-white/5 border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <Users className="w-8 h-8 text-emerald-400" />
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-black text-white mb-2">{team.name}</h1>
              <Badge 
                className={`text-xs ${
                  isCoach
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-white/10 text-white/60 border-white/20'
                }`}
              >
                {isCoach ? 'Coach' : 'Player'}
              </Badge>
            </div>
          </div>

          {/* Invite Code (Coach only) */}
          {isCoach && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-white/60 text-xs mb-2">Team Invite Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-green-400 font-mono text-sm">
                  {team.invite_code}
                </code>
                <Button
                  onClick={copyInviteCode}
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveTab('roster')}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'roster'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Roster
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'roster' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">
                Team Members ({members.length})
              </h3>
            </div>

            {members.map((member) => (
              <Card
                key={member.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30">
                    {(member.profiles as any)?.avatar_url ? (
                      <img 
                        src={(member.profiles as any).avatar_url} 
                        alt={(member.profiles as any)?.full_name || 'User'} 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {((member.profiles as any)?.full_name || 'U')[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className={`text-white text-sm ${member.role === 'coach' ? 'font-bold' : 'font-medium'}`}>
                      {(member.profiles as any)?.full_name || 'Anonymous'}
                    </p>
                    <p className="text-white/50 text-xs">
                      {member.role === 'coach' ? 'Coach' : 'Player'}
                      {member.avgScore && member.avgScore > 0 && ` • Avg: ${member.avgScore}`}
                    </p>
                  </div>

                  {member.role === 'coach' && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      Coach
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/60 text-sm">
              Team leaderboard coming soon!
            </p>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {isCoach && (
            <Button
              onClick={() => toast('Manage team coming soon!')}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              Manage Team
            </Button>
          )}

          {!isCoach && (
            <Button
              onClick={handleLeaveTeam}
              variant="outline"
              className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
            >
              Leave Team
            </Button>
          )}

          <Button
            onClick={() => toast('Assign Drill feature coming soon!')}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Assign Drill
          </Button>
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
