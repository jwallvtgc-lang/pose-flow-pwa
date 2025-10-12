import type { CoachingCard } from "@/lib/cues";

export function DrillCard({ card }: { card: CoachingCard }) {
  const drillName = card.drill.name;
  const howTo = card.drill.how_to;
  const equipment = card.drill.equipment;
  const videoUrl = 'video_url' in card.drill ? card.drill.video_url : null;

  return (
    <div className="rounded-2xl p-4 shadow-sm border-border border bg-card text-card-foreground flex flex-col gap-2 transition-all duration-300 card-tilt hover:shadow-lg">
      <div className="text-xs uppercase text-muted-foreground">{card.metric}</div>
      <div className="text-lg font-semibold">{card.cue}</div>
      <div className="text-sm text-muted-foreground">{card.why}</div>
      
      {videoUrl && (
        <div className="mt-3 rounded-lg overflow-hidden bg-muted">
          <video 
            controls 
            className="w-full"
            preload="metadata"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      
      <div className="mt-2">
        <div className="font-medium">Drill: {drillName}</div>
        {howTo && <p className="text-sm mt-1">{howTo}</p>}
        {equipment && (
          <p className="text-xs text-muted-foreground mt-1">Equipment: {equipment}</p>
        )}
      </div>
    </div>
  );
}