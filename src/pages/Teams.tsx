import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { JoinTeamModal } from '@/components/JoinTeamModal';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  role: string;
}

export default function Teams() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadTeams();
    }
  }, [user]);

  const loadTeams = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get user's teams with their role
      const { data: memberData, error } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          teams:team_id (
            id,
            name,
            logo_url
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedTeams = (memberData || [])
        .filter(m => m.teams)
        .map(m => ({
          id: (m.teams as any).id,
          name: (m.teams as any).name,
          logo_url: (m.teams as any).logo_url,
          role: m.role
        }));

      setTeams(formattedTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    loadTeams();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <Card className="p-6 text-center bg-white/5 border-white/10 text-white">
          <p>Please log in to view teams</p>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">Loading teams...</div>
          </div>
        ) : teams.length === 0 ? (
          /* Empty State */
          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10 rounded-2xl p-8 text-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Users className="w-10 h-10 text-white/40" />
              </div>
              <h3 className="text-white/80 font-semibold text-lg mb-2">
                You're not on a team yet
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Join an existing team or create your own to get started
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  Join a Team
                </Button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 font-medium text-sm py-2.5 transition-all"
                >
                  Create a Team
                </button>
              </div>
            </Card>
          </div>
        ) : (
          /* Teams List */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-white">My Teams</h1>
              <Button
                onClick={() => setShowJoinModal(true)}
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Join Team
              </Button>
            </div>

            <div className="space-y-3">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all cursor-pointer group"
                  onClick={() => navigate(`/teams/${team.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-emerald-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-base leading-tight mb-1">
                        {team.name}
                      </h3>
                      <Badge 
                        className={`text-xs ${
                          team.role === 'coach' 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-white/10 text-white/60 border-white/20'
                        }`}
                      >
                        {team.role === 'coach' ? 'Coach' : 'Player'}
                      </Badge>
                    </div>

                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              ))}
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 font-medium text-sm py-2.5 transition-all"
            >
              Create New Team
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <JoinTeamModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleSuccess}
        userId={user.id}
      />
      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSuccess}
        userId={user.id}
      />
    </div>
  );
}
