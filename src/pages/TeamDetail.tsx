import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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

type TabType = 'roster' | 'leaderboard' | 'assignments' | 'chat';

interface TeamMessage {
  id: string;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  pinned: boolean | null;
  created_at: string | null;
}

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
  const [dueDate, setDueDate] = useState<Date>();
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (user && id) {
      loadTeamData();
    }
  }, [user, id]);

  useEffect(() => {
    if (activeTab === 'assignments' && id) {
      loadAssignments();
    }
  }, [activeTab, id]);

  const loadAssignments = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('assigned_drills')
        .select(`
          *,
          profiles:player_id(full_name)
        `)
        .eq('team_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && id) {
      loadMessages();
      
      // Poll for new messages every 10 seconds
      const interval = setInterval(() => {
        loadMessages();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, id]);

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

  const loadMessages = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('id, sender_name, sender_role, body, pinned, created_at')
        .eq('team_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !user || !id || !team) return;

    setIsSendingMessage(true);
    try {
      // Determine sender role
      const isCoach = team.coach_id === user.id;
      const senderRole = isCoach ? 'coach' : 'player';

      // Get sender name from userProfile or user email
      const senderName = userProfile?.full_name || user.email?.split('@')[0] || 'Unknown';

      const { error } = await supabase
        .from('team_messages')
        .insert({
          team_id: id,
          sender_id: user.id,
          sender_name: senderName,
          sender_role: senderRole,
          body: messageInput.trim()
        });

      if (error) throw error;

      setMessageInput('');
      await loadMessages();
      
      // Scroll to bottom after message is sent
      setTimeout(() => {
        const chatContainer = document.getElementById('chat-messages');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatMessageTime = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      // Today: show time
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffInDays < 7) {
      // This week: show day and time
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } else {
      // Older: show date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Load user profile for chat sender name
  const [userProfile, setUserProfile] = useState<{ full_name: string | null } | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => setUserProfile(data));
    }
  }, [user]);

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
  const pinnedMessage = messages.find(m => m.pinned);

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
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 min-w-[80px] rounded-xl px-3 py-2.5 text-sm font-bold transition-all text-center ${
              activeTab === 'roster'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Roster
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 min-w-[80px] rounded-xl px-3 py-2.5 text-sm font-bold transition-all text-center ${
              activeTab === 'leaderboard'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex-1 min-w-[80px] rounded-xl px-3 py-2.5 text-sm font-bold transition-all text-center ${
              activeTab === 'assignments'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Assignments
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 min-w-[80px] rounded-xl px-3 py-2.5 text-sm font-bold transition-all text-center ${
              activeTab === 'chat'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            Chat
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

        {activeTab === 'assignments' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-4 text-white flex items-start justify-between">
              <div>
                <div className="text-white font-semibold text-lg flex items-center gap-2">
                  <span>📋</span>
                  <span>Assignments</span>
                </div>
                <div className="text-white/60 text-xs mt-1">
                  Who's working on what
                </div>
              </div>
              {isCoach && (
                <button
                  onClick={() => {
                    setShowAssignDrill(true);
                    setSelectedPlayer(null);
                  }}
                  className="rounded-xl bg-green-500 text-black font-semibold text-sm px-3 py-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-green-400 transition-all active:scale-95"
                >
                  Assign Drill
                </button>
              )}
            </div>

            {/* Assignments List */}
            {assignments.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                <p className="text-white/60 text-sm">No assignments yet</p>
              </div>
            ) : (
              (() => {
                const playerAssignments = new Map();
                assignments.forEach(assignment => {
                  const playerId = assignment.player_id || 'team';
                  const playerName = assignment.player_id 
                    ? (assignment.profiles?.full_name || 'Unknown')
                    : 'Entire Team';
                  
                  if (!playerAssignments.has(playerId)) {
                    playerAssignments.set(playerId, {
                      playerName,
                      avatarInitials: playerName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                      drills: []
                    });
                  }
                  
                  playerAssignments.get(playerId).drills.push({
                    drillName: assignment.drill_name,
                    due: assignment.due_at ? format(new Date(assignment.due_at), 'MMM d') : 'No due date',
                    completed: assignment.completed || false
                  });
                });

                return Array.from(playerAssignments.values()).map((assignment, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-4 text-white"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400/30 to-transparent border border-green-400/40 flex items-center justify-center text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                        {assignment.avatarInitials}
                      </div>
                      <div className="text-white font-semibold text-sm">
                        {assignment.playerName}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {assignment.drills.map((drill: any, drillIdx: number) => (
                        <div key={drillIdx} className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm text-white font-medium">{drill.drillName}</div>
                            <div className="text-[10px] text-white/40 mt-0.5">Due {drill.due}</div>
                          </div>
                          <div className="ml-3">
                            {drill.completed ? (
                              <div className="bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg text-[10px] px-2 py-[2px] font-medium">
                                Done
                              </div>
                            ) : (
                              <div className="bg-white/10 text-white/70 border border-white/20 rounded-lg text-[10px] px-2 py-[2px]">
                                Pending
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-16rem)]">
            {/* Pinned Message */}
            {pinnedMessage && (
              <div className="rounded-2xl bg-white/5 border border-green-500/40 shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white p-4 mb-4">
                <p className="text-green-400 text-xs font-semibold mb-2">📌 Coach update</p>
                <p className="text-white text-sm">{pinnedMessage.body}</p>
              </div>
            )}

            {/* Messages List */}
            <div 
              id="chat-messages"
              className="flex-1 overflow-y-auto space-y-4 mb-4"
            >
              {messages.length === 0 ? (
                <div className="text-center text-white/40 py-12">
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-2">Be the first to say something!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="flex items-start gap-3 text-white">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-xs font-medium border border-white/20 flex-shrink-0">
                      {getInitials(message.sender_name)}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">
                          {message.sender_name || 'Unknown'}
                        </span>
                        {message.sender_role === 'coach' && (
                          <span className="rounded-md bg-green-500/20 text-green-400 text-[10px] font-semibold px-2 py-[2px]">
                            Coach
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm leading-relaxed break-words">
                        {message.body}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="text-white/30 text-[10px] whitespace-nowrap flex-shrink-0">
                      {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Message Input Bar */}
            <div className="sticky bottom-0 left-0 right-0 px-0 py-3 bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center gap-2 -mx-4 px-4">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && messageInput.trim()) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Message the team…"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-green-400"
                disabled={isSendingMessage}
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || isSendingMessage}
                className="rounded-xl bg-green-500 text-black font-semibold text-sm px-4 py-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Send
              </button>
            </div>
          </div>
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
          setDueDate(undefined);
          setAssignToWholeTeam(false);
        }
      }}>
        <DialogContent className="rounded-2xl bg-gradient-to-b from-[#1a2333] to-[#0F172A] border border-white/10 shadow-[0_0_40px_rgba(16,185,129,0.4)] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Assign Drill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Player Selection */}
            <div className="space-y-2">
              <Label className="text-white text-sm">Player</Label>
              <Select 
                value={assignToWholeTeam ? 'entire-team' : selectedPlayer?.user_id || ''} 
                onValueChange={(value) => {
                  if (value === 'entire-team') {
                    setAssignToWholeTeam(true);
                    setSelectedPlayer(null);
                  } else {
                    setAssignToWholeTeam(false);
                    const player = members.find(m => m.user_id === value);
                    setSelectedPlayer(player || null);
                  }
                }}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white min-h-[44px]">
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2333] border-white/10">
                  <SelectItem 
                    value="entire-team"
                    className="text-white hover:bg-white/10"
                  >
                    Entire Team
                  </SelectItem>
                  {members.filter(m => m.role !== 'coach').map((member) => (
                    <SelectItem 
                      key={member.user_id} 
                      value={member.user_id}
                      className="text-white hover:bg-white/10"
                    >
                      {(member.profiles as any)?.full_name || 'Player'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drill Selection */}
            <div className="space-y-2">
              <Label className="text-white text-sm">Drill</Label>
              <Select value={selectedDrill} onValueChange={setSelectedDrill}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white min-h-[44px]">
                  <SelectValue placeholder="Choose a drill..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2333] border-white/10">
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

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-white text-sm">Notes to player</Label>
              <Textarea
                value={drillNotes}
                onChange={(e) => setDrillNotes(e.target.value)}
                placeholder="Keep head still. 3×8 slow reps."
                className="bg-white/10 border-white/20 text-white placeholder-white/40 min-h-[80px]"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-white text-sm">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20 min-h-[44px]",
                      !dueDate && "text-white/40"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#1a2333] border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowAssignDrill(false)}
                className="flex-1 rounded-xl bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log('Assigning drill:', {
                    player: assignToWholeTeam ? 'Entire Team' : selectedPlayer?.user_id,
                    drill: selectedDrill,
                    notes: drillNotes,
                    dueDate: dueDate
                  });
                  
                  if (!selectedDrill || !id) {
                    toast.error('Please select a drill');
                    return;
                  }

                  supabase
                    .from('assigned_drills')
                    .insert({
                      team_id: id,
                      player_id: assignToWholeTeam ? null : selectedPlayer?.user_id,
                      drill_name: selectedDrill,
                      notes: drillNotes.trim() || null,
                      due_at: dueDate?.toISOString() || null
                    })
                    .then(({ error }) => {
                      if (error) {
                        console.error(error);
                        toast.error('Failed to assign drill');
                      } else {
                        toast.success('Drill assigned!');
                        setShowAssignDrill(false);
                        setSelectedPlayer(null);
                        setSelectedDrill('');
                        setDrillNotes('');
                        setDueDate(undefined);
                        setAssignToWholeTeam(false);
                        loadAssignments();
                      }
                    });
                }}
                disabled={!selectedDrill || (!assignToWholeTeam && !selectedPlayer)}
                className="flex-1 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                Assign Drill
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
