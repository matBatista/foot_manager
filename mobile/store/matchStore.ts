import { create } from 'zustand';
import { ResultRow, LeagueSummary } from '../services/leagueService';

interface MatchStoreState {
  roundResults: ResultRow[];
  league: LeagueSummary | null;
  managerTeamId: string | null;
  roundNumber: number;
  setRoundResults: (results: ResultRow[], league: LeagueSummary, managerTeamId: string | null, roundNumber: number) => void;
  clear: () => void;
}

export const useMatchResultStore = create<MatchStoreState>((set) => ({
  roundResults: [],
  league: null,
  managerTeamId: null,
  roundNumber: 0,
  setRoundResults: (roundResults, league, managerTeamId, roundNumber) =>
    set({ roundResults, league, managerTeamId, roundNumber }),
  clear: () => set({ roundResults: [], league: null, managerTeamId: null, roundNumber: 0 }),
}));
