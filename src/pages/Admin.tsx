import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield, Trophy, Ban, Lock, Swords } from 'lucide-react';
import {
  GROUP_NAMES, GroupName, MatchRow, StandingRow, TeamRow,
  computeStandings, generateKnockoutQF, generateNextKnockout, generateTournament,
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
      supabase.from('teams').select('*').neq('access_code', 'KAS2026').order('name'),
      supabase.from('matches').select('*'),
    ]);
    if (t.data) setTeams(t.data as Team[]);
    if (m.data) setMatches(m.data as MatchRow[]);
  };

  const groupStandings = useMemo(() => {
    const res: Record<GroupName, StandingRow[]> = { A: [], B: [], C: [] };
    const teamMap = new Map(teams.map(t => [t.id, t as TeamRow]));
    GROUP_NAMES.forEach(g => {
      const groupMatches = matches.filter(m => m.group_name === g && m.tournament_type === 'group');
      const ids = new Set<string>();
      groupMatches.forEach(m => { m.home_team_id && ids.add(m.home_team_id); m.away_team_id && ids.add(m.away_team_id); });
      const groupTeams = Array.from(ids).map(id => teamMap.get(id)).filter(Boolean) as TeamRow[];
      res[g] = computeStandings(groupTeams, groupMatches);
    });
    return res;
  }, [matches, teams]);

  const groupMatches = matches.filter(m => m.tournament_type === 'group');
  const allGroupsDone = groupMatches.length > 0 && groupMatches.every(m => m.is_played);

  const rounds = Array.from(new Set(groupMatches.map(m => m.round!))).sort((a, b) => a - b);
  const roundVisibility: Record<number, boolean> = {};
  groupMatches.forEach(m => {
    if (m.round != null) roundVisibility[m.round] = (roundVisibility[m.round] || false) || m.is_visible;
  });

  if (!isAdmin) return <p className="text-destructive text-center py-20 font-orbitron">غير مصرح</p>;

  const handleGenerateTournament = async () => {
    if (!confirm('سيتم حذف كل المباريات الحالية. متابعة؟')) return;
    setLoading('gen');
    try {
      await generateTournament(teams as TeamRow[]);
      toast.success('تم إنشاء البطولة بنجاح');
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'خطأ في إنشاء البطولة');
    }
    setLoading('');
  };

  const handleGenerateQF = async () => {
    setLoading('qf');
    try {
      await generateKnockoutQF(groupStandings);
      toast.success('تم توليد ربع النهائي');
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    }
    setLoading('');
  };

  const handleGenerateNext = async (stage: 'SF' | 'F') => {
    setLoading(stage);
    try {
      await generateNextKnockout(stage);
      toast.success(`تم توليد ${stage === 'SF' ? 'نصف النهائي' : 'النهائي'}`);
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    }
    setLoading('');
  };

  const toggleRoundVisibility = async (round: number, visible: boolean) => {
    await supabase.from('matches').update({ is_visible: visible }).eq('tournament_type', 'group').eq('round', round);
    toast.success(visible ? `تم فتح الجولة ${round}` : `تم إغلاق الجولة ${round}`);
    await fetchAll();
  };

  const toggleSuspend = async (teamId: string, current: boolean) => {
    await supabase.from('teams').update({ is_suspended: !current }).eq('id', teamId);
    toast.success(!current ? 'تم إيقاف الفريق' : 'تم رفع الإيقاف');
    await fetchAll();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-accent neon-text-gold flex items-center gap-2">
        <Shield className="w-6 h-6" /> لوحة الإدارة
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-primary flex items-center gap-2">
            <Trophy className="w-5 h-5" /> دور المجموعات
          </h3>
          <p className="text-muted-foreground text-sm font-cairo">
            قرعة عشوائية: 3 مجموعات × 4 فرق، ذهاب وإياب (36 مباراة).
          </p>
          <Button onClick={handleGenerateTournament} disabled={!!loading} className="w-full font-cairo">
            {loading === 'gen' ? '...' : 'إنشاء بطولة جديدة'}
          </Button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-accent flex items-center gap-2">
            <Swords className="w-5 h-5" /> الأدوار الإقصائية
          </h3>
          <Button onClick={handleGenerateQF} disabled={!!loading || !allGroupsDone}
            className="w-full font-cairo" variant="outline">
            توليد ربع النهائي {!allGroupsDone && '(أكمل المجموعات أولاً)'}
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
            <Lock className="w-5 h-5" /> تحكم الجولات
          </h2>
          <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
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
          <Ban className="w-5 h-5" /> إدارة الفرق
        </h2>
        <div className="grid gap-2">
          {teams.map(t => (
            <div key={t.id} className={`glass-card p-3 flex items-center justify-between ${t.is_suspended ? 'border-destructive/50 bg-destructive/10' : ''}`}>
              <div className="flex items-center gap-3">
                <img src={t.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                <span className="font-cairo text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground">({t.coach_name})</span>
                <span className="text-[10px] text-accent font-mono">{t.access_code}</span>
              </div>
              <Button size="sm" variant={t.is_suspended ? 'default' : 'destructive'}
                onClick={() => toggleSuspend(t.id, t.is_suspended)} className="font-cairo text-xs">
                {t.is_suspended ? 'رفع الإيقاف' : 'إيقاف'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
