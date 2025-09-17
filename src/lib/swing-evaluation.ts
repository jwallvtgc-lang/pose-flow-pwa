import { scorePhase1FromValues } from "@/lib/phase1-scoring";
import { buildCoachingCards } from "@/lib/cues";
import { fetchDrillByNames } from "@/lib/drills";

export async function evaluateSwing(values: Record<string, number>) {
  const { score, weakest } = scorePhase1FromValues(values);

  // Build the two coaching cards from the weakest metrics
  const cards = await buildCoachingCards(weakest, fetchDrillByNames);

  return { score, weakest, cards };
}