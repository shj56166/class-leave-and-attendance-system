import { reactive, readonly } from 'vue';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { TeacherDeviceSettings } from '../services/nativeDeviceSettings';

const STORAGE_KEY = 'teacher_server_runtime';
const DEFAULT_PORT = 3000;
const DEFAULT_HEALTH_PATH = '/health';
const DEFAULT_API_PATH = '/api';
const MAX_RECENT_ORIGINS = 6;
const NETWORK_SCAN_CONCURRENCY = 12;
const NETWORK_SCAN_TIMEOUT_MS = 800;

const state = reactive({
  initialized: false,
  bootstrapping: false,
  discovering: false,
  connectionStatus: 'idle',
  serverOrigin: '',
  apiBaseUrl: '/api',
  socketUrl: '',
  lastVerifiedAt: '',
  lastSuccessOrigin: '',
  source: 'env',
  lastError: '',
  recentOrigins: []
});

let bootstrapPromise = null;
let discoveryPromise = null;

function isNativeAndroid() {
  return Capacitor.getPlatform() === 'android';
}

function isWebRuntime() {
  return !isNativeAndroid();
}

function getEnvValue(key) {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function hasExplicitProtocol(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function getDefaultWebOrigin(options = {}) {
  if (typeof window === 'undefined') {
    return '';
  }

  const allowHttp = options.allowHttp !== false;
  if (!/^https?:\/\//.test(window.location.origin)) {
    return '';
  }

  if (!allowHttp && window.location.protocol !== 'https:') {
    return '';
  }

  return window.location.origin;
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function uniqueOrigins(origins = []) {
  return [...new Set(origins.filter(Boolean))];
}

function safeParseJson(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return fallback;
  }
}

function readStorage() {
  try {
    return safeParseJson(localStorage.getItem(STORAGE_KEY), {});
  } catch (error) {
    return {};
  }
}

function writeStorage(nextValue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  } catch (error) {
    // Ignore storage write failures and keep in-memory state.
  }
}

function normalizeServerOrigin(input, options = {}) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return '';
  }

  const defaultProtocol = options.defaultProtocol || 'http';
  const allowHttp = options.allowHttp !== false;
  const allowHttps = options.allowHttps !== false;
  const withProtocol = hasExplicitProtocol(trimmed)
    ? trimmed
    : `${defaultProtocol}://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if ((url.protocol === 'http:' && !allowHttp) || (url.protocol === 'https:' && !allowHttps)) {
      return '';
    }
    if (!url.port) {
      url.port = String(DEFAULT_PORT);
    }
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return stripTrailingSlash(url.origin);
  } catch (error) {
    return '';
  }
}

function normalizeAbsoluteUrl(input, options = {}) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return stripTrailingSlash(trimmed);
  }

  const defaultProtocol = options.defaultProtocol || 'http';
  const allowHttp = options.allowHttp !== false;
  const allowHttps = options.allowHttps !== false;
  const defaultPath = stripTrailingSlash(options.defaultPath || '') || '';
  const withProtocol = hasExplicitProtocol(trimmed)
    ? trimmed
    : `${defaultProtocol}://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if ((url.protocol === 'http:' && !allowHttp) || (url.protocol === 'https:' && !allowHttps)) {
      return '';
    }
    if (!url.port) {
      url.port = String(DEFAULT_PORT);
    }
    if (defaultPath && (!url.pathname || url.pathname === '/')) {
      url.pathname = defaultPath;
    } else {
      url.pathname = stripTrailingSlash(url.pathname);
    }
    url.search = '';
    url.hash = '';
    return `${stripTrailingSlash(url.origin)}${url.pathname}`;
  } catch (error) {
    return '';
  }
}

function extractOriginFromUrl(input, options = {}) {
  const trimmed = String(input || '').trim();
  if (!trimmed || trimmed.startsWith('/')) {
    return '';
  }

  try {
    const withProtocol = hasExplicitProtocol(trimmed)
      ? trimmed
      : `${options.defaultProtocol || 'http'}://${trimmed}`;
    return stripTrailingSlash(new URL(withProtocol).origin);
  } catch (error) {
    return normalizeServerOrigin(trimmed, options);
  }
}

function buildDerivedUrls(serverOrigin) {
  if (!serverOrigin) {
    if (isWebRuntime()) {
      const defaultOrigin = getDefaultWebOrigin({ allowHttp: false });
      return {
        apiBaseUrl: resolveWebApiBaseUrl(),
        socketUrl: resolveWebSocketUrl(defaultOrigin)
      };
    }

    return {
      apiBaseUrl: '',
      socketUrl: ''
    };
  }

  return {
    apiBaseUrl: `${serverOrigin}${DEFAULT_API_PATH}`,
    socketUrl: serverOrigin
  };
}

