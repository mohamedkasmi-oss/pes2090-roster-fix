import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Trophy, Swords, Globe, Ban } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  coach_name: string;
  logo_url: string | null;
  is_suspended: boolean;
}

const Admin = () => {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState('');

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data as Team[]);
  };

  if (!isAdmin) return <p className="text-destructive text-center py-20 font-orbitron">غير مصرح</p>;

  // ========== LEAGUE GENERATOR (Berger) ==========
  const generateLeague = async () => {
    setLoading('league');
    try {
      // Delete old league matches
      await supabase.from('matches').delete().eq('tournament_type', 'league');

      const n = teams.length; // 16
      const teamIds = teams.map(t => t.id);
      const matches: { home_team_id: string; away_team_id: string; tournament_type: string; round: number; is_visible: boolean }[] = [];

      // Berger algorithm for round-robin
      const list = [...teamIds];
      const fixed = list.shift()!;
      const rotating = list;

      for (let round = 0; round < n - 1; round++) {
        const roundNum = round + 1;
        // First half
        const home = round % 2 === 0 ? fixed : rotating[0];
        const away = round % 2 === 0 ? rotating[0] : fixed;
        matches.push({ home_team_id: home, away_team_id: away, tournament_type: 'league', round: roundNum, is_visible: true });

        for (let i = 1; i < rotating.length / 2 + 0.5; i++) {
          const h = rotating[i];
          const a = rotating[rotating.length - i];
          if (h && a) {
            matches.push({ home_team_id: h, away_team_id: a, tournament_type: 'league', round: roundNum, is_visible: true });
          }
        }

        // Rotate
        rotating.push(rotating.shift()!);
      }

      // Second leg (rounds 16-30)
      const secondLeg = matches.map(m => ({
        home_team_id: m.away_team_id,
        away_team_id: m.home_team_id,
        tournament_type: 'league',
        round: m.round! + (n - 1),
        is_visible: true,
      }));

      const allMatches = [...matches, ...secondLeg];

      // Insert in batches
      for (let i = 0; i < allMatches.length; i += 50) {
        await supabase.from('matches').insert(allMatches.slice(i, i + 50));
      }

      toast.success(`تم إنشاء ${allMatches.length} مباراة دوري!`);
    } catch (e) {
      toast.error('خطأ في إنشاء الدوري');
    }
    setLoading('');
  };

  // ========== CUP GENERATOR ==========
  const generateCupRound = async (stage: string) => {
    setLoading('cup');
    try {
      if (stage === 'round_16') {
        await supabase.from('matches').delete().eq('tournament_type', 'cup');
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        const cupMatches = [];
        for (let i = 0; i < shuffled.length; i += 2) {
          cupMatches.push({
            home_team_id: shuffled[i].id,
            away_team_id: shuffled[i + 1].id,
            tournament_type: 'cup',
            stage: 'round_16',
            is_visible: true,
          });
        }
        await supabase.from('matches').insert(cupMatches);
        toast.success('تم إنشاء دور الـ 16!');
      } else {
        const prevStage = stage === 'quarter' ? 'round_16' : stage === 'semi' ? 'quarter' : 'semi';
        const { data: prevMatches } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_type', 'cup')
          .eq('stage', prevStage)
          .eq('is_played', true);

        if (!prevMatches || prevMatches.length === 0) {
          toast.error('أكمل المرحلة السابقة أولاً');
          setLoading('');
          return;
        }

        const winners = prevMatches.map(m => {
          if ((m.home_score ?? 0) > (m.away_score ?? 0)) return m.home_team_id;
          return m.away_team_id;
        });

        const nextMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (winners[i + 1]) {
            nextMatches.push({
              home_team_id: winners[i],
              away_team_id: winners[i + 1],
              tournament_type: 'cup',
              stage,
              is_visible: true,
            });
          }
        }
        await supabase.from('matches').insert(nextMatches);
        toast.success(`تم إنشاء ${stage === 'quarter' ? 'ربع النهائي' : stage === 'semi' ? 'نصف النهائي' : 'النهائي'}!`);
      }
    } catch (e) {
      toast.error('خطأ');
    }
    setLoading('');
  };

  // ========== UCL GROUPS ==========
  const generateUCL = async () => {
    setLoading('ucl');
    try {
      await supabase.from('matches').delete().eq('tournament_type', 'ucl');
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      const groups = ['A', 'B', 'C', 'D'];
      const allMatches: any[] = [];

      groups.forEach((group, gi) => {
        const groupTeams = shuffled.slice(gi * 4, gi * 4 + 4);
        // Each team plays every other team (home & away = 6 matches per team pair * 2)
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            allMatches.push({
              home_team_id: groupTeams[i].id,
              away_team_id: groupTeams[j].id,
              tournament_type: 'ucl',
              group_name: group,
              is_visible: true,
            });
            allMatches.push({
              home_team_id: groupTeams[j].id,
              away_team_id: groupTeams[i].id,
              tournament_type: 'ucl',
              group_name: group,
              is_visible: true,
            });
          }
        }
      });

      await supabase.from('matches').insert(allMatches);
      toast.success(`تم إنشاء ${allMatches.length} مباراة دوري أبطال!`);
    } catch (e) {
      toast.error('خطأ في إنشاء دوري الأبطال');
    }
    setLoading('');
  };

  // ========== SUSPENSION ==========
  const toggleSuspend = async (teamId: string, current: boolean) => {
    await supabase.from('teams').update({ is_suspended: !current }).eq('id', teamId);
    fetchTeams();
    toast.success(!current ? 'تم إيقاف الفريق' : 'تم رفع الإيقاف');
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-orbitron font-bold text-accent neon-text-gold flex items-center gap-2">
        <Shield className="w-6 h-6" /> لوحة الإدارة
      </h1>

      {/* Generators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-primary flex items-center gap-2"><Trophy className="w-5 h-5" /> الدوري</h3>
          <p className="text-muted-foreground text-sm font-cairo">توليد 30 جولة (ذهاب و إياب) - بيرغر</p>
          <Button onClick={generateLeague} disabled={loading === 'league'} className="w-full font-cairo">
            {loading === 'league' ? '...' : 'توليد الدوري'}
          </Button>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-accent flex items-center gap-2"><Swords className="w-5 h-5" /> الكأس</h3>
          <div className="space-y-2">
            <Button onClick={() => generateCupRound('round_16')} disabled={!!loading} className="w-full font-cairo" variant="outline">
              بدء دور الـ 16
            </Button>
            <Button onClick={() => generateCupRound('quarter')} disabled={!!loading} className="w-full font-cairo" variant="outline">
              توليد ربع النهائي
            </Button>
            <Button onClick={() => generateCupRound('semi')} disabled={!!loading} className="w-full font-cairo" variant="outline">
              توليد نصف النهائي
            </Button>
            <Button onClick={() => generateCupRound('final')} disabled={!!loading} className="w-full font-cairo" variant="outline">
              توليد النهائي
            </Button>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <h3 className="font-orbitron font-semibold text-secondary flex items-center gap-2"><Globe className="w-5 h-5" /> دوري الأبطال</h3>
          <p className="text-muted-foreground text-sm font-cairo">4 مجموعات × 4 فرق مع مباريات الذهاب والإياب</p>
          <Button onClick={generateUCL} disabled={loading === 'ucl'} className="w-full font-cairo">
            {loading === 'ucl' ? '...' : 'توليد دوري الأبطال'}
          </Button>
        </div>
      </div>

      {/* Teams Management */}
      <div className="space-y-3">
        <h2 className="text-lg font-orbitron font-semibold text-foreground flex items-center gap-2">
          <Ban className="w-5 h-5" /> إدارة الفرق
        </h2>
        <div className="grid gap-2">
          {teams.map(t => (
            <div key={t.id} className={`glass-card p-3 flex items-center justify-between ${t.is_suspended ? 'border-destructive/50 bg-destructive/10' : ''}`}>
              <div className="flex items-center gap-3">
                <img src={t.logo_url || ''} alt="" className="w-6 h-6 object-contain" />
                <span className="font-cairo text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground">({t.coach_name})</span>
              </div>
              <Button
                size="sm"
                variant={t.is_suspended ? 'default' : 'destructive'}
                onClick={() => toggleSuspend(t.id, t.is_suspended)}
                className="font-cairo text-xs"
              >
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
