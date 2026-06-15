import { create } from 'zustand';

const TOKEN_KEY = 'brassfoot_auth_token';

function loadToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: loadToken(),
  setToken: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
    set({ token });
  },
  clearToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    set({ token: null });
  },
}));
