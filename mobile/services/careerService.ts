import { api } from './api';
import type { LeagueSummary } from './leagueService';

export interface Career {
  id: string;
  manager_id: string;
  season_number: number;
  active_league_id?: string;
  division: string;
  created_at: string;
}

export interface SeasonRecord {
  id: string;
  manager_id: string;
  season_number: number;
  division: string;
  champion_id: string;
  champion_name?: string;
  manager_position: number;
  relegated_ids: string[];
  promoted_ids: string[];
  recorded_at: string;
}

export interface CareerState {
  career: Career;
  league?: LeagueSummary;
}

export interface StartCareerResponse {
  career: Career;
  league: LeagueSummary;
}

export interface NextSeasonResponse {
  career: Career;
  league: LeagueSummary;
  season_record: SeasonRecord;
  champion_name: string;
  relegated: string[];
  promoted: string[];
}

export function divisionLabel(division: string): string {
  return division === 'serie_a' ? 'Série A' : 'Série B';
}

export async function getCareer(): Promise<CareerState> {
  const res = await api.get<CareerState>('/api/v1/career');
  return res.data;
}

export async function startCareer(): Promise<StartCareerResponse> {
  const res = await api.post<StartCareerResponse>('/api/v1/career');
  return res.data;
}

export async function nextSeason(): Promise<NextSeasonResponse> {
  const res = await api.post<NextSeasonResponse>('/api/v1/career/next-season');
  return res.data;
}

export async function getCareerHistory(): Promise<SeasonRecord[]> {
  const res = await api.get<SeasonRecord[]>('/api/v1/career/history');
  return res.data;
}
