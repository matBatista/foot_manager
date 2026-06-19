import { create } from 'zustand';
import type { Career } from '../services/careerService';

const CAREER_KEY = 'managerfc_active_career';
const FORMATION_KEY = 'managerfc_formation';

function loadCareer(): Career | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CAREER_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadFormation(): string {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem(FORMATION_KEY)) || '4-4-2';
  } catch { return '4-4-2'; }
}

interface CareerStoreState {
  activeCareer: Career | null;
  formation: string;
  setActiveCareer: (career: Career | null) => void;
  setFormation: (f: string) => void;
  clear: () => void;
}

export const useCareerStore = create<CareerStoreState>((set) => ({
  activeCareer: loadCareer(),
  formation: loadFormation(),
  setActiveCareer: (career) => {
    try {
      if (career) localStorage.setItem(CAREER_KEY, JSON.stringify(career));
      else localStorage.removeItem(CAREER_KEY);
    } catch {}
    set({ activeCareer: career });
  },
  setFormation: (formation) => {
    try { localStorage.setItem(FORMATION_KEY, formation); } catch {}
    set({ formation });
  },
  clear: () => {
    try {
      localStorage.removeItem(CAREER_KEY);
      localStorage.removeItem(FORMATION_KEY);
    } catch {}
    set({ activeCareer: null, formation: '4-4-2' });
  },
}));
