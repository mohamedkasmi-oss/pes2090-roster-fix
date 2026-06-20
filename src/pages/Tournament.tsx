import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  computeSwissStandings, MatchRow, recalcTeamAggregates,
  SwissStanding, TeamRow, MAX_SWISS_ROUNDS,
} from '@/lib/tournament';

const stageLabel: Record<string, string> = { QF: 'ربع النهائي', SF: 'نصف النهائي', F: 'النهائي' };
const LS_KEY = 'pes2090.scoreDrafts.v1';

const loadDrafts = (): Record<string, { home: string; away: string }> => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
};
const saveDrafts = (d: Record<string, { home: string; away: string }>) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
};

const Tournament = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(loadDrafts);
  const [selectedRound, setSelectedRound] = useState(1);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { saveDrafts(scores); }, [scores]);

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

  const standings = useMemo<SwissStanding[]>(
    () => computeSwissStandings(teams, matches),
    [teams, matches],
  );

  const swissMatches = matches.filter(m => m.tournament_type === 'swiss');
  const knockoutMatches = matches.filter(m => m.tournament_type === 'knockout');
  const rounds = Array.from(new Set(swissMatches.map(m => m.round!))).sort((a, b) => a - b);

  useEffect(() => {
    if (rounds.length && !rounds.includes(selectedRound)) setSelectedRound(rounds[rounds.length - 1]);
  }, [rounds.join(','), selectedRound]);

  const roundVisibility = useMemo(() => {
    const v: Record<number, boolean> = {};
    swissMatches.forEach(m => {
      if (m.round != null) v[m.round] = (v[m.round] || false) || m.is_visible;
    });
    return v;
  }, [swissMatches]);

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

  // Renders a player chip: real name (bold) + flag/nation small under/beside
  const playerChip = (t: TeamRow | undefined, align: 'start' | 'end' = 'start') => (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'} leading-tight`}>
      <span className="font-cairo text-sm font-bold">{t?.coach_name || '—'}</span>
      <span className="text-[11px] text-muted-foreground font-cairo">{t?.name}</span>
    </div>
  );

  const renderMatch = (match: MatchRow) => {
    const home = match.home_team_id ? teamMap.get(match.home_team_id) : undefined;
    const away = match.away_team_id ? teamMap.get(match.away_team_id) : undefined;
    return (
      <div key={match.id} className="glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex justify-end">{playerChip(home, 'end')}</div>
          {isAdmin ? (
            <div className="flex items-center gap-2 px-2">
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
          <div className="flex-1">{playerChip(away, 'start')}</div>
        </div>
      </div>
    );
  };

  const standingsTable = (rows: SwissStanding[]) => (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground font-cairo">
            <th className="p-2 text-right">#</th>
            <th className="p-2 text-right">اللاعب</th>
            <th className="p-2 text-center">لعب</th>
            <th className="p-2 text-center">ف</th>
            <th className="p-2 text-center">خ</th>
            <th className="p-2 text-center">+/-</th>
            <th className="p-2 text-center">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.team.id} className={`border-b border-border/20 ${s.qualified ? 'bg-primary/10' : s.eliminated ? 'bg-destructive/10' : ''}`}>
              <td className="p-2 font-orbitron">{i + 1}</td>
              <td className="p-2">
                <div className="flex flex-col leading-tight">
                  <span className="font-cairo font-bold">{s.team.coach_name}</span>
                  <span className="text-[11px] text-muted-foreground">{s.team.name}</span>
                </div>
              </td>
              <td className="p-2 text-center">{s.played}</td>
              <td className="p-2 text-center text-primary font-bold">{s.wins}</td>
              <td className="p-2 text-center text-destructive">{s.losses}</td>
              <td className="p-2 text-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
              <td className="p-2 text-center text-xs font-cairo">
                {s.qualified ? <span className="text-primary">🟢 متأهل</span>
                  : s.eliminated ? <span className="text-destructive">🔴 مستبعد</span>
                  : <span className="text-muted-foreground">نشط</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Knockout bracket layout
  const renderBracket = () => {
    const byStage = (s: string) => knockoutMatches.filter(m => m.stage === s);
    const qf = byStage('QF'), sf = byStage('SF'), f = byStage('F');
    if (knockoutMatches.length === 0) {
      return <p className="text-center text-muted-foreground font-cairo py-12">الأدوار الإقصائية لم تبدأ بعد.</p>;
    }
    return (
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <h3 className="font-orbitron font-bold text-accent text-center">ربع النهائي</h3>
          {qf.map(renderMatch)}
        </div>
        <div className="space-y-2">
          <h3 className="font-orbitron font-bold text-accent text-center">نصف النهائي</h3>
          {sf.length ? sf.map(renderMatch) : <p className="text-center text-muted-foreground text-sm font-cairo py-4">—</p>}
        </div>
        <div className="space-y-2">
          <h3 className="font-orbitron font-bold text-primary text-center neon-text-green">النهائي 🏆</h3>
          {f.length ? f.map(renderMatch) : <p className="text-center text-muted-foreground text-sm font-cairo py-4">—</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-orbitron font-bold text-primary neon-text-green">🏆 البطولة — النظام السويسري</h1>

      <Tabs defaultValue="swiss" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="swiss" className="font-cairo">السويسرية</TabsTrigger>
          <TabsTrigger value="knockout" className="font-cairo">الإقصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="swiss" className="space-y-6">
          {swissMatches.length === 0 ? (
            <p className="text-center text-muted-foreground font-cairo py-12">
              لم تُنشأ البطولة بعد. على المنظم بدؤها من لوحة الإدارة.
            </p>
          ) : (
            <>
              <div>
                <h2 className="font-orbitron font-bold text-accent mb-2">جدول الترتيب العام</h2>
                {standingsTable(standings)}
              </div>

              {rounds.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {rounds.map(r => (
                    <Button key={r} size="sm" variant={selectedRound === r ? 'default' : 'outline'}
                      onClick={() => setSelectedRound(r)} className="font-orbitron text-xs">
                      الجولة {r}/{MAX_SWISS_ROUNDS} {!roundVisibility[r] && '🔒'}
                    </Button>
                  ))}
                </div>
              )}

              {!isAdmin && !roundVisibility[selectedRound] ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-2xl mb-2">🔒</p>
                  <p className="font-cairo text-muted-foreground text-lg">
                    الجولة {selectedRound} مغلقة — بانتظار إشارة المنظم
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {swissMatches.filter(m => m.round === selectedRound).map(renderMatch)}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="knockout" className="space-y-6">
          {renderBracket()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tournament;
