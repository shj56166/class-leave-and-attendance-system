<template>
  <div
    class="dashboard-shell"
    :class="{
      'dashboard-shell--mobile': isMobile,
      'dashboard-shell--no-blur': uiPreferencesStore.reduceEffects,
      'dashboard-shell--reduce-effects': uiPreferencesStore.reduceEffects
    }"
  >
    <aside v-if="!isMobile" class="dashboard-sidebar">
      <TeacherNavPanel
        :items="navItems"
        :active-route="activeMenu"
        :flow-mode-enabled="uiPreferencesStore.reduceEffects"
        :user-name="authStore.user?.realName || '教师'"
        :subtitle="displayClassName"
        @navigate="navigateTo"
        @toggle-flow-mode="uiPreferencesStore.setReduceEffects"
      />
    </aside>

    <div
      class="dashboard-main-shell"
      :class="{ 'dashboard-main-shell--immersive': hideMobileDashboardChrome }"
    >
      <header v-if="!hideMobileDashboardChrome" class="dashboard-header">
        <div class="header-content">
          <div class="header-main">
            <button
              v-if="isMobile"
              type="button"
              class="nav-toggle"
              aria-label="打开导航菜单"
              @click="isMobileNavOpen = true"
            >
              <span class="nav-toggle__bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <div class="header-title-group">
              <span class="header-title">{{ displayClassName }}</span>
              <span class="header-subtitle">{{ isMobile ? '教师端控制台' : '请假管理工作台' }}</span>
            </div>
          </div>

          <div class="header-actions">
            <span v-if="!isMobile && notificationStore.unreadCount" class="pending-chip">
              待审批 +{{ notificationStore.unreadCount }}
            </span>

            <button
              v-if="isMobile && notificationStore.unreadCount"
              type="button"
              class="user-chip user-chip--pending"
              @click="openApprovalFromHeader"
            >
              <span class="user-chip__avatar user-chip__avatar--pending">{{ notificationStore.unreadCount }}</span>
              <span class="user-chip__text user-chip__text--pending">待审批</span>
            </button>

            <el-dropdown v-else @command="handleCommand">
              <button type="button" class="user-chip">
                <span class="user-chip__avatar">{{ userInitial }}</span>
                <span class="user-chip__text">{{ authStore.user?.realName || '教师' }}</span>
                <el-icon><ArrowDown /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </header>

      <transition v-if="!hideMobileDashboardChrome" name="permission-banner">
        <button
          v-if="notificationStore.permissionReminderBanner"
          type="button"
          class="permission-banner"
          @click="openPermissionReminderCenter"
        >
          <span class="permission-banner__label">审批提醒</span>
          <span class="permission-banner__text">
            {{ notificationStore.permissionReminderBanner.text }}
          </span>
          <span class="permission-banner__action">立即完善</span>
          <span class="permission-banner__close" @click.stop="notificationStore.clearPermissionReminder()">
            <el-icon><Close /></el-icon>
          </span>
        </button>
      </transition>

      <transition v-if="!hideMobileDashboardChrome" name="approval-banner">
        <button
          v-if="notificationStore.activeBanner"
          type="button"
          class="approval-banner"
          @click="openApprovalFromBanner"
        >
          <span class="approval-banner__dot" />
          <span class="approval-banner__text">
            {{ notificationStore.activeBanner.text }}
          </span>
          <span class="approval-banner__action">查看审批</span>
          <span class="approval-banner__close" @click.stop="notificationStore.clearBanner()">
            <el-icon><Close /></el-icon>
          </span>
        </button>
      </transition>

      <main
        class="dashboard-main"
        :class="{ 'dashboard-main--immersive': hideMobileDashboardChrome }"
      >
        <router-view v-slot="{ Component, route: currentRoute }">
          <component
            v-if="uiPreferencesStore.reduceEffects"
            :is="Component"
            :key="currentRoute.path"
          />
          <transition v-else name="dashboard-panel-switch" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </transition>
        </router-view>
      </main>
    </div>

    <el-drawer
      v-model="isMobileNavOpen"
      direction="ltr"
      size="300px"
      :with-header="false"
      class="teacher-nav-drawer"
      append-to-body
    >
      <TeacherNavPanel
        v-if="isMobileNavOpen"
        :items="navItems"
        :active-route="activeMenu"
        :is-mobile="true"
        :flow-mode-enabled="uiPreferencesStore.reduceEffects"
        :user-name="authStore.user?.realName || '教师'"
        :subtitle="displayClassName"
        @navigate="handleMobileNavigate"
        @toggle-flow-mode="uiPreferencesStore.setReduceEffects"
      />
    </el-drawer>

    <ProjectConfirmDialog
      v-model="logoutConfirmVisible"
      title="退出确认"
      message="确定要退出当前教师账号吗？"
      :details="['退出后需要重新登录才能再次进入教师端。']"
      confirm-text="退出登录"
      confirm-type="warning"
      @confirm="confirmLogout"
    />

    <TeacherNotificationPopup
      :model-value="Boolean(notificationStore.activePopup)"
      :popup="notificationStore.activePopup"
      @update:model-value="handleNotificationPopupVisibleChange"
      @open="openApprovalFromPopup"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDown, Close } from '@element-plus/icons-vue';
