import { supabase } from '@/integrations/supabase/client';

export const GROUP_NAMES = ['A', 'B', 'C', 'D'] as const;
export type GroupName = (typeof GROUP_NAMES)[number];

export interface MatchRow {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  stage: string | null;
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

export interface StandingRow {
  team: TeamRow;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// 4-team home-and-away schedule, 6 matchdays
function buildGroupSchedule(ids: string[]): { home: string; away: string; round: number }[] {
  const [a, b, c, d] = ids;
  return [
    // Leg 1
    { home: a, away: d, round: 1 }, { home: b, away: c, round: 1 },
    { home: d, away: c, round: 2 }, { home: a, away: b, round: 2 },
    { home: b, away: d, round: 3 }, { home: c, away: a, round: 3 },
    // Leg 2 (reverse)
    { home: d, away: a, round: 4 }, { home: c, away: b, round: 4 },
    { home: c, away: d, round: 5 }, { home: b, away: a, round: 5 },
    { home: d, away: b, round: 6 }, { home: a, away: c, round: 6 },
  ];
}

export async function generateTournament(teams: TeamRow[]) {
  if (teams.length !== 12) throw new Error('يجب أن يكون عدد الفرق 12');

  // Wipe existing matches
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Random draw
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rows: any[] = [];

  GROUP_NAMES.forEach((g, gi) => {
    const groupTeams = shuffled.slice(gi * 4, gi * 4 + 4).map(t => t.id);
    const schedule = buildGroupSchedule(groupTeams);
    schedule.forEach(s => {
      rows.push({
        home_team_id: s.home,
        away_team_id: s.away,
        round: s.round,
        group_name: g,
        tournament_type: 'group',
        is_visible: s.round === 1,
      });
    });
  });

  // Insert in batches
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from('matches').insert(rows.slice(i, i + 50));
    if (error) throw error;
  }

  // Reset team aggregates
  await supabase
    .from('teams')
    .update({ points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000');
}

export function computeStandings(
  teams: TeamRow[],
  matches: MatchRow[],
): StandingRow[] {
  const map = new Map<string, StandingRow>();
  teams.forEach(t =>
    map.set(t.id, { team: t, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 }),
  );

  matches
    .filter(m => m.is_played && m.home_team_id && m.away_team_id)
    .forEach(m => {
      const h = map.get(m.home_team_id!);
      const a = map.get(m.away_team_id!);
      if (!h || !a) return;
      const hs = m.home_score ?? 0;
      const as_ = m.away_score ?? 0;
      h.played++; a.played++;
      h.gf += hs; h.ga += as_;
      a.gf += as_; a.ga += hs;
      if (hs > as_) { h.wins++; a.losses++; h.points += 3; }
      else if (hs < as_) { a.wins++; h.losses++; a.points += 3; }
      else { h.draws++; a.draws++; h.points++; a.points++; }
    });

  const arr = Array.from(map.values()).map(s => ({ ...s, gd: s.gf - s.ga }));
  arr.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    return x.ga - y.ga;
  });
  return arr;
}

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

export async function generateKnockoutQF(
  groupStandings: Record<GroupName, StandingRow[]>,
) {
  // Top 2 from each group + 2 best thirds
  const qualified: { team: TeamRow; rank: number; group: GroupName }[] = [];
  GROUP_NAMES.forEach(g => {
    const s = groupStandings[g];
    if (s[0]) qualified.push({ team: s[0].team, rank: 1, group: g });
    if (s[1]) qualified.push({ team: s[1].team, rank: 2, group: g });
  });
  const thirds: { st: StandingRow; group: GroupName }[] = [];
  GROUP_NAMES.forEach(g => {
    if (groupStandings[g][2]) thirds.push({ st: groupStandings[g][2], group: g });
  });
  thirds.sort((x, y) => {
    if (y.st.points !== x.st.points) return y.st.points - x.st.points;
    if (y.st.gd !== x.st.gd) return y.st.gd - x.st.gd;
    return y.st.gf - x.st.gf;
  });
  thirds.slice(0, 2).forEach(t => qualified.push({ team: t.st.team, rank: 3, group: t.group }));

  if (qualified.length !== 8) throw new Error('يجب اكتمال مباريات المجموعات');

  // Pairings: 1st vs 2nd/3rd from other groups
  const firsts = qualified.filter(q => q.rank === 1);
  const seconds = qualified.filter(q => q.rank === 2);
  const thirdsQ = qualified.filter(q => q.rank === 3);
  const lowerPool = [...seconds, ...thirdsQ];
  // Shuffle lower pool, ensure no same-group pairing where possible
  for (let i = lowerPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lowerPool[i], lowerPool[j]] = [lowerPool[j], lowerPool[i]];
  }

  const matches: any[] = [];
  const used = new Set<number>();
  firsts.forEach(f => {
    let idx = lowerPool.findIndex((p, i) => !used.has(i) && p.group !== f.group);
    if (idx === -1) idx = lowerPool.findIndex((_, i) => !used.has(i));
    used.add(idx);
    matches.push({
      home_team_id: f.team.id,
      away_team_id: lowerPool[idx].team.id,
      tournament_type: 'knockout',
      stage: 'QF',
      is_visible: true,
    });
  });
  // Remaining lowerPool entries (after seeded firsts paired) — if lowerPool > firsts, pair leftovers
  const leftovers = lowerPool.filter((_, i) => !used.has(i));
  for (let i = 0; i < leftovers.length; i += 2) {
    if (leftovers[i + 1]) {
      matches.push({
        home_team_id: leftovers[i].team.id,
        away_team_id: leftovers[i + 1].team.id,
        tournament_type: 'knockout',
        stage: 'QF',
        is_visible: true,
      });
    }
  }

  await supabase.from('matches').delete().eq('tournament_type', 'knockout');
  await supabase.from('matches').insert(matches);
}

export async function generateNextKnockout(stage: 'SF' | 'F') {
  const prev = stage === 'SF' ? 'QF' : 'SF';
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_type', 'knockout')
    .eq('stage', prev)
    .eq('is_played', true);
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
