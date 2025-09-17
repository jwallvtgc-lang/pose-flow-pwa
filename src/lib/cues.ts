// lib/cues.ts

// 1) Canonical cue/drill map for Phase 1 metrics
export const CUE_MAP: Record<
  string,
  {
    cue: string;              // one-line, game-ready instruction
    why: string;              // tiny reason coaches can read out loud
    drillName: string;        // name we'll try to fetch from DB (or show as text)
    altDrillNames?: string[]; // optional fallbacks
  }
> = {
  head_drift_cm: {
    cue: "Quiet eyes; brace the front side.",
    why: "Too much head travel hurts tracking & barrel control.",
    drillName: "Wall Head Check",
    altDrillNames: ["Head Still Wall Drill", "Quiet Eyes Wall"]
  },
  attack_angle_deg: {
    cue: "Turn the barrel later; stay through the line-drive window.",
    why: "Downward path reduces solid contact for youth velo.",
    drillName: "PVC Tilt Ladder",
    altDrillNames: ["Tilt Ladder", "PVC Attack Angle"]
  },
  hip_shoulder_sep_deg: {
    cue: "Hold the load; fire hips first, hands last.",
    why: "Better sequence transfers energy up the chain.",
    drillName: "Step-Behind Sequence",
    altDrillNames: ["Step-Behind Separation", "Hip-Lead Step-Behind"]
  },
  bat_lag_deg: {
    cue: "Knob leads; keep the barrel lagging behind.",
    why: "Lag creates bat speed without casting.",
    drillName: "Over/Underload Swings",
    altDrillNames: ["Heavy-Game-Light", "Knob-Lead Ladder"]
  },
  torso_tilt_deg: {
    cue: "Keep an athletic hinge at launch.",
    why: "Stable posture anchors the swing plane.",
    drillName: "PVC Posture Holds",
    altDrillNames: ["Posture Holds", "Hinge & Hold"]
  },
  stride_var_pct: {
    cue: "Repeat the same stride length every time.",
    why: "Consistency = timing you can trust.",
    drillName: "Tape Ladder Strides",
    altDrillNames: ["Stride Ladder", "Stride Tape Drill"]
  },
  finish_balance_idx: {
    cue: "Stick the finish for 2 seconds.",
    why: "Balanced finish = controlled swing path.",
    drillName: "Stick the Finish",
    altDrillNames: ["Freeze Finish", "Hold the Finish"]
  },
  contact_timing_frames: {
    cue: "Let the ball travel; match contact point.",
    why: "Timing inside the window improves barrel quality.",
    drillName: "Contact Point Tee Ladder",
    altDrillNames: ["Tee Ladder", "Let-It-Travel Tee"]
  }
};

// 2) Type for a drill row (matches your Supabase `drills` table MVP)
export type Drill = {
  id?: string;
  name: string;
  goal_metric?: string | null;
  how_to?: string | null;
  equipment?: string | null;
};

// 3) A formatted coaching card we can render
export type CoachingCard = {
  metric: string;
  cue: string;
  why: string;
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
      drill:
        drill ??
        // graceful fallback if DB doesn't have the drill yet
        { name: cfg.drillName, how_to: "See coach card", equipment: "Tee / PVC" }
    });
  }

  return cards;
}