import ProjectConfirmDialog from '../components/ProjectConfirmDialog.vue';
import TeacherNotificationPopup from '../components/TeacherNotificationPopup.vue';
import TeacherNavPanel from '../components/TeacherNavPanel.vue';
import { TEACHER_DISPLAY_CLASS_NAME } from '../constants/display';
import { teacherNavigationItems } from '../constants/navigation';
import {
  APPROVAL_REMINDER_PERMISSIONS_ROUTE,
  APPROVAL_ROUTE
} from '../constants/notifications';
import { getCurrentTeacher } from '../api/teacher';
import { useAuthStore } from '../stores/auth';
import { useTeacherNotificationsStore } from '../stores/notifications';
import { useUiPreferencesStore } from '../stores/uiPreferences';
import { connectTeacherRealtime, disconnectTeacherRealtime } from '../services/teacherRealtime';
import {
  bootstrapTeacherNotificationRuntime,
  presentTeacherPendingLeaveNotification,
  syncTeacherNotificationSession
} from '../services/teacherNotificationRuntime';
import {
  cleanupTeacherAuthenticatedSession,
  expireTeacherAuthenticatedSession
} from '../services/teacherSessionCleanup';

const MOBILE_MEDIA_QUERY = '(max-width: 960px)';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useTeacherNotificationsStore();
const uiPreferencesStore = useUiPreferencesStore();
const logoutConfirmVisible = ref(false);
const isMobileNavOpen = ref(false);
const isMobile = ref(false);

let mediaQuery = null;

const activeMenu = computed(() => route.path);
const navItems = computed(() => teacherNavigationItems.filter((item) => !item.adminOnly || authStore.user?.role === 'admin'));
const userInitial = computed(() => authStore.user?.realName?.trim()?.charAt(0) || '师');
const displayClassName = computed(() => TEACHER_DISPLAY_CLASS_NAME);
const hideMobileDashboardChrome = computed(() => (
  isMobile.value && route.path === APPROVAL_REMINDER_PERMISSIONS_ROUTE
));

const applyMobileState = (matches) => {
  isMobile.value = matches;

  if (!matches) {
    isMobileNavOpen.value = false;
  }
};

const handleMediaChange = (event) => {
  applyMobileState(event.matches);
};

const navigateTo = (targetRoute) => {
  if (targetRoute !== route.path) {
    router.push(targetRoute);
  }
};

const handleMobileNavigate = (targetRoute) => {
  navigateTo(targetRoute);
  isMobileNavOpen.value = false;
};

