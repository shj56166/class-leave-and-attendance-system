import { ElMessage } from 'element-plus';
import router from '../router';
import { useAuthStore } from '../stores/auth';
import { useTeacherNotificationsStore } from '../stores/notifications';
import { destroyTeacherNotificationSession } from './teacherNotificationRuntime';
import { disconnectTeacherRealtime } from './teacherRealtime';

const LOGIN_ROUTE = '/';

let activeCleanupPromise = null;
let activeSessionExpiredPromise = null;

function clearTeacherAuthStorageFallback() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('teacher_user');
  } catch (error) {
    // Ignore storage cleanup failures and continue with in-memory teardown.
  }
}

function resetTeacherSessionStores() {
  try {
    useTeacherNotificationsStore().reset();
  } catch (error) {
    // Ignore Pinia availability issues and continue with storage fallback.
  }

  try {
    useAuthStore().logout();
    return;
  } catch (error) {
    clearTeacherAuthStorageFallback();
  }
}

async function navigateToLoginRoute() {
  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = router.currentRoute.value?.path || window.location.pathname;
  if (currentPath === LOGIN_ROUTE) {
    return;
  }

  try {
    await router.replace(LOGIN_ROUTE);
  } catch (error) {
    window.location.href = LOGIN_ROUTE;
  }
}

export async function cleanupTeacherAuthenticatedSession(options = {}) {
  const {
    redirectToLogin = true
  } = options;

  if (activeCleanupPromise) {
    return activeCleanupPromise;
  }

  activeCleanupPromise = (async () => {
    disconnectTeacherRealtime();
    await destroyTeacherNotificationSession().catch(() => {});
    resetTeacherSessionStores();

    if (redirectToLogin) {
      await navigateToLoginRoute();
    }
  })();

  try {
    await activeCleanupPromise;
  } finally {
    activeCleanupPromise = null;
  }
}

export async function expireTeacherAuthenticatedSession(
  message = '教师登录已失效，请重新登录'
) {
  if (activeSessionExpiredPromise) {
    return activeSessionExpiredPromise;
  }

  activeSessionExpiredPromise = (async () => {
    ElMessage.warning(message);
    await cleanupTeacherAuthenticatedSession();
  })();

  try {
    await activeSessionExpiredPromise;
  } finally {
    activeSessionExpiredPromise = null;
  }
}
