-- Create athletes for existing users who don't have one
INSERT INTO public.athletes (user_id, name)
SELECT p.id, COALESCE(p.full_name, split_part(p.email, '@', 1), 'Player')
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.athletes a WHERE a.user_id = p.id
)
ON CONFLICT DO NOTHING;