const navigateToProtectedRoute = (targetRoute, options = {}) => {
  if (!authStore.isLoggedIn) {
    router.replace('/');
    return false;
  }

  const method = options.replace ? 'replace' : 'push';
  router[method](targetRoute);
  return true;
};

const openApprovalFromBanner = () => {
  notificationStore.clearBanner();
  notificationStore.clearPopup();
  if (route.path !== APPROVAL_ROUTE) {
    router.push(APPROVAL_ROUTE);
  }
};

const openApprovalFromHeader = () => {
  if (route.path !== APPROVAL_ROUTE) {
    router.push(APPROVAL_ROUTE);
    return;
  }

  notificationStore.markApprovalRefreshed();
};

const openApprovalFromPopup = () => {
  notificationStore.clearPopup();
  openApprovalFromBanner();
};

const openPermissionReminderCenter = () => {
  notificationStore.clearPermissionReminder();
  if (route.path !== APPROVAL_REMINDER_PERMISSIONS_ROUTE) {
    navigateToProtectedRoute(APPROVAL_REMINDER_PERMISSIONS_ROUTE);
  }
};

const handleNotificationPopupVisibleChange = (visible) => {
  if (!visible) {
    notificationStore.clearPopup();
  }
};

const handleCommand = (command) => {
  if (command === 'logout') {
    requestTeacherLogout();
  }
};

const requestTeacherLogout = () => {
  logoutConfirmVisible.value = true;
};

const syncCurrentTeacherProfile = async () => {
  if (!authStore.token) {
    return;
  }

  try {
    const response = await getCurrentTeacher();
    if (response?.teacher) {
      authStore.setUser(response.teacher);
    }
  } catch (error) {
    console.error('同步教师资料失败:', error);
  }
};

const handleRealtimeUnauthorized = () => {
  expireTeacherAuthenticatedSession();
};

const handlePendingLeaveNotification = (payload) => {
  const isApprovalPage = route.path === APPROVAL_ROUTE;
  const leaveRequestId = Number(payload?.leaveRequestId || 0);
  console.info('Teacher pending leave realtime event received.', {
    source: 'socket.io_foreground',
    leaveRequestId: leaveRequestId || null,
    appIsActive: notificationStore.permissionStatus?.appIsActive ?? true,
    jpushEnabled: notificationStore.permissionStatus?.jpushEnabled ?? false,
    jpushRegistrationIdReady: notificationStore.permissionStatus?.jpushRegistrationIdReady ?? false
  });

  notificationStore.updatePermissionStatusPartial({
    lastRealtimeNotificationAt: Date.now(),
    lastRealtimeLeaveRequestId: leaveRequestId
  });

  const accepted = notificationStore.handlePendingLeave(payload, {
    showBanner: !isApprovalPage
  });

  if (!accepted) {
    return;
  }

  presentTeacherPendingLeaveNotification(payload, notificationStore).catch((error) => {
    console.error('Teacher local notification fallback failed:', error);
  });

  if (isApprovalPage) {
    notificationStore.clearBanner();
  }
};

const syncRealtimeConnection = (token) => {
  if (!token) {
    disconnectTeacherRealtime();
    notificationStore.reset();
    return;
  }

  connectTeacherRealtime({
    token,
    onPendingLeave: handlePendingLeaveNotification,
    onUnauthorized: handleRealtimeUnauthorized
  }).catch((error) => {
    console.error('Teacher realtime bootstrap failed:', error);
  });
};

const confirmLogout = async () => {
  logoutConfirmVisible.value = false;
  await cleanupTeacherAuthenticatedSession();
};

provide('requestTeacherLogout', requestTeacherLogout);

watch(
  () => route.path,
  () => {
    if (route.path === APPROVAL_ROUTE) {
      notificationStore.clearBanner();
      notificationStore.clearPopup();
    }

    if (route.path === APPROVAL_REMINDER_PERMISSIONS_ROUTE) {
      notificationStore.clearPermissionReminder();
    }

    if (isMobile.value) {
      isMobileNavOpen.value = false;
    }
  }
);

