import { create } from 'zustand';

const TEAM_KEY = 'managerfc_selected_team';

export interface SelectedTeam {
  id: string;
  name: string;
  shortName: string;
  division: string;
  budget: number;
  avgOverall: number;
}

function loadTeam(): SelectedTeam | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TEAM_KEY) : null;
    return raw ? (JSON.parse(raw) as SelectedTeam) : null;
  } catch {
    return null;
  }
}

interface TeamState {
  selectedTeam: SelectedTeam | null;
  setTeam: (team: SelectedTeam | null) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  selectedTeam: loadTeam(),
  setTeam: (team) => {
    try {
      if (team) localStorage.setItem(TEAM_KEY, JSON.stringify(team));
      else localStorage.removeItem(TEAM_KEY);
    } catch {}
    set({ selectedTeam: team });
  },
  clearTeam: () => {
    try {
      localStorage.removeItem(TEAM_KEY);
    } catch {}
    set({ selectedTeam: null });
  },
}));
