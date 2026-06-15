import { api } from './api';
import { Player } from '../types/player';

export async function fetchSquad(): Promise<Player[]> {
  const response = await api.get<{ players: Player[]; total: number }>('/api/v1/squad');
  return response.data.players;
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}K`;
  return `£${value}`;
}
