import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ProfileData {
  full_name: string;
  email: string;
  height_feet: number | '';
  height_inches: number | '';
  weight_lbs: number | '';
  primary_position: string;
  current_team: string;
}

const positions = ['1B', '2B', 'SS', '3B', 'P', 'C', 'LF', 'RF', 'CF'];

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    height_feet: '',
    height_inches: '',
    weight_lbs: '',
    primary_position: '',
    current_team: '',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-center flex-1">
            <div className="bg-gradient-to-r from-blue-500 to-teal-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="text-gray-600">Update your personal information and baseball details</p>
          </div>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Keep your profile up to date for better personalized analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={profile.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            {/* Height */}
            <div className="space-y-2">
              <Label>Height</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    type="number"
                    value={profile.height_feet}
                    onChange={(e) => handleInputChange('height_feet', e.target.value)}
                    placeholder="5"
                    min="3"
                    max="8"
                  />
                  <Label className="text-xs text-gray-500">Feet</Label>
                </div>
                <div>
                  <Input
                    type="number"
                    value={profile.height_inches}
                    onChange={(e) => handleInputChange('height_inches', e.target.value)}
                    placeholder="10"
                    min="0"
                    max="11"
                  />
                  <Label className="text-xs text-gray-500">Inches</Label>
                </div>
              </div>
            </div>

            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                value={profile.weight_lbs}
                onChange={(e) => handleInputChange('weight_lbs', e.target.value)}
                placeholder="165"
              />
            </div>

            {/* Primary Position */}
            <div className="space-y-2">
              <Label htmlFor="position">Primary Position</Label>
              <Select
                value={profile.primary_position}
                onValueChange={(value) => handleInputChange('primary_position', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your primary position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Team */}
            <div className="space-y-2">
              <Label htmlFor="team">Current Team</Label>
              <Input
                id="team"
                type="text"
                value={profile.current_team}
                onChange={(e) => handleInputChange('current_team', e.target.value)}
                placeholder="Enter your team name"
              />
            </div>

            {/* Save Button */}
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}