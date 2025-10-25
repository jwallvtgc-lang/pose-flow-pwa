import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Save, Loader2, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import headerLogo from '@/assets/swingsense-header.png';

interface ProfileData {
  full_name: string;
  email: string;
  height_feet: number | '';
  height_inches: number | '';
  weight_lbs: number | '';
  primary_position: string;
  current_team: string;
  avatar_url: string | null;
}

const positions = ['1B', '2B', 'SS', '3B', 'P', 'C', 'LF', 'RF', 'CF'];

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    height_feet: '',
    height_inches: '',
    weight_lbs: '',
    primary_position: '',
    current_team: '',
    avatar_url: null,
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          height_feet: data.height_feet || '',
          height_inches: data.height_inches || '',
          weight_lbs: data.weight_lbs || '',
          primary_position: data.primary_position || '',
          current_team: data.current_team || '',
          avatar_url: data.avatar_url || null,
        });
      } else {
        // Create profile if it doesn't exist
        setProfile(prev => ({
          ...prev,
          email: user.email || '',
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (profile.height_feet !== '' && (Number(profile.height_feet) < 3 || Number(profile.height_feet) > 8)) {
      toast({
        title: "Invalid Height",
        description: "Height must be between 3-8 feet",
        variant: "destructive",
      });
      return;
    }

    if (profile.height_inches !== '' && (Number(profile.height_inches) < 0 || Number(profile.height_inches) > 11)) {
      toast({
        title: "Invalid Height",
        description: "Inches must be between 0-11",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      const profileData = {
        id: user.id,
        full_name: profile.full_name,
        email: profile.email,
        height_feet: profile.height_feet === '' ? null : Number(profile.height_feet),
        height_inches: profile.height_inches === '' ? null : Number(profile.height_inches),
        weight_lbs: profile.weight_lbs === '' ? null : Number(profile.weight_lbs),
        primary_position: profile.primary_position,
        current_team: profile.current_team,
        avatar_url: profile.avatar_url,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black relative">
      {/* Vignette overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      
      {/* BRANDED HEADER BAR */}
      <header className="relative w-full h-16 bg-gradient-to-b from-[#0F172A] to-black border-b border-white/10 mb-6">
        {/* Left Action - Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full text-white hover:text-white bg-white/10 hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Centered Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
          <img
            src={headerLogo}
            alt="SwingSense"
            className="h-10 w-auto max-w-[70%] md:max-w-[320px] animate-[logoentrance_0.5s_ease-out,glowpulse_7s_ease-in-out_infinite]"
          />
        </div>
      </header>
      
      <div className="max-w-2xl mx-auto px-4 py-4 relative z-10">
        {/* Profile Content */}
        <div className="text-center mb-8">
            {/* Avatar Section with Ambient Glow */}
            <div className="relative mx-auto mb-4 w-24 h-24">
              {/* Animated green glow behind avatar */}
              <div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[125%] h-[125%] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.15) 40%, transparent 70%)',
                  filter: 'blur(40px)',
                  animation: 'glowpulse 7s ease-in-out infinite'
                }}
              />
              
              <Avatar className="relative z-10 w-24 h-24 border-2 border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-2xl">
                  {profile.full_name ? profile.full_name[0].toUpperCase() : <User className="w-12 h-12" />}
                </AvatarFallback>
              </Avatar>
              <label 
                htmlFor="avatar-upload" 
                className="absolute bottom-0 right-0 bg-green-500 text-white p-2 rounded-full cursor-pointer hover:bg-green-600 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-110 z-20"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">
              {profile.full_name || 'Profile'}
            </h1>
            {(profile.current_team || profile.primary_position) && (
              <p className="text-white/60 text-sm mb-1">
                {[profile.current_team, profile.primary_position].filter(Boolean).join(' · ')}
              </p>
            )}
            {profile.email && (
              <p className="text-white/50 text-xs">{profile.email}</p>
            )}
          </div>

        {/* Profile Form */}
        <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 p-6 mb-6 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white tracking-tight mb-2">Personal Information</h2>
            <div className="h-[1px] w-3/5 bg-gradient-to-r from-green-500/60 to-transparent mb-3" />
            <p className="text-white/50 text-sm">
              Keep your profile up to date for better personalized analytics
            </p>
          </div>
          
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80 font-medium">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={profile.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter your full name"
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80 font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>

            <div className="border-b border-white/10 my-4" />

            {/* Height */}
            <div className="space-y-2">
              <Label className="text-white/80 font-medium">Height</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    type="number"
                    value={profile.height_feet}
                    onChange={(e) => handleInputChange('height_feet', e.target.value)}
                    placeholder="5"
                    min="3"
                    max="8"
                    className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                  <Label className="text-xs text-white/50 mt-1">Feet</Label>
                </div>
                <div>
                  <Input
                    type="number"
                    value={profile.height_inches}
                    onChange={(e) => handleInputChange('height_inches', e.target.value)}
                    placeholder="10"
                    min="0"
                    max="11"
                    className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                  <Label className="text-xs text-white/50 mt-1">Inches</Label>
                </div>
              </div>
            </div>

            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-white/80 font-medium">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                value={profile.weight_lbs}
                onChange={(e) => handleInputChange('weight_lbs', e.target.value)}
                placeholder="165"
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>

            <div className="border-b border-white/10 my-4" />

            {/* Primary Position */}
            <div className="space-y-2">
              <Label htmlFor="position" className="text-white/80 font-medium">Primary Position</Label>
              <Select
                value={profile.primary_position}
                onValueChange={(value) => handleInputChange('primary_position', value)}
              >
                <SelectTrigger className="rounded-xl bg-white/5 border-white/10 text-white focus:ring-green-500/50 focus:border-green-500/50">
                  <SelectValue placeholder="Select your primary position" className="text-white/40" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1f2e] border-white/10">
                  {positions.map((position) => (
                    <SelectItem 
                      key={position} 
                      value={position}
                      className="text-white hover:bg-white/10 focus:bg-white/10"
                    >
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Team */}
            <div className="space-y-2">
              <Label htmlFor="team" className="text-white/80 font-medium">Current Team</Label>
              <Input
                id="team"
                type="text"
                value={profile.current_team}
                onChange={(e) => handleInputChange('current_team', e.target.value)}
                placeholder="Enter your team name"
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>

            {/* Save Button */}
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] mt-8"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.6));
          }
        }
        
        @keyframes logoentrance {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
