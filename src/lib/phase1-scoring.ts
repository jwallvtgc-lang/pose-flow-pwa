import { metricSpecs, type MetricSpec, type MetricSpecs } from "@/config/phase1_metrics";

export function scorePhase1FromValues(
  values: Record<string, number>,
  specs: MetricSpecs = metricSpecs
) {
  let totalWeight = 0;
  let acc = 0;
  const contributions: { metric: string; score: number; weight: number }[] = [];

  for (const [metric, spec] of Object.entries(specs)) {
    const raw = values[metric];
    if (raw == null || isNaN(raw)) continue;

    const [lo, hi] = spec.target;
    let v = raw;

    // If abs_window: check how far outside the band you are
    if ('abs_window' in spec && spec.abs_window) {
      if (raw < lo) v = lo - Math.abs(lo - raw);
      if (raw > hi) v = hi + Math.abs(raw - hi);
    }

    // Normalize raw value into [0,1] within the target band
    let normalized = (v - lo) / (hi - lo);
    normalized = Math.max(0, Math.min(1, normalized));

    // Flip score if "invert" (smaller = better)
    if ('invert' in spec && spec.invert) normalized = 1 - normalized;

    acc += normalized * spec.weight;
    totalWeight += spec.weight;
    contributions.push({ metric, score: normalized, weight: spec.weight });
  }

  const finalScore = totalWeight > 0 ? Math.round((acc / totalWeight) * 100) : 0;

  // Sort by weakest (lowest normalized score)
  contributions.sort((a, b) => a.score - b.score);
  const weakest = contributions.slice(0, 2).map((c) => c.metric);

  return { score: finalScore, weakest, contributions };
}