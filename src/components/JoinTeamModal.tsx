import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JoinTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function JoinTeamModal({ isOpen, onClose, onSuccess, userId }: JoinTeamModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter a team code');
      return;
    }

    setIsLoading(true);

    try {
      // Find team by invite code
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('invite_code', inviteCode.trim())
        .maybeSingle();

      if (teamError) throw teamError;

      if (!team) {
        toast.error('Invalid team code');
        setIsLoading(false);
        return;
      }

      // Check if already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingMember) {
        toast.error('You are already a member of this team');
        setIsLoading(false);
        return;
      }

      // Join team as player
      const { error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          role: 'player'
        });

      if (insertError) throw insertError;

      toast.success('Successfully joined the team!');
      setInviteCode('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error joining team:', error);
      toast.error('Failed to join team');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#0F172A] to-black border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(16,185,129,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-black text-xl">Join a Team</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <label className="text-white/80 text-sm font-medium mb-2 block">
              Team Invite Code
            </label>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter code..."
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
            <p className="text-white/50 text-xs mt-2">
              Ask your coach for the team invite code
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTeam}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              {isLoading ? 'Joining...' : 'Join Team'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
