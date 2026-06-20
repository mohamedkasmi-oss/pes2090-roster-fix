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
  round: number | null;
  stage: string | null;
  group_name: string | null;
  tournament_type: string; // 'swiss' | 'knockout'
  is_played: boolean;
  is_visible: boolean;
}

export interface TeamRow {
  id: string;
  name: string;          // "🇮🇹 إيطاليا"  (after draw)
  coach_name: string;    // real participant name
  logo_url: string | null;
}

export interface SwissStanding {
  team: TeamRow;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  gf: number;
  ga: number;
  gd: number;
  opponents: Set<string>;
  qualified: boolean;   // 3 wins
  eliminated: boolean;  // 3 losses
}

// ============================================================
// 20 National Teams (with flag emoji)
// ============================================================
export const NATIONS: string[] = [
  '🇲🇦 المغرب',
  '🇮🇹 إيطاليا',
  '🇩🇪 ألمانيا',
  '🇫🇷 فرنسا',
  '🇧🇷 البرازيل',
  '🇪🇸 إسبانيا',
  '🇵🇹 البرتغال',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 إنجلترا',
  '🇦🇷 الأرجنتين',
  '🇸🇳 السنغال',
  '🇳🇱 هولندا',
  '🇺🇸 الولايات المتحدة',
  '🇭🇷 كرواتيا',
  '🇨🇦 كندا',
  '🇧🇪 بلجيكا',
  '🇨🇴 كولومبيا',
  '🇺🇾 الأوروغواي',
  '🇰🇷 كوريا الجنوبية',
  '🇯🇵 اليابان',
  '🇲🇽 المكسيك',
];

export const MAX_SWISS_ROUNDS = 5;
export const WINS_TO_QUALIFY = 3;
export const LOSSES_TO_ELIMINATE = 3;

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

// ============================================================
// Tournament Generation (Round 1 + nation draw)
// ============================================================
export async function generateTournament(teams: TeamRow[]) {
  if (teams.length !== 20) throw new Error('يجب أن يكون عدد اللاعبين 20');

  // Wipe matches
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Random nation draw — assign one nation per player
  const nations = shuffle(NATIONS);
  await Promise.all(
    teams.map((t, i) =>
      supabase
        .from('teams')
        .update({
          name: nations[i],
          points: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0,
        })
        .eq('id', t.id),
    ),
  );

  // Round 1: random pairings → 10 matches
  const shuffled = shuffle(teams);
  const rows: any[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    rows.push({
      home_team_id: shuffled[i].id,
      away_team_id: shuffled[i + 1].id,
      round: 1,
      tournament_type: 'swiss',
      is_visible: true,
    });
  }
  const { error } = await supabase.from('matches').insert(rows);
  if (error) throw error;
}

// ============================================================
// Swiss Standings
// ============================================================
export function computeSwissStandings(
  teams: TeamRow[],
  matches: MatchRow[],
): SwissStanding[] {
  const map = new Map<string, SwissStanding>();
  teams.forEach(t =>
    map.set(t.id, {
      team: t, played: 0, wins: 0, losses: 0, draws: 0,
      gf: 0, ga: 0, gd: 0, opponents: new Set(),
      qualified: false, eliminated: false,
    }),
  );

  matches
    .filter(m => m.tournament_type === 'swiss' && m.is_played && m.home_team_id && m.away_team_id)
    .forEach(m => {
      const h = map.get(m.home_team_id!);
      const a = map.get(m.away_team_id!);
      if (!h || !a) return;
      const hs = m.home_score ?? 0, as_ = m.away_score ?? 0;
      h.played++; a.played++;
      h.gf += hs; h.ga += as_;
      a.gf += as_; a.ga += hs;
      h.opponents.add(a.team.id);
      a.opponents.add(h.team.id);
      if (hs > as_) { h.wins++; a.losses++; }
      else if (hs < as_) { a.wins++; h.losses++; }
      else { h.draws++; a.draws++; } // tie counted, but Swiss is W/L driven
    });

  // Record opponents from unplayed rounds too (so re-matches are still blocked while editing)
  matches
    .filter(m => m.tournament_type === 'swiss' && m.home_team_id && m.away_team_id)
    .forEach(m => {
      const h = map.get(m.home_team_id!);
      const a = map.get(m.away_team_id!);
      if (h && a) { h.opponents.add(a.team.id); a.opponents.add(h.team.id); }
    });

  const arr = Array.from(map.values()).map(s => ({
    ...s,
    gd: s.gf - s.ga,
    qualified: s.wins >= WINS_TO_QUALIFY,
    eliminated: s.losses >= LOSSES_TO_ELIMINATE,
  }));

  arr.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (x.losses !== y.losses) return x.losses - y.losses;
    if (y.gd !== x.gd) return y.gd - x.gd;
    return y.gf - x.gf;
  });
  return arr;
}

