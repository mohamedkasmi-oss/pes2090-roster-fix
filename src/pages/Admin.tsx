import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Ban, Sparkles } from 'lucide-react';
import { MatchRow, TeamRow, generateTournament } from '@/lib/tournament';

interface Team extends TeamRow { is_suspended: boolean; access_code: string; }

const Admin = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('*').neq('access_code', 'KAS2026').order('access_code'),
      supabase.from('matches').select('*'),
    ]);
    if (t.data) setTeams(t.data as Team[]);
    if (m.data) setMatches(m.data as MatchRow[]);
  };

  if (!isAdmin) return <p className="text-destructive text-center py-20 font-orbitron">غير مصرح</p>;

  const handleGenerate = async () => {
    if (!confirm('سيتم حذف كل المباريات وإعادة القرعة. متابعة؟')) return;
    setLoading('gen');
    try {
      await generateTournament(teams as TeamRow[]);
      toast.success('تم إنشاء البطولة وتوزيع المنتخبات');
      await fetchAll();
    } catch (e: any) { toast.error(e.message || 'خطأ'); }
    setLoading('');
  };

  const toggleSuspend = async (teamId: string, current: boolean) => {
    await supabase.from('teams').update({ is_suspended: !current }).eq('id', teamId);
    toast.success(!current ? 'تم إيقاف اللاعب' : 'تم رفع الإيقاف');
    await fetchAll();
  };

  const playedCount = matches.filter(m => m.is_played).length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-accent neon-text-gold flex items-center gap-2">
        <Shield className="w-6 h-6" /> لوحة الإدارة
      </h1>

      <div className="glass-card p-5 space-y-3">
        <h3 className="font-orbitron font-semibold text-primary flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> إنشاء البطولة
        </h3>
        <p className="text-muted-foreground text-sm font-cairo">
          10 لاعبين — قرعة عشوائية للمنتخبات + توليد كامل شجرة الإقصاء (ملحق + ربع + نصف + نهائي).
        </p>
        <p className="text-xs text-muted-foreground font-cairo">
          مباريات مسجّلة: <span className="text-primary font-bold">{playedCount}</span>
        </p>
        <Button onClick={handleGenerate} disabled={!!loading} className="w-full font-cairo">
          {loading === 'gen' ? '...' : 'إنشاء بطولة جديدة'}
        </Button>
        <p className="text-[11px] text-muted-foreground font-cairo">
          نتائج الأدوار التالية تُملأ تلقائياً عند حفظ الفائزين.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-orbitron font-semibold flex items-center gap-2">
          <Ban className="w-5 h-5" /> إدارة اللاعبين
        </h2>
        <div className="grid gap-2">
          {teams.map(t => (
            <div key={t.id} className={`glass-card p-3 flex flex-wrap items-center justify-between gap-2 ${t.is_suspended ? 'border-destructive/50 bg-destructive/10' : ''}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-cairo text-sm font-bold">{t.coach_name}</span>
                <span className="text-xs text-accent">{t.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{t.access_code}</span>
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
