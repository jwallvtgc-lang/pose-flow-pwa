import { metricSpecs, type MetricSpecs } from "@/config/phase1_metrics";

export function scorePhase1FromValues(
  values: Record<string, number>,
  specs: MetricSpecs = metricSpecs
) {
  console.log('=== SCORING DEBUG ===');
  console.log('Input values:', values);
  
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

    // Normalize: target range gets score of 1.0, values outside get lower scores
    let normalized: number;
    if (v >= lo && v <= hi) {
      // Inside target range = perfect score
      normalized = 1.0;
    } else if (v < lo) {
      // Below target: score decreases based on distance
      const distance = lo - v;
      const range = hi - lo;
      normalized = Math.max(0, 1 - distance / range);
    } else {
      // Above target: score decreases based on distance
      const distance = v - hi;
      const range = hi - lo;
      normalized = Math.max(0, 1 - distance / range);
    }

    // Flip score if "invert" (smaller = better)
    if ('invert' in spec && spec.invert) normalized = 1 - normalized;

    acc += normalized * spec.weight;
    totalWeight += spec.weight;
    contributions.push({ metric, score: normalized, weight: spec.weight });
  }

  const finalScore = totalWeight > 0 ? Math.round((acc / totalWeight) * 100) : 0;

  console.log('Contributions by metric:');
  contributions.forEach(c => {
    const spec = specs[c.metric];
    const rawValue = values[c.metric];
    console.log(`  ${c.metric}: raw=${rawValue?.toFixed(2)}, normalized=${c.score.toFixed(3)}, weight=${c.weight}, target=[${spec.target[0]}, ${spec.target[1]}]`);
  });
  console.log('Final score:', finalScore);
  console.log('===================');

  // Sort by weakest (lowest normalized score)
  contributions.sort((a, b) => a.score - b.score);
  const weakest = contributions.slice(0, 2).map((c) => c.metric);

  return { score: finalScore, weakest, contributions };
}