watch(
  () => authStore.token,
  (token) => {
    syncRealtimeConnection(token);
    syncTeacherNotificationSession({
      token,
      notificationStore,
      router
    }).catch((error) => {
      console.error('Sync teacher notification session failed:', error);
    });
  },
  { immediate: true }
);

onMounted(() => {
  syncCurrentTeacherProfile();
  bootstrapTeacherNotificationRuntime({
    router,
    notificationStore
  }).catch((error) => {
    console.error('Bootstrap teacher notification runtime failed:', error);
  });

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }

  mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  applyMobileState(mediaQuery.matches);

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleMediaChange);
  }
});

onBeforeUnmount(() => {
  disconnectTeacherRealtime();

  if (!mediaQuery) {
    return;
  }

  if (typeof mediaQuery.removeEventListener === 'function') {
    mediaQuery.removeEventListener('change', handleMediaChange);
  } else if (typeof mediaQuery.removeListener === 'function') {
    mediaQuery.removeListener(handleMediaChange);
  }
});
</script>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  gap: 20px;
  padding: 18px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.18) 0%, rgba(59, 130, 246, 0) 32%),
    radial-gradient(circle at bottom left, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0) 28%),
    linear-gradient(135deg, #eff6ff 0%, #dbeafe 58%, #bfdbfe 100%);
}

.dashboard-shell--mobile {
  display: block;
  padding: 12px;
}

.dashboard-sidebar {
  width: 244px;
  flex: 0 0 244px;
  align-self: flex-start;
  position: sticky;
  top: 18px;
  height: calc(100dvh - 36px);
}

