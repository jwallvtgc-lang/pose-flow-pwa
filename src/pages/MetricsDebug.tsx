import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type MetricSpec = {
  target: [number, number];
  weight: number;
  invert?: boolean;
  abs_window?: boolean;
};

const MetricsDebug = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Record<string, MetricSpec> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetch('/config/phase1_metrics.json');
        if (!response.ok) {
          throw new Error('Failed to load metrics config');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <Header 
          leftAction={
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          }
        />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-6">Metrics Debug</h1>
          <p className="text-white/60">Loading metrics configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <Header 
          leftAction={
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          }
        />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-6">Metrics Debug</h1>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
      <Header 
        leftAction={
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Metrics Debug</h1>
        
        <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <CardHeader>
            <CardTitle className="text-white">Phase 1 Metrics Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white/80">Metric</TableHead>
                  <TableHead className="text-white/80">Target Range</TableHead>
                  <TableHead className="text-white/80">Weight</TableHead>
                  <TableHead className="text-white/80">Special Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics && Object.entries(metrics).map(([key, spec]) => (
                  <TableRow key={key} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-medium text-white">{key}</TableCell>
                    <TableCell className="text-white/80">{`[${spec.target[0]}, ${spec.target[1]}]`}</TableCell>
                    <TableCell className="text-white/80">{spec.weight}</TableCell>
                    <TableCell>
                      {spec.invert && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs mr-1 border border-yellow-500/30">invert</span>}
                      {spec.abs_window && <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded text-xs border border-cyan-500/30">abs_window</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-sm text-white/60">
          <p>Total metrics: {metrics ? Object.keys(metrics).length : 0}</p>
          <p>Total weight: {metrics ? Object.values(metrics).reduce((sum, spec) => sum + spec.weight, 0) : 0}</p>
        </div>
      </div>
    </div>
  );
};

export default MetricsDebug;