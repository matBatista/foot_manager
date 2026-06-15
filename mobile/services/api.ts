import axios from 'axios';

const BASE_URL = __DEV__ ? 'http://localhost:8080' : 'https://api.brassfoot.com';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  // TODO: pull token from secure store
  return config;
});