function resolveWebApiBaseUrl() {
  const secureApiBaseUrl = normalizeAbsoluteUrl(getEnvValue('VITE_WEB_SECURE_API_BASE_URL'), {
    defaultProtocol: 'https',
    allowHttp: false,
    defaultPath: DEFAULT_API_PATH
  });
  if (secureApiBaseUrl) {
    return secureApiBaseUrl;
  }

  const secureOrigin = normalizeServerOrigin(getEnvValue('VITE_WEB_SECURE_ORIGIN'), {
    defaultProtocol: 'https',
    allowHttp: false
  });
  if (secureOrigin) {
    return `${secureOrigin}${DEFAULT_API_PATH}`;
  }

  const legacySecureApiBaseUrl = normalizeAbsoluteUrl(getEnvValue('VITE_API_BASE_URL'), {
    defaultProtocol: 'https',
    allowHttp: false,
    defaultPath: DEFAULT_API_PATH
  });
  if (legacySecureApiBaseUrl) {
    return legacySecureApiBaseUrl;
  }

  return DEFAULT_API_PATH;
}

function resolveWebSocketUrl(defaultOrigin = '') {
  const explicitSecureSocketUrl = normalizeAbsoluteUrl(getEnvValue('VITE_WEB_SECURE_SOCKET_URL'), {
    defaultProtocol: 'https',
    allowHttp: false
  });
  if (explicitSecureSocketUrl) {
    return explicitSecureSocketUrl;
  }

  const explicitSecureOrigin = normalizeServerOrigin(getEnvValue('VITE_WEB_SECURE_ORIGIN'), {
    defaultProtocol: 'https',
    allowHttp: false
  });
  if (explicitSecureOrigin) {
    return explicitSecureOrigin;
  }

  const legacySecureSocketUrl = normalizeAbsoluteUrl(getEnvValue('VITE_SOCKET_URL'), {
    defaultProtocol: 'https',
    allowHttp: false
  });
  if (legacySecureSocketUrl) {
    return legacySecureSocketUrl;
  }

  return stripTrailingSlash(defaultOrigin);
}

function resolveAndroidDebugOrigin() {
  return extractOriginFromUrl(getEnvValue('VITE_ANDROID_NATIVE_DEBUG_SOCKET_URL'))
    || extractOriginFromUrl(getEnvValue('VITE_ANDROID_NATIVE_DEBUG_API_BASE_URL'))
    || normalizeServerOrigin(getEnvValue('VITE_ANDROID_NATIVE_DEBUG_SERVER_ORIGIN'))
    || normalizeServerOrigin(getEnvValue('VITE_ANDROID_NATIVE_DEBUG_ORIGIN'))
    || extractOriginFromUrl(getEnvValue('VITE_SOCKET_URL'))
    || extractOriginFromUrl(getEnvValue('VITE_API_BASE_URL'));
}

function persistState() {
  writeStorage({
    serverOrigin: state.serverOrigin,
    lastVerifiedAt: state.lastVerifiedAt,
    lastSuccessOrigin: state.lastSuccessOrigin,
    source: state.source,
    recentOrigins: state.recentOrigins
  });
}

function pushRecentOrigin(origin) {
  state.recentOrigins = uniqueOrigins([origin, ...state.recentOrigins]).slice(0, MAX_RECENT_ORIGINS);
}

function applyServerOrigin(origin, source = 'manual') {
  const normalizedOrigin = normalizeServerOrigin(origin);
  const nextUrls = buildDerivedUrls(normalizedOrigin);

  state.serverOrigin = normalizedOrigin;
  state.apiBaseUrl = nextUrls.apiBaseUrl;
  state.socketUrl = nextUrls.socketUrl;
  state.source = source;

  if (normalizedOrigin) {
    pushRecentOrigin(normalizedOrigin);
  }

  persistState();
  return normalizedOrigin;
}

function applyVerifiedOrigin(origin, source = 'auto_discovered') {
  const normalizedOrigin = applyServerOrigin(origin, source);
  if (!normalizedOrigin) {
    return '';
  }

  state.lastVerifiedAt = new Date().toISOString();
  state.lastSuccessOrigin = normalizedOrigin;
  state.connectionStatus = 'connected';
  state.lastError = '';
  persistState();
  return normalizedOrigin;
}

function markFailure(message) {
  state.connectionStatus = 'failed';
  state.lastError = String(message || '服务器连接失败').trim();
}

function getSavedOrigins() {
  const stored = readStorage();
  return {
    serverOrigin: normalizeServerOrigin(stored.serverOrigin),
    lastSuccessOrigin: normalizeServerOrigin(stored.lastSuccessOrigin),
    recentOrigins: uniqueOrigins((stored.recentOrigins || []).map(normalizeServerOrigin)),
    lastVerifiedAt: String(stored.lastVerifiedAt || ''),
    source: String(stored.source || 'env')
  };
}

