import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MetricSpec = {
  target: [number, number];
  weight: number;
  invert?: boolean;
  abs_window?: boolean;
};

const MetricsDebug = () => {
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Metrics Debug</h1>
        <p>Loading metrics configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Metrics Debug</h1>
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Metrics Debug</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Phase 1 Metrics Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Target Range</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Special Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics && Object.entries(metrics).map(([key, spec]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">{key}</TableCell>
                  <TableCell>{`[${spec.target[0]}, ${spec.target[1]}]`}</TableCell>
                  <TableCell>{spec.weight}</TableCell>
                  <TableCell>
                    {spec.invert && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs mr-1">invert</span>}
                    {spec.abs_window && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">abs_window</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="mt-6 text-sm text-muted-foreground">
        <p>Total metrics: {metrics ? Object.keys(metrics).length : 0}</p>
        <p>Total weight: {metrics ? Object.values(metrics).reduce((sum, spec) => sum + spec.weight, 0) : 0}</p>
      </div>
    </div>
  );
};

export default MetricsDebug;