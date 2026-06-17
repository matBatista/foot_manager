import { api } from './api';
import { Player } from '../types/player';

export async function fetchSquad(teamId?: string): Promise<Player[]> {
  const params = teamId ? { team_id: teamId } : undefined;
  const response = await api.get<{ players: Player[]; total: number }>('/api/v1/squad', { params });
  return response.data.players;
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}K`;
  return `£${value}`;
}
