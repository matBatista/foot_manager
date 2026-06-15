import { api } from './api';

export interface Team {
  id: string;
  name: string;
  short_name: string;
  country: string;
  budget: number;
}

export type MatchEventType = 'goal' | 'shot' | 'yellow_card';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team_id: string;
  player: string;
  detail?: string;
}

export interface TeamStats {
  team_id: string;
  name: string;
  goals: number;
  shots: number;
  shots_on_target: number;
  possession: number;
  yellow_cards: number;
}

export interface MatchResult {
  home: TeamStats;
  away: TeamStats;
  events: MatchEvent[];
  seed: number;
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await api.get<{ teams: Team[]; total: number }>('/api/v1/teams');
  return res.data.teams;
}

export async function simulateMatch(
  homeTeamId: string,
  awayTeamId: string,
  seed?: number
): Promise<MatchResult> {
  const res = await api.post<MatchResult>('/api/v1/match/simulate', {
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    seed: seed ?? 0,
  });
  return res.data;
}
