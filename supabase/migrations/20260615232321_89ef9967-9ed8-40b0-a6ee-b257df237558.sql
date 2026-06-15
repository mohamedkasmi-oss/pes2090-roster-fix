
CREATE POLICY "Teams can be deleted by anyone" ON public.teams FOR DELETE USING (true);

WITH suspended AS (
  SELECT id FROM public.teams WHERE is_suspended = true
)
DELETE FROM public.matches
WHERE home_team_id IN (SELECT id FROM suspended)
   OR away_team_id IN (SELECT id FROM suspended);

DELETE FROM public.challenges
WHERE challenger_team_id IN (SELECT id FROM public.teams WHERE is_suspended = true)
   OR challenged_team_id IN (SELECT id FROM public.teams WHERE is_suspended = true);

DELETE FROM public.news
WHERE author_team_id IN (SELECT id FROM public.teams WHERE is_suspended = true);

DELETE FROM public.chat_messages
WHERE team_id IN (SELECT id FROM public.teams WHERE is_suspended = true);

DELETE FROM public.teams WHERE is_suspended = true;
