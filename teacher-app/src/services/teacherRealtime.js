import { io } from 'socket.io-client';
import {
  ensureServerRuntimeReady,
  getServerRuntimeState,
  resolveSocketUrl
} from '../config/serverRuntime';

const TEACHER_PENDING_LEAVE_EVENT = 'teacher.leave.pending.created';

let socket = null;
let activeToken = '';
let activeCallbacks = {
  onPendingLeave: null,
  onUnauthorized: null
};
let runtimeWatcherAttached = false;

function getSocketTarget() {
  return resolveSocketUrl() || undefined;
}

function bindSocketListeners(onPendingLeave, onUnauthorized) {
  socket.on(TEACHER_PENDING_LEAVE_EVENT, (payload) => {
    onPendingLeave?.(payload);
  });

  socket.on('unauthorized', () => {
    onUnauthorized?.();
  });

  socket.on('connect_error', (error) => {
    if (error?.message === 'UNAUTHORIZED' || error?.message === 'FORBIDDEN') {
      onUnauthorized?.();
      return;
    }

    console.error('Teacher realtime connection failed:', error?.message || error);
  });
}

function ensureRuntimeWatcher() {
  if (runtimeWatcherAttached) {
    return;
  }

  runtimeWatcherAttached = true;
  const runtimeState = getServerRuntimeState();
  let lastSocketUrl = runtimeState.socketUrl || '';

  setInterval(() => {
    const nextSocketUrl = runtimeState.socketUrl || '';
    if (nextSocketUrl === lastSocketUrl) {
      return;
    }

    lastSocketUrl = nextSocketUrl;
    if (!activeToken) {
      return;
    }

    connectTeacherRealtime({
      token: activeToken,
      onPendingLeave: activeCallbacks.onPendingLeave,
      onUnauthorized: activeCallbacks.onUnauthorized
    }).catch((error) => {
      console.error('Teacher realtime reconnect failed:', error?.message || error);
    });
  }, 1000);
}

export async function connectTeacherRealtime({ token, onPendingLeave, onUnauthorized }) {
  ensureRuntimeWatcher();
  if (!token) {
    return null;
  }

  activeCallbacks = {
    onPendingLeave,
    onUnauthorized
  };

  await ensureServerRuntimeReady();
  const target = getSocketTarget();

  if (!target) {
    return null;
  }

  if (socket && activeToken === token && socket.io?.uri === target) {
    return socket;
  }

  disconnectTeacherRealtime();
  activeToken = token;

  socket = io(target, {
    autoConnect: true,
    reconnection: true,
    timeout: 10000,
    auth: {
      token
    },
    transports: ['websocket', 'polling']
  });

  bindSocketListeners(onPendingLeave, onUnauthorized);

  return socket;
}

export function disconnectTeacherRealtime() {
  if (!socket) {
    activeToken = '';
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = '';
}
