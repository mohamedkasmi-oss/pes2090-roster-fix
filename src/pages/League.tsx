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
  round: number | null;
  is_played: boolean;
  is_visible: boolean;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}

const League = () => {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
      .eq('tournament_type', 'league')
      .eq('is_visible', true)
      .order('round');
    if (data) setMatches(data as unknown as Match[]);
  };

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => (a || 0) - (b || 0));
  const roundMatches = matches.filter(m => m.round === selectedRound);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-orbitron font-bold text-primary neon-text-green">🏆 الدوري</h1>

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

      <div className="space-y-3">
        {roundMatches.length === 0 && (
          <p className="text-muted-foreground font-cairo text-center py-8">لا توجد مباريات في هذه الجولة</p>
        )}
        {roundMatches.map(match => (
          <div key={match.id} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="font-cairo text-sm">{match.home_team?.name}</span>
                <img src={match.home_team?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
              </div>

              {match.is_played ? (
                <div className="px-4 font-orbitron font-bold text-primary text-lg">
                  {match.home_score} - {match.away_score}
                </div>
              ) : isAdmin ? (
                <div className="flex items-center gap-2 px-4">
                  <Input
                    type="number"
                    className="w-12 text-center bg-muted/50"
                    min="0"
                    value={scores[match.id]?.home || ''}
                    onChange={e => setScores(p => ({ ...p, [match.id]: { ...p[match.id], home: e.target.value, away: p[match.id]?.away || '' } }))}
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    className="w-12 text-center bg-muted/50"
                    min="0"
                    value={scores[match.id]?.away || ''}
                    onChange={e => setScores(p => ({ ...p, [match.id]: { ...p[match.id], away: e.target.value, home: p[match.id]?.home || '' } }))}
                  />
                  <Button size="sm" onClick={() => saveScore(match.id)} className="font-cairo">حفظ</Button>
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
        ))}
      </div>
    </div>
  );
};

export default League;
