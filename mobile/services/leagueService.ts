import { api } from './api';

export interface LeagueSummary {
  id: string;
  country?: string;
  teams: number;
  total_rounds: number;
  next_round: number;
  done: boolean;
}

export interface TableRow {
  position: number;
  team_id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface ResultRow {
  round: number;
  home_team_id: string;
  home_name: string;
  away_team_id: string;
  away_name: string;
  home_goals: number;
  away_goals: number;
}

export interface TableResponse {
  league: LeagueSummary;
  table: TableRow[];
}

export interface AdvanceResponse {
  league: LeagueSummary;
  results: ResultRow[];
  table: TableRow[];
}

export async function createLeague(country?: string): Promise<LeagueSummary> {
  const res = await api.post<LeagueSummary>('/api/v1/leagues', {
    country: country ?? '',
  });
  return res.data;
}

export async function getLeagueTable(id: string): Promise<TableResponse> {
  const res = await api.get<TableResponse>(`/api/v1/leagues/${id}/table`);
  return res.data;
}

export async function advanceLeague(id: string, rounds = 1): Promise<AdvanceResponse> {
  const res = await api.post<AdvanceResponse>(`/api/v1/leagues/${id}/advance`, { rounds });
  return res.data;
}

export async function simToEnd(id: string): Promise<AdvanceResponse> {
  const res = await api.post<AdvanceResponse>(`/api/v1/leagues/${id}/advance`, { to_end: true });
  return res.data;
}

// ---- save-game ----

export interface SaveMeta {
  id: string;
  manager_id: string;
  country: string;
  saved_at: string;
}

export interface SaveResponse {
  save_id: string;
}

export interface RestoreResponse {
  league_id: string;
  league: LeagueSummary;
}

export async function saveLeague(leagueId: string): Promise<SaveResponse> {
  const res = await api.post<SaveResponse>(`/api/v1/leagues/${leagueId}/save`);
  return res.data;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const res = await api.get<SaveMeta[]>('/api/v1/saves');
  return res.data;
}

export async function restoreSave(saveId: string): Promise<RestoreResponse> {
  const res = await api.post<RestoreResponse>(`/api/v1/saves/${saveId}/restore`);
  return res.data;
}