// ============================================================
// Pairing for next Swiss round — backtracking, no rematch
// ============================================================
function pairBacktrack(
  players: SwissStanding[],
): [string, string][] | null {
  if (players.length === 0) return [];
  if (players.length % 2 !== 0) return null; // odd impossible
  const [head, ...rest] = players;
  for (let i = 0; i < rest.length; i++) {
    const cand = rest[i];
    if (head.opponents.has(cand.team.id)) continue;
    const remaining = rest.filter((_, j) => j !== i);
    const sub = pairBacktrack(remaining);
    if (sub) return [[head.team.id, cand.team.id], ...sub];
  }
  return null;
}

export async function generateNextSwissRound(
  teams: TeamRow[],
  matches: MatchRow[],
): Promise<number> {
  // Find current round
  const swissMatches = matches.filter(m => m.tournament_type === 'swiss');
  const currentRound = swissMatches.reduce((m, x) => Math.max(m, x.round ?? 0), 0);
  if (currentRound === 0) throw new Error('ابدأ البطولة أولاً');
  if (currentRound >= MAX_SWISS_ROUNDS) throw new Error('انتهت جولات النظام السويسري');

  // Ensure current round complete
  const curr = swissMatches.filter(m => m.round === currentRound);
  if (curr.some(m => !m.is_played)) throw new Error('أكمل نتائج الجولة الحالية أولاً');

  const standings = computeSwissStandings(teams, matches);
  const active = standings.filter(s => !s.qualified && !s.eliminated);

  if (active.length < 2) throw new Error('لا يوجد ما يكفي من اللاعبين النشطين');
  if (active.length % 2 !== 0)
    throw new Error('عدد اللاعبين النشطين فردي — لا يمكن إقران الجولة (راجع نتائج الجولة)');

  // Group by W-L record, then try pairing within combined ordered list
  const sorted = [...active].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return Math.random() - 0.5;
  });

  let pairs = pairBacktrack(sorted);
  if (!pairs) {
    // Retry a few times with reshuffles within same-record buckets
    for (let attempt = 0; attempt < 50 && !pairs; attempt++) {
      const buckets = new Map<string, SwissStanding[]>();
      sorted.forEach(s => {
        const k = `${s.wins}-${s.losses}`;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)!.push(s);
      });
      const reshuffled: SwissStanding[] = [];
      Array.from(buckets.keys()).forEach(k => reshuffled.push(...shuffle(buckets.get(k)!)));
      pairs = pairBacktrack(reshuffled);
    }
  }
  if (!pairs) throw new Error('تعذر إقران الجولة دون تكرار المواجهات');

  const nextRound = currentRound + 1;
  const rows = pairs.map(([h, a]) => ({
    home_team_id: h,
    away_team_id: a,
    round: nextRound,
    tournament_type: 'swiss',
    is_visible: true,
  }));
  const { error } = await supabase.from('matches').insert(rows);
  if (error) throw error;
  return nextRound;
}

// ============================================================
// Team aggregate (for home page sorting only — wins = swiss wins)
// ============================================================
export async function recalcTeamAggregates() {
  const { data: matches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score, is_played, tournament_type')
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

// ============================================================
// Knockout — QF, SF, F
// ============================================================
export async function generateKnockoutQF(standings: SwissStanding[]) {
  // 8 qualified players: first the qualified (3W), then best of active by wins → gd
  const qualified = standings.filter(s => s.qualified);
  const others = standings
    .filter(s => !s.qualified && !s.eliminated)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  const pool = [...qualified, ...others].slice(0, 8);
  if (pool.length < 8) throw new Error('لم يكتمل عدد المتأهلين بعد (8 لاعبين)');

  // Random bracket draw
  const shuffled = shuffle(pool);
  const rows: any[] = [];
  for (let i = 0; i < 8; i += 2) {
    rows.push({
      home_team_id: shuffled[i].team.id,
      away_team_id: shuffled[i + 1].team.id,
      tournament_type: 'knockout',
      stage: 'QF',
      is_visible: true,
    });
  }
  await supabase.from('matches').delete().eq('tournament_type', 'knockout');
  await supabase.from('matches').insert(rows);
}

export async function generateNextKnockout(stage: 'SF' | 'F') {
  const prev = stage === 'SF' ? 'QF' : 'SF';
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_type', 'knockout')
    .eq('stage', prev)
    .eq('is_played', true)
    .order('created_at');
  if (!data || data.length === 0) throw new Error('أكمل الدور السابق أولاً');
  const winners = data.map((m: any) =>
    (m.home_score ?? 0) >= (m.away_score ?? 0) ? m.home_team_id : m.away_team_id,
  );
  const rows: any[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1]) {
      rows.push({
        home_team_id: winners[i],
        away_team_id: winners[i + 1],
        tournament_type: 'knockout',
        stage,
        is_visible: true,
      });
    }
  }
  await supabase.from('matches').delete().eq('tournament_type', 'knockout').eq('stage', stage);
  await supabase.from('matches').insert(rows);
}
