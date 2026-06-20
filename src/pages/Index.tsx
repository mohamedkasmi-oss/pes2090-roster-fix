import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Swords, Users } from 'lucide-react';
import trophyAsset from '@/assets/champions-trophy.jpg.asset.json';
import messiHeroVideo from '@/assets/messi-hero.mp4.asset.json';
import messiImg from '@/assets/messi.jpg';
import ronaldoImg from '@/assets/ronaldo.jpg';
import messiChampion from '@/assets/messi-champion.jpg.asset.json';
import ronaldoEmperor from '@/assets/ronaldo-emperor.png.asset.json';

interface TeamStanding {
  id: string;
  name: string;
  coach_name: string;
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
      supabase.from('teams').select('*').neq('access_code', 'KAS2026').order('points', { ascending: false }),
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
      {/* Hero Header with Video Background */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card neon-glow-green p-6 text-center relative overflow-hidden"
      >
        {/* Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={messiHeroVideo.url}
        />
        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-black/60 z-[1]" />

        <div className="relative z-10 flex items-center justify-center gap-8">
          <img
            src={messiImg}
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
            src={ronaldoImg}
            alt="Ronaldo"
            className="w-20 h-20 rounded-full object-cover border-2 border-accent/50 hidden sm:block"
          />
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { type: 'icon' as const, icon: Users, label: 'اللاعبون', value: '20', color: 'text-primary' },
          { type: 'trophy' as const, label: 'البطولات', value: '1', color: 'text-primary' },
          { type: 'icon' as const, icon: Swords, label: 'المباريات', value: recentMatches.length.toString(), color: 'text-secondary' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            {stat.type === 'trophy' ? (
              <img
                src={trophyAsset.url}
                alt="Champions"
                className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(0,255,102,0.6)]"
              />
            ) : (
              <div className={`p-3 rounded-lg bg-muted/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="text-2xl font-orbitron font-bold neon-text-green">{stat.value}</p>
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
                <div className="flex flex-col items-end flex-1 leading-tight">
                  <span className="font-cairo text-sm font-bold">{(match.home_team as any)?.coach_name}</span>
                  <span className="text-[11px] text-muted-foreground">{match.home_team?.name}</span>
                </div>
                <div className="px-4 font-orbitron font-bold text-primary">
                  {match.home_score} - {match.away_score}
                </div>
                <div className="flex flex-col items-start flex-1 leading-tight">
                  <span className="font-cairo text-sm font-bold">{(match.away_team as any)?.coach_name}</span>
                  <span className="text-[11px] text-muted-foreground">{match.away_team?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legends Gallery */}
      <div className="space-y-3">
        <h2 className="text-xl font-orbitron font-bold text-foreground text-center neon-text-green">
          أساطير كرة القدم
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.5 }}
            className="glass-card overflow-hidden relative group cursor-pointer neon-glow-green"
          >
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src={messiChampion.url}
                alt="Messi - بطل العالم"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-4 text-center">
              <h3 className="font-orbitron font-bold text-2xl text-primary neon-text-green">MESSI</h3>
              <p className="font-cairo text-sm text-white/90">بطل العالم 🏆 قطر 2022</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.5 }}
            className="glass-card overflow-hidden relative group cursor-pointer"
          >
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src={ronaldoEmperor.url}
                alt="Ronaldo - إمبراطور البرتغال"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-4 text-center">
              <h3 className="font-orbitron font-bold text-2xl text-accent">RONALDO</h3>
              <p className="font-cairo text-sm text-white/90">إمبراطور البرتغال 🇵🇹</p>
            </div>
          </motion.div>
        </div>
      </div>


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
                    <div className="flex flex-col leading-tight">
                      <span className="font-cairo font-bold">{t.coach_name}</span>
                      <span className="text-[11px] text-muted-foreground">{t.name}</span>
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