function seedInitialState() {
  const saved = getSavedOrigins();
  const envOrigin = resolveAndroidDebugOrigin();

  if (isWebRuntime()) {
    const nextUrls = buildDerivedUrls(getDefaultWebOrigin({ allowHttp: false }));
    state.serverOrigin = extractOriginFromUrl(nextUrls.socketUrl, {
      defaultProtocol: 'https',
      allowHttp: false
    }) || getDefaultWebOrigin({ allowHttp: false });
    state.apiBaseUrl = nextUrls.apiBaseUrl;
    state.socketUrl = nextUrls.socketUrl;
    state.lastVerifiedAt = saved.lastVerifiedAt;
    state.lastSuccessOrigin = saved.lastSuccessOrigin;
    state.source = 'env';
    state.recentOrigins = saved.recentOrigins;
    state.connectionStatus = 'connected';
    state.lastError = '';
    return;
  }

  const preferredOrigin = saved.lastSuccessOrigin || saved.serverOrigin || envOrigin;
  const nextUrls = buildDerivedUrls(preferredOrigin);
  state.serverOrigin = preferredOrigin;
  state.apiBaseUrl = nextUrls.apiBaseUrl;
  state.socketUrl = nextUrls.socketUrl;
  state.lastVerifiedAt = saved.lastVerifiedAt;
  state.lastSuccessOrigin = saved.lastSuccessOrigin;
  state.source = preferredOrigin === envOrigin && !saved.lastSuccessOrigin ? 'env' : (saved.source || 'manual');
  state.recentOrigins = uniqueOrigins([saved.lastSuccessOrigin, saved.serverOrigin, envOrigin, ...saved.recentOrigins]);
  state.connectionStatus = preferredOrigin ? 'idle' : 'failed';
  state.lastError = preferredOrigin ? '' : '尚未配置可用服务器地址';
}

function toHostPrefix(address) {
  const parts = String(address || '').trim().split('.');
  if (parts.length !== 4) {
    return '';
  }

  return parts.slice(0, 3).join('.');
}

