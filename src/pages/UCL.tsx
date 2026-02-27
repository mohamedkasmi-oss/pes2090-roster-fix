import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  group_name: string | null;
  is_played: boolean;
  home_team: { id: string; name: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; logo_url: string | null } | null;
}

interface GroupStanding {
  team_id: string;
  name: string;
  logo_url: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

const UCL = () => {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(id, name, logo_url), away_team:teams!matches_away_team_id_fkey(id, name, logo_url)')
      .eq('tournament_type', 'ucl')
      .eq('is_visible', true)
      .order('created_at');
    if (data) setMatches(data as unknown as Match[]);
  };

  const saveScore = async (matchId: string) => {
    const s = scores[matchId];
    if (!s) return;
    await supabase.from('matches').update({
      home_score: parseInt(s.home),
      away_score: parseInt(s.away),
      is_played: true,
    }).eq('id', matchId);
    fetchMatches();
  };

  const groups = ['A', 'B', 'C', 'D'];

  const getGroupStandings = (group: string): GroupStanding[] => {
    const groupMatches = matches.filter(m => m.group_name === group && m.is_played);
    const teamsInGroup = matches.filter(m => m.group_name === group);
    const teamMap = new Map<string, GroupStanding>();

    teamsInGroup.forEach(m => {
      if (m.home_team && !teamMap.has(m.home_team.id)) {
        teamMap.set(m.home_team.id, { team_id: m.home_team.id, name: m.home_team.name, logo_url: m.home_team.logo_url, points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
      }
      if (m.away_team && !teamMap.has(m.away_team.id)) {
        teamMap.set(m.away_team.id, { team_id: m.away_team.id, name: m.away_team.name, logo_url: m.away_team.logo_url, points: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
      }
    });

    groupMatches.forEach(m => {
      if (m.home_score === null || m.away_score === null) return;
      const home = teamMap.get(m.home_team!.id);
      const away = teamMap.get(m.away_team!.id);
      if (!home || !away) return;

      home.gf += m.home_score; home.ga += m.away_score;
      away.gf += m.away_score; away.ga += m.home_score;

      if (m.home_score > m.away_score) { home.wins++; home.points += 3; away.losses++; }
      else if (m.home_score < m.away_score) { away.wins++; away.points += 3; home.losses++; }
      else { home.draws++; away.draws++; home.points++; away.points++; }
    });

    return Array.from(teamMap.values()).sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-secondary">🌍 دوري الأبطال</h1>

      {matches.length === 0 && (
        <p className="text-muted-foreground font-cairo text-center py-8">لم يتم إنشاء دوري الأبطال بعد</p>
      )}

      {groups.map(group => {
        const standings = getGroupStandings(group);
        const groupMatches = matches.filter(m => m.group_name === group);
        if (groupMatches.length === 0) return null;

        return (
          <div key={group} className="space-y-4">
            <h2 className="text-lg font-orbitron font-semibold text-secondary/80">المجموعة {group}</h2>

            {/* Standings */}
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground font-cairo">
                    <th className="p-2 text-right">الفريق</th>
                    <th className="p-2 text-center">ف</th>
                    <th className="p-2 text-center">ت</th>
                    <th className="p-2 text-center">خ</th>
                    <th className="p-2 text-center">نقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(t => (
                    <tr key={t.team_id} className="border-b border-border/20">
                      <td className="p-2 flex items-center gap-2">
                        <img src={t.logo_url || ''} alt="" className="w-4 h-4 object-contain" />
                        <span className="font-cairo text-sm">{t.name}</span>
                      </td>
                      <td className="p-2 text-center">{t.wins}</td>
                      <td className="p-2 text-center">{t.draws}</td>
                      <td className="p-2 text-center">{t.losses}</td>
                      <td className="p-2 text-center font-orbitron font-bold text-secondary">{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matches */}
            <div className="space-y-2">
              {groupMatches.map(match => (
                <div key={match.id} className="glass-card p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-cairo">{match.home_team?.name}</span>
                    <img src={match.home_team?.logo_url || ''} alt="" className="w-5 h-5 object-contain" />
                  </div>
                  {match.is_played ? (
                    <span className="px-3 font-orbitron font-bold text-secondary">{match.home_score} - {match.away_score}</span>
                  ) : isAdmin ? (
                    <div className="flex items-center gap-1 px-2">
                      <Input type="number" className="w-10 text-center bg-muted/50 h-7 text-xs" min="0"
                        value={scores[match.id]?.home || ''}
                        onChange={e => setScores(p => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away || '' } }))} />
                      <span>-</span>
                      <Input type="number" className="w-10 text-center bg-muted/50 h-7 text-xs" min="0"
                        value={scores[match.id]?.away || ''}
                        onChange={e => setScores(p => ({ ...p, [match.id]: { away: e.target.value, home: p[match.id]?.home || '' } }))} />
                      <Button size="sm" className="h-7 text-xs" onClick={() => saveScore(match.id)}>✓</Button>
                    </div>
                  ) : (
                    <span className="px-3 text-muted-foreground font-orbitron">vs</span>
                  )}
                  <div className="flex items-center gap-2 flex-1">
                    <img src={match.away_team?.logo_url || ''} alt="" className="w-5 h-5 object-contain" />
                    <span className="font-cairo">{match.away_team?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UCL;
