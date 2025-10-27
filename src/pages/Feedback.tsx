import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppHeader } from '@/components/AppHeader';

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    feedbackType: 'general',
    message: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.message.trim()) {
      toast.error('Please provide your feedback message');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Please provide your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Call the edge function to send feedback
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: {
          name: formData.name.trim() || 'Anonymous User',
          email: formData.email.trim(),
          feedbackType: formData.feedbackType,
          message: formData.message.trim(),
          userId: user?.id || null,
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast.success('Feedback sent successfully! Thank you for helping us improve.');
      setIsSubmitted(true);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        feedbackType: 'general',
        message: ''
      });
      
    } catch (err) {
      console.error('Failed to send feedback:', err);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
      <AppHeader 
        onBack={() => navigate('/')}
      />
      
      <div className="container mx-auto px-4 py-6 max-w-lg">
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="p-6 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl text-white relative overflow-hidden border-0 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white/90 text-sm font-medium mb-1">
                  Help Us Improve
                </div>
                <div className="text-white/70 text-xs">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Share Your Thoughts</h2>
            <p className="text-white/90 text-base leading-relaxed">
              Your feedback helps us build better features and improve your SwingSense experience.
            </p>
          </Card>

          {/* Feedback Form */}
          <Card className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                <p className="text-white/60 mb-6">
                  Your feedback has been sent successfully. We appreciate you taking the time to help us improve SwingSense.
                </p>
                <Button 
                  onClick={() => setIsSubmitted(false)}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  Send More Feedback
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-white">
                      Your Name (Optional)
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="mt-1 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-white">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="mt-1 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="feedbackType" className="text-sm font-medium text-white">
                      Feedback Type
                    </Label>
                    <select
                      id="feedbackType"
                      value={formData.feedbackType}
                      onChange={(e) => handleInputChange('feedbackType', e.target.value)}
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-emerald-500 focus:ring-emerald-500/20"
                    >
                      <option value="general">General Feedback</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Improvement Suggestion</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-sm font-medium text-white">
                      Your Message *
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us what you think, what could be improved, or what features you'd like to see..."
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="mt-1 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20 min-h-[120px] resize-none"
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      {formData.message.length}/1000 characters
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.message.trim() || !formData.email.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-200 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Feedback
                    </div>
                  )}
                </Button>
              </form>
            )}
          </Card>

          {/* Additional Info Card */}
          <Card className="p-6 bg-blue-50 rounded-3xl border-0">
            <h3 className="text-lg font-bold text-gray-900 mb-3">What Happens Next?</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                We'll review your feedback within 24-48 hours
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                For bug reports, we'll investigate and prioritize fixes
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                Feature requests help shape our roadmap
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                We may follow up via email if we need more details
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}