import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = __DEV__ ? 'http://localhost:8080' : 'https://api.managerfc.com';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
