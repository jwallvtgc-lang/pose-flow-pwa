-- Enable RLS on all tables in public schema
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE swings ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for public read access on drills (they're reference data)
CREATE POLICY "Drills are publicly readable" ON drills FOR SELECT USING (true);

-- Create policies for sessions, swings, and swing_metrics (data will be accessible for now, can be restricted later when auth is added)
CREATE POLICY "Sessions are accessible" ON sessions FOR ALL USING (true);
CREATE POLICY "Swings are accessible" ON swings FOR ALL USING (true);  
CREATE POLICY "Swing metrics are accessible" ON swing_metrics FOR ALL USING (true);
CREATE POLICY "Athletes are accessible" ON athletes FOR ALL USING (true);