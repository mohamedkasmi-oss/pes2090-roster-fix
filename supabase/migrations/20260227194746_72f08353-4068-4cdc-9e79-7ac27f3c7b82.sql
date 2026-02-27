
-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Teams can be updated by anyone" ON public.teams FOR UPDATE USING (true);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  home_score INTEGER,
  away_score INTEGER,
  tournament_type TEXT NOT NULL DEFAULT 'league',
  stage TEXT,
  round INTEGER,
  group_name TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT false,
  is_played BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Matches can be inserted by anyone" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Matches can be updated by anyone" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Matches can be deleted by anyone" ON public.matches FOR DELETE USING (true);

-- Create news table
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_team_id UUID REFERENCES public.teams(id),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News viewable by everyone" ON public.news FOR SELECT USING (true);
CREATE POLICY "News can be inserted" ON public.news FOR INSERT WITH CHECK (true);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  message TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by everyone" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat messages can be inserted" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_team_id UUID REFERENCES public.teams(id) NOT NULL,
  challenged_team_id UUID REFERENCES public.teams(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges viewable by everyone" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Challenges can be inserted" ON public.challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Challenges can be updated" ON public.challenges FOR UPDATE USING (true);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings viewable by everyone" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Settings can be inserted" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Settings can be updated" ON public.app_settings FOR UPDATE USING (true);

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

CREATE POLICY "Chat images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'chat-images');
CREATE POLICY "Anyone can upload chat images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-images');
