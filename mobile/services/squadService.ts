import { api } from './api';
import { Player } from '../types/player';

export interface SquadResponse {
  players: Player[];
  formation: string;
  total: number;
}

export async function fetchSquad(teamId?: string): Promise<SquadResponse> {
  const params = teamId ? { team_id: teamId } : undefined;
  const response = await api.get<SquadResponse>('/api/v1/squad', { params });
  return {
    players: response.data.players ?? [],
    formation: response.data.formation ?? '4-4-2',
    total: response.data.total ?? 0,
  };
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$${(value / 1_000).toFixed(0)}K`;
  return `R$${value}`;
}

export function formatWage(value: number): string {
  const weekly = Math.round(value / 200);
  if (weekly >= 1_000) return `R$${(weekly / 1_000).toFixed(1)}k/sem`;
  return `R$${weekly}/sem`;
}
