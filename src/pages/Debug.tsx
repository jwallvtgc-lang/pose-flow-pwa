import { useEffect, useState } from 'react';
import { tf } from '@/lib/tf';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Debug = () => {
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
    <div className="max-w-[420px] mx-auto px-4 min-h-screen flex flex-col bg-background">
      <div className="py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Debug Panel</h1>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">TensorFlow.js</CardTitle>
              <CardDescription>Backend status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm">{tfBackend}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supabase</CardTitle>
              <CardDescription>Authentication client</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{supabaseStatus}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PostHog</CardTitle>
              <CardDescription>Analytics capture</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{posthogStatus}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Debug;