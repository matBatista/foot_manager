import { api } from './api';
import { SelectedTeam } from '../store/teamStore';

export interface TeamForSelection {
  id: string;
  name: string;
  short_name: string;
  country: string;
  budget: number;
  division: string;
  avg_overall: number;
}

export async function fetchTeamsForSelection(): Promise<TeamForSelection[]> {
  const response = await api.get<{ teams: TeamForSelection[]; total: number }>(
    '/api/v1/teams/for-selection',
  );
  return response.data.teams ?? [];
}

export async function selectTeamOnServer(teamId: string): Promise<void> {
  await api.post('/api/v1/manager/team', { team_id: teamId });
}

export function teamForSelectionToStore(t: TeamForSelection): SelectedTeam {
  return {
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    division: t.division,
    budget: t.budget,
    avgOverall: t.avg_overall,
  };
}

export function formatBudget(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value}`;
}
