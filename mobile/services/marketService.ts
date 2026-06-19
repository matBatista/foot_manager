import { api } from './api';
import { Player } from '../types/player';
import { BudgetResponse, TransferResult } from '../types/transfer';

export interface WindowStatus {
  open: boolean;
  current_round: number;
  message: string;
}

export async function fetchBudget(): Promise<BudgetResponse> {
  const response = await api.get<BudgetResponse>('/api/v1/market/budget');
  return response.data;
}

export async function fetchAvailable(position?: string, limit = 20, offset = 0): Promise<{ players: Player[]; total: number }> {
  const params: Record<string, string | number> = { limit, offset };
  if (position) params.position = position;
  const response = await api.get<{ players: Player[]; total: number }>('/api/v1/market/available', { params });
  return response.data;
}

export async function fetchWindowStatus(): Promise<WindowStatus> {
  const response = await api.get<WindowStatus>('/api/v1/market/window');
  return response.data;
}

export async function buyPlayer(playerId: string): Promise<TransferResult> {
  const response = await api.post<TransferResult>(`/api/v1/market/buy/${playerId}`);
  return response.data;
}

export async function sellPlayer(playerId: string): Promise<TransferResult> {
  const response = await api.post<TransferResult>(`/api/v1/market/sell/${playerId}`);
  return response.data;
}
