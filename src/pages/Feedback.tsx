import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageCircle, Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-10 w-10 p-0 rounded-2xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-anton font-black text-gray-900">Send Feedback</h1>
        </div>

        <div className="space-y-6">
          {/* Header Card */}
          <Card className="p-6 bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl text-white relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-blue-100 text-sm font-medium mb-1">
                  Help Us Improve
                </div>
                <div className="text-blue-200 text-xs">
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
            <p className="text-blue-100 text-base leading-relaxed">
              Your feedback helps us build better features and improve your SwingSense experience.
            </p>
          </Card>

          {/* Feedback Form */}
          <Card className="p-6 bg-white rounded-3xl border-0 shadow-lg">
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
                <p className="text-gray-600 mb-6">
                  Your feedback has been sent successfully. We appreciate you taking the time to help us improve SwingSense.
                </p>
                <Button 
                  onClick={() => setIsSubmitted(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl"
                >
                  Send More Feedback
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                      Your Name (Optional)
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="mt-1 rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="mt-1 rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="feedbackType" className="text-sm font-medium text-gray-700">
                      Feedback Type
                    </Label>
                    <select
                      id="feedbackType"
                      value={formData.feedbackType}
                      onChange={(e) => handleInputChange('feedbackType', e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="general">General Feedback</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Improvement Suggestion</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                      Your Message *
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us what you think, what could be improved, or what features you'd like to see..."
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="mt-1 rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 min-h-[120px] resize-none"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.message.length}/1000 characters
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.message.trim() || !formData.email.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 rounded-2xl shadow-lg transition-all duration-200 disabled:opacity-50"
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