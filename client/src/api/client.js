import axios from 'axios';

const TOKEN_KEY = 'ssms.token';
const USER_KEY = 'ssms.user';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (error) {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;

    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      tokenStore.clear();
      window.location.replace('/login?expired=1');
    }

    const message =
      payload?.message ||
      (error.code === 'ECONNABORTED'
        ? 'The request took too long. Is the API server running?'
        : error.message === 'Network Error'
          ? 'Cannot reach the API server. Start the backend with `npm run dev:server`.'
          : 'Something went wrong.');

    return Promise.reject(Object.assign(new Error(message), {
      status,
      details: payload?.details,
      raw: payload,
    }));
  }
);

/** Unwraps the { success, data, meta } envelope. */
const unwrap = (promise) => promise.then((response) => response.data);

export const http = {
  get: (url, config) => unwrap(api.get(url, config)),
  post: (url, body, config) => unwrap(api.post(url, body, config)),
  put: (url, body, config) => unwrap(api.put(url, body, config)),
  patch: (url, body, config) => unwrap(api.patch(url, body, config)),
  delete: (url, config) => unwrap(api.delete(url, config)),
  /** returns { data, meta } so pages can read pagination info */
  getWithMeta: (url, config) => api.get(url, config).then((response) => ({ data: response.data.data, meta: response.data.meta || {} })),
};

export default api;
