import { supabase } from "@/integrations/supabase/client";
import type { Drill } from "./cues";

export async function fetchDrillByNames(names: string[]): Promise<Drill | null> {
  // Try the first hit by exact name; if none, try ilike on alternatives
  const primary = names[0];

  // 1) exact match on primary
  let { data, error } = await supabase
    .from("drills")
    .select("*")
    .eq("name", primary)
    .limit(1);

  if (error) console.warn("fetchDrillByNames error:", error);

  if (data && data.length) return data[0] as Drill;

  // 2) fallback: ilike search on any alt
  const alts = names.slice(1);
  if (alts.length === 0) return null;

  let { data: likeData } = await supabase
    .from("drills")
    .select("*")
    .in("name", alts)
    .limit(1);

  if (likeData && likeData.length) return likeData[0] as Drill;

  return null;
}