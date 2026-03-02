import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Trophy, Swords, Users } from 'lucide-react';

interface TeamStanding {
  id: string;
  name: string;
  logo_url: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
}

interface Match {
  id: string;
  home_score: number | null;
  away_score: number | null;
  tournament_type: string;
  stage: string | null;
  is_played: boolean;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}

const Index = () => {
  const { team } = useAuth();
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [teamsRes, matchesRes] = await Promise.all([
      supabase.from('teams').select('*').order('points', { ascending: false }),
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
        .eq('is_visible', true)
        .eq('is_played', true)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    if (teamsRes.data) {
      const sorted = [...teamsRes.data].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goals_for - a.goals_against;
        const gdB = b.goals_for - b.goals_against;
        if (gdB !== gdA) return gdB - gdA;
        if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
        return a.goals_against - b.goals_against;
      });
      setStandings(sorted as TeamStanding[]);
    }
    if (matchesRes.data) setRecentMatches(matchesRes.data as unknown as Match[]);
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card neon-glow-green p-6 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
        <div className="relative z-10 flex items-center justify-center gap-8">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Lionel_Messi_20180626.jpg/220px-Lionel_Messi_20180626.jpg"
            alt="Messi"
            className="w-20 h-20 rounded-full object-cover border-2 border-primary/50 hidden sm:block"
          />
          <div>
            <h1 className="text-4xl md:text-5xl font-orbitron font-black text-primary neon-text-green">
              PES 2090
            </h1>
            <p className="text-muted-foreground font-cairo mt-1">عالم كرة القدم الافتراضي</p>
            <p className="text-sm text-accent font-cairo mt-1">
              مرحباً، {team?.coach_name} — {team?.name}
            </p>
          </div>
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/220px-Cristiano_Ronaldo_2018.jpg"
            alt="Ronaldo"
            className="w-20 h-20 rounded-full object-cover border-2 border-accent/50 hidden sm:block"
          />
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'الفرق', value: '16', color: 'text-primary' },
          { icon: Trophy, label: 'البطولات', value: '3', color: 'text-accent' },
          { icon: Swords, label: 'المباريات', value: recentMatches.length.toString(), color: 'text-secondary' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg bg-muted/50 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-orbitron font-bold">{stat.value}</p>
              <p className="text-muted-foreground text-sm font-cairo">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-orbitron font-bold text-foreground">آخر النتائج</h2>
          <div className="grid gap-3">
            {recentMatches.map((match) => (
              <div key={match.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="font-cairo text-sm">{match.home_team?.name}</span>
                  <img src={match.home_team?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                </div>
                <div className="px-4 font-orbitron font-bold text-primary">
                  {match.home_score} - {match.away_score}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <img src={match.away_team?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                  <span className="font-cairo text-sm">{match.away_team?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standings Preview */}
      <div className="space-y-3">
        <h2 className="text-xl font-orbitron font-bold text-foreground">ترتيب الفرق</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground font-cairo">
                <th className="p-3 text-right">#</th>
                <th className="p-3 text-right">الفريق</th>
                <th className="p-3 text-center">ف</th>
                <th className="p-3 text-center">ت</th>
                <th className="p-3 text-center">خ</th>
                <th className="p-3 text-center">أ+</th>
                <th className="p-3 text-center">أ-</th>
                <th className="p-3 text-center font-bold text-primary">نقاط</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${
                    t.id === team?.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <td className="p-3 font-orbitron text-muted-foreground">{i + 1}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <img src={t.logo_url || ''} alt="" className="w-5 h-5 object-contain" />
                      <span className="font-cairo">{t.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">{t.wins}</td>
                  <td className="p-3 text-center">{t.draws}</td>
                  <td className="p-3 text-center">{t.losses}</td>
                  <td className="p-3 text-center text-primary">{t.goals_for}</td>
                  <td className="p-3 text-center text-destructive">{t.goals_against}</td>
                  <td className="p-3 text-center font-orbitron font-bold text-primary">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Index;
