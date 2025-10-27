import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Users, Copy, UserPlus, AlertCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { drillsData } from '@/lib/drillsData';

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

type TabType = 'roster' | 'leaderboard' | 'drills';

export default function TeamDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('roster');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<TeamMember | null>(null);
  const [showAssignDrill, setShowAssignDrill] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState<string>('');
  const [drillNotes, setDrillNotes] = useState('');
  const [assignToWholeTeam, setAssignToWholeTeam] = useState(false);

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
        .maybeSingle();

      if (teamError) throw teamError;
      
      if (!teamData) {
        toast.error('Team not found or you do not have access');
        setIsLoading(false);
        return;
      }
      
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

      // Load swing scores for members
      const memberUserIds = (membersData || []).map(m => m.user_id);
      
      // Query for swings via sessions -> athletes -> user_id
      const { data: swingsData } = await supabase
        .from('swings')
        .select(`
          score_phase1,
          sessions!inner(
            athletes!inner(
              user_id
            )
          )
        `)
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      // Calculate average scores by user_id
      const scoresByUser = new Map<string, number[]>();
      (swingsData || []).forEach((swing: any) => {
        const userId = swing.sessions?.athletes?.user_id;
        if (userId && memberUserIds.includes(userId)) {
          if (!scoresByUser.has(userId)) {
            scoresByUser.set(userId, []);
          }
          scoresByUser.get(userId)!.push(swing.score_phase1);
        }
      });

      // Calculate average scores
      const membersWithScores = (membersData || []).map(member => {
        const scores = scoresByUser.get(member.user_id) || [];
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : undefined;
        return {
          ...member,
          avgScore
        };
      });

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

  const handleAssignDrill = async () => {
    if (!selectedDrill || !id) {
      toast.error('Please select a drill');
      return;
    }

    try {
      const assignmentData = {
        team_id: id,
        player_id: assignToWholeTeam ? null : selectedPlayer?.user_id,
        drill_name: selectedDrill,
        notes: drillNotes.trim() || null
      };

      const { error } = await supabase
        .from('assigned_drills')
        .insert(assignmentData);

      if (error) throw error;

      toast.success(assignToWholeTeam ? 'Drill assigned to whole team!' : 'Drill assigned to player!');
      setShowAssignDrill(false);
      setSelectedPlayer(null);
      setSelectedDrill('');
      setDrillNotes('');
      setAssignToWholeTeam(false);
    } catch (error) {
      console.error('Error assigning drill:', error);
      toast.error('Failed to assign drill');
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
                  className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
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
          <button
            onClick={() => setActiveTab('drills')}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'drills'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Drills
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'roster' && (
          <div className="space-y-3">
            {/* Invite Code Box (Coach only) */}
            {isCoach && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                <p className="text-white/80 text-sm font-medium">Share this team code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2.5 text-green-400 font-mono text-lg font-bold tracking-wider">
                    {team?.invite_code}
                  </code>
                  <Button
                    onClick={copyInviteCode}
                    size="sm"
                    className="bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 h-10"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-white/40 text-xs">Players can join from Teams → Join Team</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">
                Team Members ({members.length})
              </h3>
            </div>

            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => {
                  if (isCoach && member.role !== 'coach') {
                    setSelectedPlayer(member);
                    setShowAssignDrill(true);
                  }
                }}
                className={`flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-4 text-white transition-all ${
                  isCoach && member.role !== 'coach' ? 'cursor-pointer hover:bg-white/10 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]' : ''
                }`}
              >
                {/* Left side */}
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

                  <div>
                    <p className="text-white font-semibold text-sm">
                      {(member.profiles as any)?.full_name || 'Anonymous'}
                    </p>
                    <div className="mt-1">
                      {member.role === 'coach' ? (
                        <span className="inline-block bg-green-500/20 text-green-400 text-[11px] font-semibold rounded-md px-2 py-[2px]">
                          Coach
                        </span>
                      ) : (
                        <span className="inline-block bg-white/10 text-white/60 text-[11px] rounded-md px-2 py-[2px]">
                          Player
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side */}
                <div className="text-right">
                  {member.avgScore !== undefined ? (
                    <p className="text-green-400 font-semibold text-sm">Score: {member.avgScore}</p>
                  ) : (
                    <p className="text-white/40 text-sm">No swings yet</p>
                  )}
                </div>
              </div>
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

        {activeTab === 'drills' && (
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/60 text-sm">
              Assigned drills coming soon!
            </p>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {isCoach && (
            <Button
              onClick={() => toast('Manage team coming soon!')}
              className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/20"
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

      {/* Assign Drill Modal (Coach only) */}
      <Dialog open={showAssignDrill} onOpenChange={(open) => {
        setShowAssignDrill(open);
        if (!open) {
          setSelectedPlayer(null);
          setSelectedDrill('');
          setDrillNotes('');
          setAssignToWholeTeam(false);
        }
      }}>
        <DialogContent className="bg-gradient-to-b from-[#0F172A]/95 to-black/95 backdrop-blur-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Assign Drill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 rounded-xl bg-white/5 border border-white/10 p-3">
              <Checkbox 
                id="wholeTeam" 
                checked={assignToWholeTeam}
                onCheckedChange={(checked) => setAssignToWholeTeam(checked === true)}
              />
              <Label htmlFor="wholeTeam" className="text-white text-sm cursor-pointer">
                Assign to whole team
              </Label>
            </div>

            {!assignToWholeTeam && selectedPlayer && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-white/60 text-xs mb-1">Assigning to:</p>
                <p className="text-white font-semibold">
                  {(selectedPlayer.profiles as any)?.full_name || 'Player'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white text-sm">Select Drill</Label>
              <Select value={selectedDrill} onValueChange={setSelectedDrill}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Choose a drill..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0F172A] border-white/10">
                  {drillsData.map((drill) => (
                    <SelectItem 
                      key={drill.id} 
                      value={drill.name}
                      className="text-white hover:bg-white/10"
                    >
                      {drill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white text-sm">Notes (Optional)</Label>
              <Textarea
                placeholder="What do you want them focusing on?"
                value={drillNotes}
                onChange={(e) => setDrillNotes(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[100px]"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowAssignDrill(false);
                  setSelectedPlayer(null);
                  setSelectedDrill('');
                  setDrillNotes('');
                  setAssignToWholeTeam(false);
                }}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignDrill}
                disabled={!selectedDrill}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Detail Modal (Coach only - deprecated, replaced by assign drill) */}
      <Dialog open={!!selectedPlayer && !showAssignDrill} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <DialogContent className="bg-[#0F172A] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {(selectedPlayer?.profiles as any)?.full_name || 'Player'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-white/60 text-sm mb-1">Average Score</p>
              {selectedPlayer?.avgScore !== undefined ? (
                <p className="text-green-400 font-bold text-2xl">{selectedPlayer.avgScore}</p>
              ) : (
                <p className="text-white/40 text-sm">No swings yet</p>
              )}
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <AlertCircle className="w-10 h-10 text-white/40 mx-auto mb-2" />
              <p className="text-white/60 text-sm">
                Drill assignment and player stats coming soon!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
