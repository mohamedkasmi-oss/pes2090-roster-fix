import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  is_played: boolean;
  is_visible: boolean;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}

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
  played: number;
}

const recalculateLeagueTable = async () => {
  // 1. Fetch all played league matches
  const { data: playedMatches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score')
    .eq('tournament_type', 'league')
    .eq('is_played', true);

  // 2. Fetch all teams
  const { data: allTeams } = await supabase.from('teams').select('id');
  if (!allTeams) return;

  // 3. Reset stats
  const stats: Record<string, { points: number; w: number; d: number; l: number; gf: number; ga: number; played: number }> = {};
  allTeams.forEach(t => {
    stats[t.id] = { points: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 };
  });

  // 4. Loop & calculate
  (playedMatches || []).forEach(m => {
    if (!m.home_team_id || !m.away_team_id) return;
    const hs = m.home_score ?? 0;
    const as_ = m.away_score ?? 0;
    const home = stats[m.home_team_id];
    const away = stats[m.away_team_id];
    if (!home || !away) return;

    home.gf += hs; home.ga += as_; home.played++;
    away.gf += as_; away.ga += hs; away.played++;

    if (hs > as_) {
      home.points += 3; home.w++; away.l++;
    } else if (as_ > hs) {
      away.points += 3; away.w++; home.l++;
    } else {
      home.points += 1; away.points += 1; home.d++; away.d++;
    }
  });

  // 5. Batch update all teams
  const updates = Object.entries(stats).map(([id, s]) =>
    supabase.from('teams').update({
      points: s.points,
      wins: s.w,
      draws: s.d,
      losses: s.l,
      goals_for: s.gf,
      goals_against: s.ga,
    }).eq('id', id)
  );
  await Promise.all(updates);
};

const League = () => {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [roundVisibility, setRoundVisibility] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchMatches();
    fetchStandings();
  }, []);

  const fetchMatches = async () => {
    // Admin sees all matches, users only see visible ones
    let query = supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
      .eq('tournament_type', 'league')
      .order('round');
    
    const { data } = await query;
    if (data) {
      const parsed = data as unknown as Match[];
      setMatches(parsed);
      // Build round visibility map
      const vis: Record<number, boolean> = {};
      parsed.forEach(m => {
        if (m.round != null) {
          if (vis[m.round] === undefined) vis[m.round] = m.is_visible;
          else vis[m.round] = vis[m.round] || m.is_visible;
        }
      });
      setRoundVisibility(vis);
      // Pre-fill scores for played matches
      const initial: Record<string, { home: string; away: string }> = {};
      parsed.forEach(m => {
        if (m.is_played) {
          initial[m.id] = { home: String(m.home_score ?? ''), away: String(m.away_score ?? '') };
        }
      });
      setScores(prev => ({ ...initial, ...prev }));
    }
  };

  const fetchStandings = async () => {
    const { data } = await supabase.from('teams').select('*').order('points', { ascending: false });
    if (data) setStandings(data.map(t => ({ ...t, played: t.wins + t.draws + t.losses })) as TeamStanding[]);
  };

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => (a || 0) - (b || 0));
  const roundMatches = matches.filter(m => m.round === selectedRound);

  const saveScore = async (matchId: string) => {
    const s = scores[matchId];
    if (!s || s.home === '' || s.away === '') return;
    await supabase.from('matches').update({
      home_score: parseInt(s.home),
      away_score: parseInt(s.away),
      is_played: true,
    }).eq('id', matchId);

    // Recalculate standings
    await recalculateLeagueTable();
    toast.success('تم حفظ النتيجة وتحديث الترتيب');

    // Refresh data
    await Promise.all([fetchMatches(), fetchStandings()]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-orbitron font-bold text-primary neon-text-green">🏆 الدوري</h1>

      {/* Standings Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground font-cairo">
              <th className="p-3 text-right">#</th>
              <th className="p-3 text-right">الفريق</th>
              <th className="p-3 text-center">لعب</th>
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
              <tr key={t.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                <td className="p-3 font-orbitron text-muted-foreground">{i + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img src={t.logo_url || ''} alt="" className="w-5 h-5 object-contain" />
                    <span className="font-cairo">{t.name}</span>
                  </div>
                </td>
                <td className="p-3 text-center">{t.played}</td>
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

      {/* Round Selector */}
      {rounds.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {rounds.map(r => (
            <Button
              key={r}
              size="sm"
              variant={selectedRound === r ? 'default' : 'outline'}
              onClick={() => setSelectedRound(r!)}
              className="font-orbitron text-xs"
            >
              الجولة {r}
            </Button>
          ))}
        </div>
      )}

      {/* Matches */}
      <div className="space-y-3">
        {roundMatches.length === 0 && (
          <p className="text-muted-foreground font-cairo text-center py-8">لا توجد مباريات في هذه الجولة</p>
        )}
        {!isAdmin && !roundVisibility[selectedRound] ? (
          <div className="glass-card p-8 text-center">
            <p className="text-2xl mb-2">🔒</p>
            <p className="font-cairo text-muted-foreground text-lg">الجولة {selectedRound} مغلقة - بانتظار إشارة المنظم</p>
          </div>
        ) : (
          roundMatches.map(match => (
            <div key={match.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="font-cairo text-sm">{match.home_team?.name}</span>
                  <img src={match.home_team?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2 px-4">
                    <Input
                      type="number"
                      className="w-12 text-center bg-muted/50"
                      min="0"
                      value={scores[match.id]?.home ?? ''}
                      onChange={e => setScores(p => ({ ...p, [match.id]: { ...p[match.id], home: e.target.value, away: p[match.id]?.away || '' } }))}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      className="w-12 text-center bg-muted/50"
                      min="0"
                      value={scores[match.id]?.away ?? ''}
                      onChange={e => setScores(p => ({ ...p, [match.id]: { ...p[match.id], away: e.target.value, home: p[match.id]?.home || '' } }))}
                    />
                    <Button size="sm" onClick={() => saveScore(match.id)} className="font-cairo">
                      {match.is_played ? 'تعديل' : 'حفظ'}
                    </Button>
                  </div>
                ) : match.is_played ? (
                  <div className="px-4 font-orbitron font-bold text-primary text-lg">
                    {match.home_score} - {match.away_score}
                  </div>
                ) : (
                  <div className="px-4 text-muted-foreground font-orbitron">vs</div>
                )}

                <div className="flex items-center gap-2 flex-1">
                  <img src={match.away_team?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                  <span className="font-cairo text-sm">{match.away_team?.name}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default League;
