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
  stage: string | null;
  is_played: boolean;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
}

const stages = ['round_16', 'quarter', 'semi', 'final'];
const stageLabels: Record<string, string> = {
  round_16: 'دور الـ 16',
  quarter: 'ربع النهائي',
  semi: 'نصف النهائي',
  final: 'النهائي',
};

const Cup = () => {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
      .eq('tournament_type', 'cup')
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-accent neon-text-gold">⚔️ الكأس</h1>

      {stages.map(stage => {
        const stageMatches = matches.filter(m => m.stage === stage);
        if (stageMatches.length === 0) return null;
        return (
          <div key={stage} className="space-y-3">
            <h2 className="text-lg font-orbitron font-semibold text-accent/80">{stageLabels[stage]}</h2>
            {stageMatches.map(match => (
              <div key={match.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-cairo text-sm">{match.home_team?.name || 'TBD'}</span>
                    {match.home_team?.logo_url && <img src={match.home_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
                  </div>
                  {match.is_played ? (
                    <div className="px-4 font-orbitron font-bold text-accent text-lg">
                      {match.home_score} - {match.away_score}
                    </div>
                  ) : isAdmin ? (
                    <div className="flex items-center gap-2 px-4">
                      <Input type="number" className="w-12 text-center bg-muted/50" min="0"
                        value={scores[match.id]?.home || ''}
                        onChange={e => setScores(p => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away || '' } }))} />
                      <span>-</span>
                      <Input type="number" className="w-12 text-center bg-muted/50" min="0"
                        value={scores[match.id]?.away || ''}
                        onChange={e => setScores(p => ({ ...p, [match.id]: { away: e.target.value, home: p[match.id]?.home || '' } }))} />
                      <Button size="sm" onClick={() => saveScore(match.id)}>حفظ</Button>
                    </div>
                  ) : (
                    <div className="px-4 text-muted-foreground font-orbitron">vs</div>
                  )}
                  <div className="flex items-center gap-2 flex-1">
                    {match.away_team?.logo_url && <img src={match.away_team.logo_url} alt="" className="w-6 h-6 object-contain" />}
                    <span className="font-cairo text-sm">{match.away_team?.name || 'TBD'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {matches.length === 0 && (
        <p className="text-muted-foreground font-cairo text-center py-8">لم يتم إنشاء الكأس بعد</p>
      )}
    </div>
  );
};

export default Cup;
