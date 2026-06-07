import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  computeStandings, GROUP_NAMES, GroupName, MatchRow, recalcTeamAggregates, StandingRow, TeamRow,
} from '@/lib/tournament';

const stageLabel: Record<string, string> = { QF: 'ربع النهائي', SF: 'نصف النهائي', F: 'النهائي' };

const Tournament = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [selectedRound, setSelectedRound] = useState(1);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('id, name, coach_name, logo_url').neq('access_code', 'KAS2026'),
      supabase.from('matches').select('*').order('round'),
    ]);
    if (t.data) setTeams(t.data as TeamRow[]);
    if (m.data) {
      const rows = m.data as MatchRow[];
      setMatches(rows);
      const initial: Record<string, { home: string; away: string }> = {};
      rows.forEach(r => {
        if (r.is_played) initial[r.id] = { home: String(r.home_score ?? ''), away: String(r.away_score ?? '') };
      });
      setScores(prev => ({ ...initial, ...prev }));
    }
  };

  const teamMap = useMemo(() => {
    const m = new Map<string, TeamRow>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const groupStandings = useMemo(() => {
    const res: Record<GroupName, StandingRow[]> = { A: [], B: [], C: [], D: [] };
    GROUP_NAMES.forEach(g => {
      const groupMatches = matches.filter(m => m.group_name === g && m.tournament_type === 'group');
      const teamIds = new Set<string>();
      groupMatches.forEach(m => {
        if (m.home_team_id) teamIds.add(m.home_team_id);
        if (m.away_team_id) teamIds.add(m.away_team_id);
      });
      const groupTeams = Array.from(teamIds).map(id => teamMap.get(id)).filter(Boolean) as TeamRow[];
      res[g] = computeStandings(groupTeams, groupMatches);
    });
    return res;
  }, [matches, teamMap]);

  const groupMatches = matches.filter(m => m.tournament_type === 'group');
  const knockoutMatches = matches.filter(m => m.tournament_type === 'knockout');
  const rounds = Array.from(new Set(groupMatches.map(m => m.round!))).sort((a, b) => a - b);
  const roundVisibility = useMemo(() => {
    const v: Record<number, boolean> = {};
    groupMatches.forEach(m => {
      if (m.round != null) v[m.round] = (v[m.round] || false) || m.is_visible;
    });
    return v;
  }, [groupMatches]);

  const saveScore = async (matchId: string) => {
    const s = scores[matchId];
    if (!s || s.home === '' || s.away === '') return;
    await supabase.from('matches').update({
      home_score: parseInt(s.home),
      away_score: parseInt(s.away),
      is_played: true,
    }).eq('id', matchId);
    await recalcTeamAggregates();
    toast.success('تم حفظ النتيجة');
    await fetchAll();
  };

  const renderMatch = (match: MatchRow) => {
    const home = match.home_team_id ? teamMap.get(match.home_team_id) : null;
    const away = match.away_team_id ? teamMap.get(match.away_team_id) : null;
    return (
      <div key={match.id} className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-cairo text-sm">{home?.name}</span>
            <img src={home?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-2 px-4">
              <Input type="number" min="0" className="w-12 text-center bg-muted/50"
                value={scores[match.id]?.home ?? ''}
                onChange={e => setScores(p => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away || '' } }))} />
              <span className="text-muted-foreground">-</span>
              <Input type="number" min="0" className="w-12 text-center bg-muted/50"
                value={scores[match.id]?.away ?? ''}
                onChange={e => setScores(p => ({ ...p, [match.id]: { home: p[match.id]?.home || '', away: e.target.value } }))} />
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
            <img src={away?.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
            <span className="font-cairo text-sm">{away?.name}</span>
          </div>
        </div>
      </div>
    );
  };

  const standingsTable = (rows: StandingRow[]) => (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground font-cairo">
            <th className="p-2 text-right">#</th>
            <th className="p-2 text-right">الفريق</th>
            <th className="p-2 text-center">لعب</th>
            <th className="p-2 text-center">ف</th>
            <th className="p-2 text-center">ت</th>
            <th className="p-2 text-center">خ</th>
            <th className="p-2 text-center">+/-</th>
            <th className="p-2 text-center font-bold text-primary">نقاط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.team.id} className={`border-b border-border/20 ${i < 2 ? 'bg-primary/5' : i === 2 ? 'bg-accent/5' : ''}`}>
              <td className="p-2 font-orbitron">{i + 1}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <img src={s.team.logo_url || ''} alt="" className="w-5 h-5 object-contain" />
                  <span className="font-cairo">{s.team.name}</span>
                </div>
              </td>
              <td className="p-2 text-center">{s.played}</td>
              <td className="p-2 text-center">{s.wins}</td>
              <td className="p-2 text-center">{s.draws}</td>
              <td className="p-2 text-center">{s.losses}</td>
              <td className="p-2 text-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
              <td className="p-2 text-center font-orbitron font-bold text-primary">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-orbitron font-bold text-primary neon-text-green">🏆 البطولة</h1>

      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="groups" className="font-cairo">المجموعات</TabsTrigger>
          <TabsTrigger value="knockout" className="font-cairo">الإقصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-6">
          {groupMatches.length === 0 ? (
            <p className="text-center text-muted-foreground font-cairo py-12">
              لم تُنشأ البطولة بعد. على المنظم بدؤها من لوحة الإدارة.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {GROUP_NAMES.map(g => (
                  <div key={g} className="space-y-2">
                    <h2 className="font-orbitron font-bold text-accent">مجموعة {g}</h2>
                    {standingsTable(groupStandings[g])}
                  </div>
                ))}
              </div>

              {rounds.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {rounds.map(r => (
                    <Button key={r} size="sm" variant={selectedRound === r ? 'default' : 'outline'}
                      onClick={() => setSelectedRound(r)} className="font-orbitron text-xs">
                      الجولة {r} {!roundVisibility[r] && '🔒'}
                    </Button>
                  ))}
                </div>
              )}

              {!isAdmin && !roundVisibility[selectedRound] ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-2xl mb-2">🔒</p>
                  <p className="font-cairo text-muted-foreground text-lg">
                    الجولة {selectedRound} مغلقة - بانتظار إشارة المنظم
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {GROUP_NAMES.map(g => {
                    const ms = groupMatches.filter(m => m.round === selectedRound && m.group_name === g);
                    if (ms.length === 0) return null;
                    return (
                      <div key={g} className="space-y-2">
                        <h3 className="font-orbitron text-sm text-muted-foreground">مجموعة {g}</h3>
                        {ms.map(renderMatch)}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="knockout" className="space-y-6">
          {knockoutMatches.length === 0 ? (
            <p className="text-center text-muted-foreground font-cairo py-12">
              الأدوار الإقصائية لم تبدأ بعد.
            </p>
          ) : (
            (['QF', 'SF', 'F'] as const).map(stage => {
              const ms = knockoutMatches.filter(m => m.stage === stage);
              if (ms.length === 0) return null;
              return (
                <div key={stage} className="space-y-2">
                  <h2 className="font-orbitron font-bold text-accent">{stageLabel[stage]}</h2>
                  {ms.map(renderMatch)}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tournament;
