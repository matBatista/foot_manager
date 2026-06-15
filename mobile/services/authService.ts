import { api } from './api';

export interface Manager {
  id: string;
  name: string;
  email: string;
}

interface AuthResponse {
  token: string;
  manager: Manager;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/v1/auth/login', { email, password });
  return res.data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/v1/auth/register', { name, email, password });
  return res.data;
}
