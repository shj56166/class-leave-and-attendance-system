import axios from 'axios';
import { ElMessage } from 'element-plus';
import {
  ensureServerRuntimeReady,
  resolveApiBaseUrl
} from '../config/serverRuntime';
import { expireTeacherAuthenticatedSession } from '../services/teacherSessionCleanup';

const request = axios.create({
  timeout: 10000
});

async function readBlobText(blob) {
  if (!(blob instanceof Blob)) {
    return '';
  }

  try {
    return await blob.text();
  } catch (error) {
    return '';
  }
}

export async function parseRequestErrorMessage(error, fallbackMessage = '请求失败') {
  if (error?.isServerConnectionError) {
    return error.message || '未找到可用服务器，请检查服务器连接设置';
  }

  const responseData = error?.response?.data;

  if (responseData instanceof Blob) {
    const text = await readBlobText(responseData);
    if (!text) {
      return fallbackMessage;
    }

    try {
      const parsed = JSON.parse(text);
      return parsed?.error || parsed?.message || text || fallbackMessage;
    } catch (parseError) {
      return text || fallbackMessage;
    }
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    try {
      const parsed = JSON.parse(responseData);
      return parsed?.error || parsed?.message || responseData || fallbackMessage;
    } catch (parseError) {
      return responseData;
    }
  }

  return responseData?.error || responseData?.message || error?.message || fallbackMessage;
}

request.interceptors.request.use(
  async (config) => {
    await ensureServerRuntimeReady();
    const baseURL = resolveApiBaseUrl();

    if (!baseURL && !/^https?:\/\//i.test(String(config.url || ''))) {
      const connectionError = new Error('未找到可用服务器，请在登录页或设置页配置服务器地址');
      connectionError.isServerConnectionError = true;
      throw connectionError;
    }

    if (baseURL) {
      config.baseURL = baseURL;
    }

    const token = localStorage.getItem('teacher_token');
    if (token && !config.headers?.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await expireTeacherAuthenticatedSession();
      return Promise.reject(error);
    }

    if (!error.config?.silentError) {
      ElMessage.error(await parseRequestErrorMessage(error, '请求失败'));
    }

    return Promise.reject(error);
  }
);

export default request;
