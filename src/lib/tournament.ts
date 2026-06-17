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

// Round-robin schedule (circle method). Works for any group size; for odd n, one team gets a bye each round.
function buildGroupSchedule(ids: string[]): { home: string; away: string; round: number }[] {
  const teams: (string | null)[] = [...ids];
  if (teams.length % 2 === 1) teams.push(null); // BYE
  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...teams];
  const out: { home: string; away: string; round: number }[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const h = arr[i];
      const a = arr[n - 1 - i];
      if (h && a) {
        // alternate home/away for fairness
        if ((r + i) % 2 === 0) out.push({ home: h, away: a, round: r + 1 });
        else out.push({ home: a, away: h, round: r + 1 });
      }
    }
    // rotate (fix first, rotate the rest)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return out;
}

export async function generateTournament(teams: TeamRow[]) {
  if (teams.length !== 20) throw new Error('يجب أن يكون عدد الفرق 20');

  // Wipe existing matches
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Random draw: 4 groups × 5 teams
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rows: any[] = [];
  const perGroup = 5;

  GROUP_NAMES.forEach((g, gi) => {
    const groupTeams = shuffled.slice(gi * perGroup, gi * perGroup + perGroup).map(t => t.id);
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
  // Top 2 from each of 4 groups = 8 qualifiers
  const qualified: { team: TeamRow; rank: number; group: GroupName }[] = [];
  GROUP_NAMES.forEach(g => {
    const s = groupStandings[g];
    if (s[0]) qualified.push({ team: s[0].team, rank: 1, group: g });
    if (s[1]) qualified.push({ team: s[1].team, rank: 2, group: g });
  });

  if (qualified.length !== 8) throw new Error('يجب اكتمال مباريات المجموعات');

  // Pairings: 1st vs 2nd from other groups
  const firsts = qualified.filter(q => q.rank === 1);
  const lowerPool = qualified.filter(q => q.rank === 2);
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
