import axios from 'axios';
import { ensureServerRuntimeReady, resolveApiBaseUrl } from '../config/serverRuntime';

const request = axios.create({
  timeout: 10000
});

const authWhitelist = ['/auth/student/login'];

request.interceptors.request.use(
  async (config) => {
    await ensureServerRuntimeReady();

    const baseURL = resolveApiBaseUrl();
    if (baseURL) {
      config.baseURL = baseURL;
    }

    const url = String(config.url || '');
    if (authWhitelist.some((path) => url.includes(path))) {
      return config;
    }

    const tempToken = localStorage.getItem('tempToken');
    const token = localStorage.getItem('token');
    config.headers = config.headers || {};

    if (url.includes('/set-password') && tempToken) {
      config.headers.Authorization = `Bearer ${tempToken}`;
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '');
      if (authWhitelist.some((path) => requestUrl.includes(path))) {
        return Promise.reject(error);
      }

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tempToken');
      localStorage.removeItem('tempStudent');
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

export default request;
