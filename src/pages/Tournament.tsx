import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  MatchRow, TeamRow, STAGES, propagateWinners, recalcTeamAggregates,
} from '@/lib/tournament';

const LS_KEY = 'pes2090.scoreDrafts.v2';
const loadDrafts = (): Record<string, { home: string; away: string }> => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
};
const saveDrafts = (d: Record<string, { home: string; away: string }>) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
};

const stageLabel = (k: string) =>
  STAGES.find(s => s.key === k)?.label || k;

const placeholderFor = (stage: string, round: number, side: 'home' | 'away'): string => {
  if (stage === 'QF' && side === 'away') {
    if (round === 1) return 'الفائز من الملحق 1';
    if (round === 2) return 'الفائز من الملحق 2';
  }
  if (stage === 'SF') {
    if (round === 1) return side === 'home' ? 'الفائز من ربع النهائي 1' : 'الفائز من ربع النهائي 3';
    if (round === 2) return side === 'home' ? 'الفائز من ربع النهائي 2' : 'الفائز من ربع النهائي 4';
  }
  if (stage === 'F') return side === 'home' ? 'الفائز من نصف النهائي 1' : 'الفائز من نصف النهائي 2';
  return 'بانتظار…';
};

const Tournament = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(loadDrafts);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { saveDrafts(scores); }, [scores]);

  const fetchAll = async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('id, name, coach_name, logo_url').neq('access_code', 'KAS2026'),
      supabase.from('matches').select('*').order('stage').order('round'),
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
    const map = new Map<string, TeamRow>();
    teams.forEach(t => map.set(t.id, t));
    return map;
  }, [teams]);

  const saveScore = async (match: MatchRow) => {
    const s = scores[match.id];
    if (!s || s.home === '' || s.away === '') return;
    const hs = parseInt(s.home), as_ = parseInt(s.away);
    if (hs === as_) { toast.error('لا يسمح بالتعادل في مباريات الإقصاء'); return; }
    if (!match.home_team_id || !match.away_team_id) {
      toast.error('لم يتحدد اللاعبان بعد'); return;
    }
    await supabase.from('matches').update({
      home_score: hs, away_score: as_, is_played: true,
    }).eq('id', match.id);

    // Refetch to have fresh state, then propagate
    const { data: fresh } = await supabase.from('matches').select('*');
    if (fresh) await propagateWinners(fresh as MatchRow[]);
    await recalcTeamAggregates();
    toast.success('تم حفظ النتيجة');
    await fetchAll();
  };

  const playerChip = (t: TeamRow | undefined, fallback: string, align: 'start' | 'end') => (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'} leading-tight`}>
      {t ? (
        <>
          <span className="font-cairo text-sm font-bold">{t.coach_name}</span>
          <span className="text-[13px] text-accent">{t.name}</span>
        </>
      ) : (
        <span className="text-xs text-muted-foreground font-cairo italic">⏳ {fallback}</span>
      )}
    </div>
  );

  const renderMatch = (match: MatchRow, index: number) => {
    const home = match.home_team_id ? teamMap.get(match.home_team_id) : undefined;
    const away = match.away_team_id ? teamMap.get(match.away_team_id) : undefined;
    const canEdit = isAdmin && !!home && !!away;
    const label = `${stageLabel(match.stage!)} ${match.round}`;

    return (
      <div key={match.id} className="glass-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-orbitron">{label}</span>
          {match.is_played && (
            <span className="text-[11px] text-primary font-cairo">✓ منتهية</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex justify-end">
            {playerChip(home, placeholderFor(match.stage!, match.round!, 'home'), 'end')}
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2 px-2">
              <Input type="number" min="0" className="w-12 text-center bg-muted/50"
                value={scores[match.id]?.home ?? ''}
                onChange={e => setScores(p => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away || '' } }))} />
              <span className="text-muted-foreground">-</span>
              <Input type="number" min="0" className="w-12 text-center bg-muted/50"
                value={scores[match.id]?.away ?? ''}
                onChange={e => setScores(p => ({ ...p, [match.id]: { home: p[match.id]?.home || '', away: e.target.value } }))} />
              <Button size="sm" onClick={() => saveScore(match)} className="font-cairo">
                {match.is_played ? 'تعديل' : 'حفظ'}
              </Button>
            </div>
          ) : match.is_played ? (
            <div className="px-4 font-orbitron font-bold text-primary text-lg">
              {match.home_score} - {match.away_score}
            </div>
          ) : (
            <div className="px-4 text-muted-foreground font-orbitron text-sm">
              {home && away ? 'vs' : '—'}
            </div>
          )}
          <div className="flex-1">
            {playerChip(away, placeholderFor(match.stage!, match.round!, 'away'), 'start')}
          </div>
        </div>
      </div>
    );
  };

  const byStage = (s: string) =>
    matches.filter(m => m.stage === s).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  const stageBlock = (stageKey: string) => {
    const rows = byStage(stageKey);
    if (rows.length === 0) return null;
    return (
      <div key={stageKey} className="space-y-3">
        <h2 className="font-orbitron font-bold text-accent text-lg">
          {stageLabel(stageKey)} {stageKey === 'F' && '🏆'}
        </h2>
        <div className="grid gap-3">
          {rows.map((m, i) => renderMatch(m, i))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-orbitron font-bold text-primary neon-text-green">
          🏆 البطولة — نظام الملحق التصفوي
        </h1>
        <p className="text-sm text-muted-foreground font-cairo mt-1">
          10 لاعبين — ملحق تمهيدي (4) → ربع النهائي (8) → نصف النهائي → النهائي
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="text-center text-muted-foreground font-cairo py-12">
          لم تُنشأ البطولة بعد. على المنظم بدؤها من لوحة الإدارة.
        </p>
      ) : (
        <div className="space-y-8">
          {STAGES.map(s => stageBlock(s.key))}
        </div>
      )}
    </div>
  );
};

export default Tournament;
