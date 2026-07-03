import { supabase } from '@/integrations/supabase/client';

// ============================================================
// Types
// ============================================================
export interface MatchRow {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;   // slot inside a stage (1-based)
  stage: string | null;   // 'PI' | 'QF' | 'SF' | 'F'
  group_name: string | null;
  tournament_type: string;
  is_played: boolean;
  is_visible: boolean;
}

export interface TeamRow {
  id: string;
  name: string;
  coach_name: string;
  logo_url: string | null;
}

// ============================================================
// 10 Nations (name + flag)
// ============================================================
export interface Nation { name: string; flag: string; }

export const NATIONS: Nation[] = [
  { name: 'المغرب',     flag: '🇲🇦' },
  { name: 'البرازيل',   flag: '🇧🇷' },
  { name: 'الأرجنتين',  flag: '🇦🇷' },
  { name: 'فرنسا',      flag: '🇫🇷' },
  { name: 'إسبانيا',    flag: '🇪🇸' },
  { name: 'إنجلترا',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'البرتغال',   flag: '🇵🇹' },
  { name: 'ألمانيا',    flag: '🇩🇪' },
  { name: 'إيطاليا',    flag: '🇮🇹' },
  { name: 'هولندا',     flag: '🇳🇱' },
];

export const STAGES: { key: string; label: string }[] = [
  { key: 'PI', label: 'الملحق التمهيدي' },
  { key: 'QF', label: 'ربع النهائي' },
  { key: 'SF', label: 'نصف النهائي' },
  { key: 'F',  label: 'النهائي' },
];

// ============================================================
// Utils
// ============================================================
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function winnerOf(m: MatchRow): string | null {
  if (!m.is_played) return null;
  const hs = m.home_score ?? 0, as_ = m.away_score ?? 0;
  if (hs === as_) return null; // knockout must not be tied
  return hs > as_ ? m.home_team_id : m.away_team_id;
}

// ============================================================
// Generate Tournament — full bracket with placeholders
// ============================================================
export async function generateTournament(teams: TeamRow[]) {
  if (teams.length !== 10) throw new Error('يجب أن يكون عدد اللاعبين 10');

  // Wipe existing matches
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Assign a random nation to each player (name = "🇲🇦 المغرب")
  const nations = shuffle(NATIONS);
  await Promise.all(
    teams.map((t, i) =>
      supabase.from('teams').update({
        name: `${nations[i].flag} ${nations[i].name}`,
        points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0,
      }).eq('id', t.id),
    ),
  );

  // Shuffle 10 players → draw[0..9]
  const draw = shuffle(teams);

  // Persist the draw order for reference
  await supabase.from('app_settings').upsert({
    key: 'playin_draw_order',
    value: draw.map(t => t.id) as any,
  }, { onConflict: 'key' });

  // Build bracket. Placeholders use null team ids.
  const rows = [
    // Play-in
    { home_team_id: draw[0].id, away_team_id: draw[1].id, stage: 'PI', round: 1, tournament_type: 'knockout', is_visible: true },
    { home_team_id: draw[2].id, away_team_id: draw[3].id, stage: 'PI', round: 2, tournament_type: 'knockout', is_visible: true },
    // Quarterfinals
    { home_team_id: draw[4].id, away_team_id: null,      stage: 'QF', round: 1, tournament_type: 'knockout', is_visible: true }, // vs W(PI1)
    { home_team_id: draw[5].id, away_team_id: null,      stage: 'QF', round: 2, tournament_type: 'knockout', is_visible: true }, // vs W(PI2)
    { home_team_id: draw[6].id, away_team_id: draw[7].id, stage: 'QF', round: 3, tournament_type: 'knockout', is_visible: true },
    { home_team_id: draw[8].id, away_team_id: draw[9].id, stage: 'QF', round: 4, tournament_type: 'knockout', is_visible: true },
    // Semifinals
    { home_team_id: null, away_team_id: null, stage: 'SF', round: 1, tournament_type: 'knockout', is_visible: true }, // W(QF1) vs W(QF3)
    { home_team_id: null, away_team_id: null, stage: 'SF', round: 2, tournament_type: 'knockout', is_visible: true }, // W(QF2) vs W(QF4)
    // Final
    { home_team_id: null, away_team_id: null, stage: 'F',  round: 1, tournament_type: 'knockout', is_visible: true }, // W(SF1) vs W(SF2)
  ];
  const { error } = await supabase.from('matches').insert(rows);
  if (error) throw error;
}

// ============================================================
// Progress bracket — write winners into next-stage slots
// ============================================================
type Slot = { stage: string; round: number; side: 'home' | 'away' };

const ADVANCE: Record<string, Slot | null> = {
  'PI-1': { stage: 'QF', round: 1, side: 'away' },
  'PI-2': { stage: 'QF', round: 2, side: 'away' },
  'QF-1': { stage: 'SF', round: 1, side: 'home' },
  'QF-3': { stage: 'SF', round: 1, side: 'away' },
  'QF-2': { stage: 'SF', round: 2, side: 'home' },
  'QF-4': { stage: 'SF', round: 2, side: 'away' },
  'SF-1': { stage: 'F',  round: 1, side: 'home' },
  'SF-2': { stage: 'F',  round: 1, side: 'away' },
  'F-1':  null,
};

export async function propagateWinners(matches: MatchRow[]) {
  const byKey = new Map<string, MatchRow>();
  matches.forEach(m => {
    if (m.stage && m.round != null) byKey.set(`${m.stage}-${m.round}`, m);
  });

  for (const [key, m] of byKey.entries()) {
    const target = ADVANCE[key];
    if (!target) continue;
    const w = winnerOf(m);
    const targetMatch = byKey.get(`${target.stage}-${target.round}`);
    if (!targetMatch) continue;
    const currentSideId = target.side === 'home' ? targetMatch.home_team_id : targetMatch.away_team_id;
    if (currentSideId === w) continue; // already correct (covers both set & already-null when w is null)
    // If the target was already played we must reset it since the upstream winner changed.
    const patch: any = {
      [target.side === 'home' ? 'home_team_id' : 'away_team_id']: w,
    };
    if (targetMatch.is_played && currentSideId !== w) {
      patch.is_played = false;
      patch.home_score = null;
      patch.away_score = null;
    }
    await supabase.from('matches').update(patch).eq('id', targetMatch.id);
  }
}

// ============================================================
// Aggregate stats for home-page standings
// ============================================================
export async function recalcTeamAggregates() {
  const { data: matches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score, is_played')
    .eq('is_played', true);
  const { data: teams } = await supabase.from('teams').select('id');
  if (!teams) return;
  const stats: Record<string, any> = {};
  teams.forEach(t => stats[t.id] = { points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 });
  (matches || []).forEach((m: any) => {
    if (!m.home_team_id || !m.away_team_id) return;
    const h = stats[m.home_team_id], a = stats[m.away_team_id];
    if (!h || !a) return;
    const hs = m.home_score ?? 0, as_ = m.away_score ?? 0;
    h.goals_for += hs; h.goals_against += as_;
    a.goals_for += as_; a.goals_against += hs;
    if (hs > as_) { h.wins++; a.losses++; h.points += 3; }
    else if (hs < as_) { a.wins++; h.losses++; a.points += 3; }
    else { h.draws++; a.draws++; h.points++; a.points++; }
  });
  await Promise.all(
    Object.entries(stats).map(([id, s]) => supabase.from('teams').update(s).eq('id', id)),
  );
}
