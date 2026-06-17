export interface BudgetResponse {
  budget: number;
  team_id: string;
}

export interface AvailableResponse {
  players: import('./player').Player[];
  total: number;
}

export interface TransferResult {
  budget: number;
}