.dashboard-main-shell {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-main-shell--immersive {
  gap: 0;
}

.dashboard-header {
  padding: 14px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 18px 40px rgba(148, 163, 184, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.ui-can-blur .dashboard-header {
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.header-main,
.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-main {
  min-width: 0;
  flex: 1 1 auto;
}

.header-actions {
  justify-content: flex-end;
  flex: 0 0 auto;
  min-width: 0;
}

.header-title-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #12316f;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-subtitle {
  font-size: 12px;
  color: #5c739e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pending-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(239, 246, 255, 0.9);
  border: 1px solid rgba(59, 130, 246, 0.18);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.nav-toggle,
.user-chip,
.approval-banner,
.permission-banner {
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.78);
  color: #1e3a8a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.nav-toggle {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.nav-toggle__bars {
  width: 18px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.nav-toggle__bars span {
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.user-chip {
  min-height: 46px;
  max-width: 100%;
  padding: 6px 12px 6px 8px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.user-chip--pending {
  min-width: 0;
  border-color: rgba(37, 99, 235, 0.18);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.86) 100%);
}

.user-chip__avatar {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.user-chip__avatar--pending {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.user-chip__text {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.user-chip__text--pending {
  max-width: none;
  color: #1d4ed8;
  font-weight: 700;
}

.permission-banner,
.approval-banner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.permission-banner {
  padding: 12px 16px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(244, 249, 255, 0.96) 0%, rgba(233, 244, 255, 0.92) 100%);
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow:
    0 14px 30px rgba(59, 130, 246, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.permission-banner__label {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.10);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.permission-banner__text {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
  color: #1f4b8f;
}

.permission-banner__action {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.permission-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #5c739e;
}

.approval-banner {
  padding: 14px 16px;
  border-radius: 20px;
  box-shadow:
    0 18px 40px rgba(37, 99, 235, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.approval-banner__dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.12);
}

.approval-banner__text {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 14px;
  font-weight: 600;
  color: #173b7a;
}

.approval-banner__action {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.approval-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #5c739e;
}

.dashboard-main {
  min-width: 0;
  flex: 1 1 auto;
}

.dashboard-main--immersive {
  padding-top: 0;
}

:deep(.teacher-nav-drawer) {
  --el-drawer-bg-color: transparent;
}

:deep(.teacher-nav-drawer .el-drawer) {
  box-shadow: none;
  background: transparent;
}

:deep(.teacher-nav-drawer .el-drawer__body) {
  padding: 14px 0 14px 14px;
}

@media (max-width: 960px) {
  .dashboard-shell {
    gap: 0;
  }

  .dashboard-main-shell--immersive {
    gap: 0;
  }

  .dashboard-sidebar {
    position: static;
    height: auto;
  }

  .dashboard-header {
    padding: 12px 14px;
    border-radius: 20px;
    position: sticky;
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    z-index: 30;
  }

  .header-title {
    font-size: 16px;
  }

  .header-content {
    align-items: center;
    flex-wrap: nowrap;
  }

  .header-main {
    flex: 1 1 auto;
  }

  .header-actions {
    flex: 0 0 auto;
    min-width: 0;
    flex-wrap: nowrap;
    gap: 10px;
  }

  .user-chip--pending {
    max-width: 132px;
  }

  .dashboard-main--immersive {
    margin-top: 0;
  }
}

@media (max-width: 640px) {
  .dashboard-shell--mobile {
    padding: 10px;
  }

  .header-content {
    gap: 12px;
  }

  .header-main {
    gap: 10px;
  }

  .header-actions {
    justify-content: flex-end;
  }

  .user-chip {
    min-width: 0;
    max-width: 148px;
    padding-right: 10px;
  }

  .user-chip__text {
    max-width: 72px;
  }

  .permission-banner,
  .approval-banner {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .permission-banner__text {
    width: calc(100% - 88px);
  }

  .approval-banner__text {
    width: calc(100% - 22px);
  }

  .dashboard-main {
    padding-top: 2px;
  }
}
</style>

<style>
.dashboard-panel-switch-leave-active {
  transition: all 0.15s ease-in;
}

.dashboard-panel-switch-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.dashboard-panel-switch-enter-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dashboard-panel-switch-enter-from {
  opacity: 0;
  transform: translateY(20px);
  filter: blur(15px);
}

.approval-banner-enter-active,
.approval-banner-leave-active,
.permission-banner-enter-active,
.permission-banner-leave-active {
  transition: all 0.24s ease;
}

.approval-banner-enter-from,
.approval-banner-leave-to,
.permission-banner-enter-from,
.permission-banner-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-panel-switch-leave-active,
  .dashboard-panel-switch-enter-active,
  .approval-banner-enter-active,
  .approval-banner-leave-active,
  .permission-banner-enter-active,
  .permission-banner-leave-active {
    transition-duration: 0.01ms !important;
  }
}

.ui-reduced-motion .dashboard-panel-switch-leave-active,
.ui-reduced-motion .dashboard-panel-switch-enter-active,
.ui-reduced-motion .approval-banner-enter-active,
.ui-reduced-motion .approval-banner-leave-active,
.ui-reduced-motion .permission-banner-enter-active,
.ui-reduced-motion .permission-banner-leave-active {
  transition-duration: 0.01ms !important;
}

.ui-user-reduce-effects .dashboard-panel-switch-leave-active,
.ui-user-reduce-effects .dashboard-panel-switch-enter-active,
.ui-user-reduce-effects .approval-banner-enter-active,
.ui-user-reduce-effects .approval-banner-leave-active,
.ui-user-reduce-effects .permission-banner-enter-active,
.ui-user-reduce-effects .permission-banner-leave-active {
  transition-duration: 0.01ms !important;
}

.ui-user-reduce-effects .dashboard-panel-switch-enter-from,
.ui-user-reduce-effects .dashboard-panel-switch-leave-to,
.ui-user-reduce-effects .approval-banner-enter-from,
.ui-user-reduce-effects .approval-banner-leave-to,
.ui-user-reduce-effects .permission-banner-enter-from,
.ui-user-reduce-effects .permission-banner-leave-to {
  opacity: 1 !important;
  transform: none !important;
  filter: none !important;
}
</style>
