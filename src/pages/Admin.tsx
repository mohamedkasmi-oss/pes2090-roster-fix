import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield, Trophy, Ban, Lock, Swords, Sparkles } from 'lucide-react';
import {
  MatchRow, SwissStanding, TeamRow,
  computeSwissStandings, generateKnockoutQF, generateNextKnockout,
  generateNextSwissRound, generateTournament, MAX_SWISS_ROUNDS,
} from '@/lib/tournament';

interface Team extends TeamRow { is_suspended: boolean; access_code: string; }

const Admin = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('*').neq('access_code', 'KAS2026').order('coach_name'),
      supabase.from('matches').select('*'),
    ]);
    if (t.data) setTeams(t.data as Team[]);
    if (m.data) setMatches(m.data as MatchRow[]);
  };

  const standings = useMemo<SwissStanding[]>(
    () => computeSwissStandings(teams as TeamRow[], matches),
    [teams, matches],
  );

  const swissMatches = matches.filter(m => m.tournament_type === 'swiss');
  const rounds = Array.from(new Set(swissMatches.map(m => m.round!))).sort((a, b) => a - b);
  const currentRound = rounds.length ? rounds[rounds.length - 1] : 0;
  const currentRoundDone =
    currentRound > 0 && swissMatches.filter(r => r.round === currentRound).every(r => r.is_played);

  const qualifiedCount = standings.filter(s => s.qualified).length;
  const activeCount = standings.filter(s => !s.qualified && !s.eliminated).length;

  const roundVisibility: Record<number, boolean> = {};
  swissMatches.forEach(m => {
    if (m.round != null) roundVisibility[m.round] = (roundVisibility[m.round] || false) || m.is_visible;
  });

  if (!isAdmin) return <p className="text-destructive text-center py-20 font-orbitron">غير مصرح</p>;

  const handleGenerateTournament = async () => {
    if (!confirm('سيتم حذف كل المباريات وقرعة المنتخبات من جديد. متابعة؟')) return;
    setLoading('gen');
    try {
      await generateTournament(teams as TeamRow[]);
      toast.success('تم إنشاء البطولة وتوزيع المنتخبات');
      await fetchAll();
    } catch (e: any) { toast.error(e.message || 'خطأ'); }
    setLoading('');
  };

  const handleNextRound = async () => {
    setLoading('next');
    try {
      const r = await generateNextSwissRound(teams as TeamRow[], matches);
      toast.success(`تم توليد الجولة ${r}`);
      await fetchAll();
    } catch (e: any) { toast.error(e.message || 'خطأ'); }
    setLoading('');
  };

  const handleGenerateQF = async () => {
    setLoading('qf');
    try {
      await generateKnockoutQF(standings);
      toast.success('تم توليد ربع النهائي');
      await fetchAll();
    } catch (e: any) { toast.error(e.message || 'خطأ'); }
    setLoading('');
  };

  const handleGenerateNext = async (stage: 'SF' | 'F') => {
    setLoading(stage);
    try {
      await generateNextKnockout(stage);
      toast.success(`تم توليد ${stage === 'SF' ? 'نصف النهائي' : 'النهائي'}`);
      await fetchAll();
    } catch (e: any) { toast.error(e.message || 'خطأ'); }
    setLoading('');
  };

  const toggleRoundVisibility = async (round: number, visible: boolean) => {
    await supabase.from('matches').update({ is_visible: visible })
      .eq('tournament_type', 'swiss').eq('round', round);
    toast.success(visible ? `تم فتح الجولة ${round}` : `تم إغلاق الجولة ${round}`);
    await fetchAll();
  };

  const toggleSuspend = async (teamId: string, current: boolean) => {
    await supabase.from('teams').update({ is_suspended: !current }).eq('id', teamId);
    toast.success(!current ? 'تم إيقاف اللاعب' : 'تم رفع الإيقاف');
    await fetchAll();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-accent neon-text-gold flex items-center gap-2">
        <Shield className="w-6 h-6" /> لوحة الإدارة
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> القرعة
          </h3>
          <p className="text-muted-foreground text-sm font-cairo">
            توزيع 20 منتخباً عشوائياً + توليد الجولة 1 (10 مباريات).
          </p>
          <Button onClick={handleGenerateTournament} disabled={!!loading} className="w-full font-cairo">
            {loading === 'gen' ? '...' : 'إنشاء بطولة جديدة'}
          </Button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-primary flex items-center gap-2">
            <Trophy className="w-5 h-5" /> النظام السويسري
          </h3>
          <p className="text-muted-foreground text-sm font-cairo">
            الجولة الحالية: <span className="text-primary font-bold">{currentRound}/{MAX_SWISS_ROUNDS}</span>
            {' • '}متأهلون: <span className="text-primary font-bold">{qualifiedCount}/8</span>
            {' • '}نشطون: <span className="text-accent font-bold">{activeCount}</span>
          </p>
          <Button
            onClick={handleNextRound}
            disabled={!!loading || !currentRoundDone || currentRound >= MAX_SWISS_ROUNDS || qualifiedCount >= 8}
            className="w-full font-cairo">
            {loading === 'next' ? '...' : 'توليد الجولة التالية'}
          </Button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-accent flex items-center gap-2">
            <Swords className="w-5 h-5" /> الإقصائيات
          </h3>
          <Button onClick={handleGenerateQF} disabled={!!loading} className="w-full font-cairo" variant="outline">
            توليد ربع النهائي (الـ 8 المتأهلون)
          </Button>
          <Button onClick={() => handleGenerateNext('SF')} disabled={!!loading} className="w-full font-cairo" variant="outline">
            توليد نصف النهائي
          </Button>
          <Button onClick={() => handleGenerateNext('F')} disabled={!!loading} className="w-full font-cairo" variant="outline">
            توليد النهائي
          </Button>
        </div>
      </div>

      {rounds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-orbitron font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5" /> تحكم رؤية الجولات
          </h2>
          <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {rounds.map(round => (
              <div key={round} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${roundVisibility[round] ? 'bg-primary/10' : 'bg-muted/20'}`}>
                <span className="font-cairo text-sm">الجولة {round}</span>
                <Switch checked={roundVisibility[round] || false}
                  onCheckedChange={(c) => toggleRoundVisibility(round, c)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-orbitron font-semibold flex items-center gap-2">
          <Ban className="w-5 h-5" /> إدارة اللاعبين
        </h2>
        <div className="grid gap-2">
          {teams.map(t => {
            const s = standings.find(x => x.team.id === t.id);
            return (
              <div key={t.id} className={`glass-card p-3 flex flex-wrap items-center justify-between gap-2 ${t.is_suspended ? 'border-destructive/50 bg-destructive/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="font-cairo text-sm font-bold">{t.coach_name}</span>
                  <span className="text-xs text-muted-foreground">{t.name}</span>
                  <span className="text-[10px] text-accent font-mono">{t.access_code}</span>
                  {s && (
                    <span className="text-xs font-orbitron">
                      {s.wins}W-{s.losses}L
                      {s.qualified && <span className="text-primary ms-1">🟢 متأهل</span>}
                      {s.eliminated && <span className="text-destructive ms-1">🔴 مستبعد</span>}
                    </span>
                  )}
                </div>
                <Button size="sm" variant={t.is_suspended ? 'default' : 'destructive'}
                  onClick={() => toggleSuspend(t.id, t.is_suspended)} className="font-cairo text-xs">
                  {t.is_suspended ? 'رفع الإيقاف' : 'إيقاف'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Admin;
