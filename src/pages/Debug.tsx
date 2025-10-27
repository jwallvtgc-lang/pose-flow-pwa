import { useEffect, useState } from 'react';
import { tf } from '@/lib/tf';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppHeader } from '@/components/AppHeader';
import { useNavigate } from 'react-router-dom';

const Debug = () => {
  const navigate = useNavigate();
  const [tfBackend, setTfBackend] = useState<string>('loading...');
  const [supabaseStatus, setSupabaseStatus] = useState<string>('checking...');
  const [posthogStatus, setPosthogStatus] = useState<string>('checking...');

  useEffect(() => {
    const checkDiagnostics = async () => {
      // Check TensorFlow backend
      try {
        setTfBackend(tf.getBackend());
      } catch (error) {
        setTfBackend('error: ' + String(error));
      }

      // Check Supabase auth
      try {
        await supabase.auth.getSession();
        setSupabaseStatus('✅ OK');
      } catch (error) {
        setSupabaseStatus('❌ Error: ' + String(error));
      }

      // Check PostHog
      try {
        posthog.capture('debug_check', { timestamp: Date.now() });
        setPosthogStatus('✅ OK');
      } catch (error) {
        setPosthogStatus('❌ Error: ' + String(error));
      }
    };

    checkDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
      <AppHeader 
        onBack={() => navigate('/')}
      />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Debug Panel</h1>
        
        <div className="space-y-4">
          <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <CardHeader>
              <CardTitle className="text-lg text-white">TensorFlow.js</CardTitle>
              <CardDescription className="text-white/60">Backend status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm text-white/80">{tfBackend}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Supabase</CardTitle>
              <CardDescription className="text-white/60">Authentication client</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/80">{supabaseStatus}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <CardHeader>
              <CardTitle className="text-lg text-white">PostHog</CardTitle>
              <CardDescription className="text-white/60">Analytics capture</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/80">{posthogStatus}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Debug;