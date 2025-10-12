// lib/cues.ts

// 1) Canonical cue/drill map for Phase 1 metrics
export const CUE_MAP: Record<
  string,
  {
    cue: string;              // one-line, game-ready instruction
    why: string;              // tiny reason coaches can read out loud
    drillName: string;        // name we'll try to fetch from DB (or show as text)
    altDrillNames?: string[]; // optional fallbacks
    instructions: string;     // detailed step-by-step drill instructions
  }
> = {
  head_drift_cm: {
    cue: "Quiet eyes; brace the front side.",
    why: "Too much head travel hurts tracking & barrel control.",
    drillName: "Wall Head Check",
    altDrillNames: ["Head Still Wall Drill", "Quiet Eyes Wall"],
    instructions: "Stand arm's length from a wall. Set up in batting stance with head gently touching wall. Take slow swings keeping head pressed against wall throughout. Focus on tracking an imaginary ball without moving your head. Repeat 10-15 swings daily."
  },
  attack_angle_deg: {
    cue: "Turn the barrel later; stay through the line-drive window.",
    why: "Downward path reduces solid contact for youth velo.",
    drillName: "PVC Tilt Ladder",
    altDrillNames: ["Tilt Ladder", "PVC Attack Angle"],
    instructions: "Set up 3 tees at different heights: low, middle, high. Place PVC pipe angled upward behind tees. Practice swinging under the pipe, hitting balls with slight upward angle. Start low and work up the ladder. Focus on barrel staying in the zone longer."
  },
  hip_shoulder_sep_deg: {
    cue: "Hold the load; fire hips first, hands last.",
    why: "Better sequence transfers energy up the chain.",
    drillName: "Step-Behind Sequence",
    altDrillNames: ["Step-Behind Separation", "Hip-Lead Step-Behind"],
    instructions: "Start in loaded position. Step back foot behind front foot while keeping shoulders closed. Feel hips opening while hands stay back. Slowly swing through, feeling hips lead the sequence. Emphasize the stretch between hips and shoulders. 10 reps slowly, then 10 at game speed."
  },
  bat_lag_deg: {
    cue: "Knob leads; keep the barrel lagging behind.",
    why: "Lag creates bat speed without casting.",
    drillName: "Over/Underload Swings",
    altDrillNames: ["Heavy-Game-Light", "Knob-Lead Ladder"],
    instructions: "Use heavy bat (donut/weighted) for 5 swings focusing on knob leading to contact. Then regular bat for 5 swings maintaining same feel. Finish with light bat (fungo) for 5 swings. Focus on knob-to-ball path. Feel the barrel 'whipping' through late. Rest and repeat 3 sets."
  },
  torso_tilt_deg: {
    cue: "Keep an athletic hinge at launch.",
    why: "Stable posture anchors the swing plane.",
    drillName: "PVC Posture Holds",
    altDrillNames: ["Posture Holds", "Hinge & Hold"],
    instructions: "Hold PVC pipe across shoulders behind neck. Set up in batting stance with proper spine angle. Practice loading and launching while maintaining spine tilt. Hold finish position for 3 seconds. Feel athletic posture throughout. Do 10 slow motion swings, then 10 at normal speed."
  },
  stride_var_pct: {
    cue: "Repeat the same stride length every time.",
    why: "Consistency = timing you can trust.",
    drillName: "Tape Ladder Strides",
    altDrillNames: ["Stride Ladder", "Stride Tape Drill"],
    instructions: "Place tape marks on ground: one for back foot start, one for front foot landing. Practice 20 swings hitting exact tape marks every time. Use same timing and rhythm. Focus on repeatable stride length and timing. Progress to live pitching while maintaining consistent stride pattern."
  },
  finish_balance_idx: {
    cue: "Stick the finish for 2 seconds.",
    why: "Balanced finish = controlled swing path.",
    drillName: "Stick the Finish",
    altDrillNames: ["Freeze Finish", "Hold the Finish"],
    instructions: "Take normal swing off tee. Hold finish position for full 2 seconds without wobbling or adjusting feet. Weight should be balanced on front foot. Practice until you can stick 10 consecutive finishes. Then progress to soft toss and live pitching while maintaining balance."
  },
  contact_timing_frames: {
    cue: "Let the ball travel; match contact point.",
    why: "Timing inside the window improves barrel quality.",
    drillName: "Contact Point Tee Ladder",
    altDrillNames: ["Tee Ladder", "Let-It-Travel Tee"],
    instructions: "Set up 5 tees: back of plate, middle, front of plate, and two more out front. Hit balls progressing from back to front, adjusting timing to let ball travel deeper. Feel how hands and barrel adjust for each position. Work on consistent contact quality at each point. 5 swings per tee position."
  }
};

// 2) Type for a drill row (matches your Supabase `drills` table MVP)
export type Drill = {
  id?: string;
  name: string;
  goal_metric?: string | null;
  how_to?: string | null;
  equipment?: string | null;
  video_url?: string | null;
};

// 3) A formatted coaching card we can render
export type CoachingCard = {
  metric: string;
  cue: string;
  why: string;
  instructions: string;
  drill: Drill | { name: string; how_to?: string; equipment?: string }; // fallback inline
};

// 4) Core: map metrics -> two cue/drill cards
//    Provide a Supabase fetcher so this stays UI-agnostic.
export async function buildCoachingCards(
  weakestMetrics: string[],
  fetchDrillByNames: (names: string[]) => Promise<Drill | null>
): Promise<CoachingCard[]> {
  const cards: CoachingCard[] = [];

  for (const metric of weakestMetrics.slice(0, 2)) {
    const cfg = CUE_MAP[metric];
    if (!cfg) continue;

    const names = [cfg.drillName, ...(cfg.altDrillNames ?? [])];
    const drill = await fetchDrillByNames(names);

    cards.push({
      metric,
      cue: cfg.cue,
      why: cfg.why,
      instructions: cfg.instructions,
      drill:
        drill ??
        // graceful fallback if DB doesn't have the drill yet
        { name: cfg.drillName, how_to: cfg.instructions, equipment: "Tee / PVC" }
    });
  }

  return cards;
}