function extractHostOctet(origin) {
  try {
    return Number(new URL(origin).hostname.split('.').pop());
  } catch (error) {
    return 0;
  }
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

export async function verifyServerOrigin(origin, options = {}) {
  const normalizedOrigin = normalizeServerOrigin(origin);
  if (!normalizedOrigin) {
    return {
      ok: false,
      origin: '',
      reason: 'invalid_origin'
    };
  }

  const { signal, clear } = createTimeoutSignal(options.timeoutMs || NETWORK_SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizedOrigin}${DEFAULT_HEALTH_PATH}`, {
      method: 'GET',
      cache: 'no-store',
      signal
    });

    clear();

    if (!response.ok) {
      return {
        ok: false,
        origin: normalizedOrigin,
        reason: `http_${response.status}`,
        status: response.status
      };
    }

    const source = options.source || 'manual';
    if (options.persistSuccess !== false) {
      applyVerifiedOrigin(normalizedOrigin, source);
    }

    return {
      ok: true,
      origin: normalizedOrigin,
      status: response.status
    };
  } catch (error) {
    clear();
    return {
      ok: false,
      origin: normalizedOrigin,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      error
    };
  }
}

function buildCandidateOrigins(networkInfo = {}) {
  const recentOrigins = [...state.recentOrigins];
  const exactCandidates = uniqueOrigins([
    state.lastSuccessOrigin,
    state.serverOrigin,
    ...recentOrigins
  ]);

  const prefix = networkInfo.subnetPrefix || toHostPrefix(networkInfo.ipv4Address) || toHostPrefix(networkInfo.gatewayAddress);
  if (!prefix) {
    return exactCandidates;
  }

  const prioritizedHosts = [];
  const hostOctetCandidates = [
    extractHostOctet(state.lastSuccessOrigin),
    extractHostOctet(state.serverOrigin),
    Number(String(networkInfo.ipv4Address || '').split('.').pop()),
    Number(String(networkInfo.gatewayAddress || '').split('.').pop())
  ].filter((value) => Number.isInteger(value) && value > 1 && value < 255);

  hostOctetCandidates.forEach((host) => {
    for (let offset = -2; offset <= 2; offset += 1) {
      const next = host + offset;
      if (next > 1 && next < 255) {
        prioritizedHosts.push(next);
      }
    }
  });

  for (let host = 2; host <= 120; host += 1) {
    prioritizedHosts.push(host);
  }

  [128, 150, 168, 188, 200, 210, 220].forEach((host) => prioritizedHosts.push(host));

  const subnetOrigins = uniqueOrigins(
    prioritizedHosts
      .filter((host) => host > 1 && host < 255)
      .map((host) => normalizeServerOrigin(`${prefix}.${host}:${DEFAULT_PORT}`))
  );

  return uniqueOrigins([...exactCandidates, ...subnetOrigins]);
}

async function readNetworkInfo() {
  if (!isNativeAndroid()) {
    return {
      ipv4Address: '',
      gatewayAddress: '',
      subnetMask: '',
      subnetPrefix: ''
    };
  }

  return TeacherDeviceSettings.getNetworkInfo().catch(() => ({
    ipv4Address: '',
    gatewayAddress: '',
    subnetMask: '',
    subnetPrefix: ''
  }));
}

async function verifyCandidates(candidates) {
  let currentIndex = 0;
  let foundOrigin = '';

  async function worker() {
    while (!foundOrigin && currentIndex < candidates.length) {
      const targetIndex = currentIndex;
      currentIndex += 1;
      const candidate = candidates[targetIndex];

      const result = await verifyServerOrigin(candidate, {
        timeoutMs: NETWORK_SCAN_TIMEOUT_MS,
        persistSuccess: false
      });

      if (result.ok && !foundOrigin) {
        foundOrigin = result.origin;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(NETWORK_SCAN_CONCURRENCY, Math.max(candidates.length, 1)) },
    () => worker()
  );

  await Promise.all(workers);
  return foundOrigin;
}

export async function discoverServerOrigin() {
  if (isWebRuntime()) {
    return state.serverOrigin || getDefaultWebOrigin({ allowHttp: false });
  }

  if (discoveryPromise) {
    return discoveryPromise;
  }

  state.discovering = true;
  state.connectionStatus = 'checking';
  state.lastError = '';

  discoveryPromise = (async () => {
    const candidates = buildCandidateOrigins(await readNetworkInfo());

    if (!candidates.length) {
      markFailure('未拿到可用的局域网候选地址');
      return '';
    }

    const foundOrigin = await verifyCandidates(candidates);
    if (!foundOrigin) {
      markFailure('未自动发现可用服务器，请手动填写服务器地址');
      return '';
    }

    return applyVerifiedOrigin(foundOrigin, 'auto_discovered');
  })().finally(() => {
    state.discovering = false;
    discoveryPromise = null;
  });

  return discoveryPromise;
}

export async function bootstrapServerRuntime() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  if (state.initialized) {
    return state;
  }

  state.bootstrapping = true;

  bootstrapPromise = (async () => {
    seedInitialState();

    if (isNativeAndroid()) {
      await App.addListener('appStateChange', async (appState) => {
        if (!appState?.isActive) {
          return;
        }

        if (state.serverOrigin) {
          const result = await verifyServerOrigin(state.serverOrigin, {
            source: state.source || 'manual'
          });

          if (result.ok) {
            return;
          }
        }

        await discoverServerOrigin();
      });

      if (state.serverOrigin) {
        const result = await verifyServerOrigin(state.serverOrigin, {
          source: state.source || 'manual'
        });

        if (!result.ok) {
          await discoverServerOrigin();
        }
      } else {
        await discoverServerOrigin();
      }
    }

    state.initialized = true;
    state.bootstrapping = false;
    return state;
  })().finally(() => {
    bootstrapPromise = null;
    state.bootstrapping = false;
  });

  return bootstrapPromise;
}

export async function ensureServerRuntimeReady() {
  if (!state.initialized && !state.bootstrapping) {
    await bootstrapServerRuntime();
  } else if (bootstrapPromise) {
    await bootstrapPromise;
  }

  if (isNativeAndroid() && !state.serverOrigin && !discoveryPromise) {
    await discoverServerOrigin();
  } else if (discoveryPromise) {
    await discoveryPromise;
  }

  return state;
}

export function setServerOrigin(origin, options = {}) {
  const normalizedOrigin = applyServerOrigin(origin, options.source || 'manual');

  if (!normalizedOrigin && isNativeAndroid()) {
    markFailure('服务器地址格式无效');
  }

  return normalizedOrigin;
}

export function getServerOrigin() {
  return state.serverOrigin;
}

export function resolveApiBaseUrl() {
  return state.apiBaseUrl || (isWebRuntime() ? DEFAULT_API_PATH : '');
}

export function resolveSocketUrl() {
  return state.socketUrl || (isWebRuntime() ? getDefaultWebOrigin({ allowHttp: false }) : '');
}

export function getServerRuntimeState() {
  return readonly(state);
}

export async function refreshServerConnection() {
  if (isWebRuntime()) {
    return state;
  }

  if (state.serverOrigin) {
    const result = await verifyServerOrigin(state.serverOrigin, {
      source: state.source || 'manual'
    });

    if (result.ok) {
      return state;
    }
  }

  await discoverServerOrigin();
  return state;
}

export {
  normalizeServerOrigin
};
