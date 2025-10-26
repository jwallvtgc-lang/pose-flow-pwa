import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function CreateTeamModal({ isOpen, onClose, onSuccess, userId }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Generate a 6-character invite code
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setIsLoading(true);

    try {
      // Generate invite code
      const inviteCode = generateInviteCode();

      // Create team with coach_id and invite_code
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{
          name: teamName.trim(),
          coach_id: userId,
          invite_code: inviteCode
        }])
        .select('id')
        .single();

      if (teamError) throw teamError;

      // Add creator as coach member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: team.id,
          user_id: userId,
          role: 'coach'
        }]);

      if (memberError) throw memberError;

      toast.success('Team created successfully!');
      setTeamName('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast.error(error?.message || 'Failed to create team');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#0F172A] to-black border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(16,185,129,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-black text-xl">Create a Team</h2>
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
              Team Name
            </label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name..."
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 font-medium text-sm py-2.5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTeam}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold text-sm py-2.5 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
