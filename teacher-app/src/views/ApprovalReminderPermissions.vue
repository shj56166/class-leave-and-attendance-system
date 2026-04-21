<template>
  <div class="permission-page">
    <el-card class="permission-shell glass-card">
      <header class="permission-topbar">
        <button
          type="button"
          class="permission-icon-button"
          aria-label="返回"
          @click="handleBack"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>

        <div class="permission-topbar__copy">
          <span class="permission-topbar__eyebrow">Approval Reminder</span>
          <h1>审批提醒权限</h1>
          <p>把提醒服务、通知权限和后台保护检查完整；远程推送未就绪时会退回后台兜底提醒，可能存在系统延迟。</p>
        </div>

        <button
          type="button"
          class="permission-refresh-button"
          :disabled="refreshing"
          @click="handleRefresh()"
        >
          <el-icon :class="{ 'is-rotating': refreshing }">
            <RefreshRight />
          </el-icon>
          <span>刷新</span>
        </button>
      </header>

      <section class="permission-overview">
        <section class="permission-summary-card">
          <article class="permission-summary-item">
            <div class="permission-summary-item__main">
              <el-icon class="permission-summary-item__icon" :class="{ 'is-ready': consentReady }">
                <CircleCheckFilled v-if="consentReady" />
                <Clock v-else />
              </el-icon>
              <span>提醒服务</span>
            </div>
            <strong>{{ consentReady ? '已启用' : '待启用' }}</strong>
          </article>

          <article class="permission-summary-item">
            <div class="permission-summary-item__main">
              <el-icon class="permission-summary-item__icon" :class="{ 'is-ready': notificationReady }">
                <CircleCheckFilled v-if="notificationReady" />
                <Clock v-else />
              </el-icon>
              <span>通知权限</span>
            </div>
            <strong>{{ notificationReady ? '已开启' : '待开启' }}</strong>
          </article>

          <article class="permission-summary-item">
            <div class="permission-summary-item__main">
              <el-icon class="permission-summary-item__icon" :class="{ 'is-ready': batteryReady }">
                <CircleCheckFilled v-if="batteryReady" />
                <Clock v-else />
              </el-icon>
              <span>后台保护</span>
            </div>
            <strong>{{ batteryReady ? '已放行' : '待处理' }}</strong>
          </article>
        </section>

        <section class="permission-hero" :class="{ 'is-complete': isCompleted }">
          <div class="permission-hero__icon">
            <el-icon>
              <component :is="isCompleted ? CircleCheckFilled : Opportunity" />
            </el-icon>
          </div>

          <div class="permission-hero__copy">
            <strong>{{ heroSummaryTitle }}</strong>
            <p>{{ heroSummaryText }}</p>
          </div>

          <el-button
            class="teacher-action-button teacher-action-button--primary permission-hero__button"
            type="primary"
            size="small"
            :loading="activeAction === heroPrimaryActionKey"
            @click="handleHeroPrimaryAction"
          >
            {{ heroPrimaryActionText }}
          </el-button>
        </section>

        <section class="permission-bulk-card">
          <div class="permission-bulk-card__copy">
            <strong>{{ bulkActionTitle }}</strong>
            <p>{{ bulkActionDescription }}</p>
          </div>

          <el-button
            class="teacher-action-button teacher-action-button--primary permission-bulk-card__button"
            type="primary"
            size="small"
            :loading="activeAction === bulkActionKey"
            @click="handleBulkGuidanceAction"
          >
            {{ bulkActionButtonText }}
          </el-button>
        </section>
      </section>

      <section class="permission-steps-card">
        <article
          class="permission-step"
          :class="{
            'permission-step--focus': highlightConsentStep,
            'permission-step--done': consentReady
          }"
        >
          <div class="permission-step__head">
            <div class="permission-step__icon">
              <el-icon><Promotion /></el-icon>
            </div>

            <div class="permission-step__copy">
              <div class="permission-step__meta">
                <span class="permission-step__index">步骤 1</span>
                <span class="permission-step__badge" :class="{ 'is-ready': consentReady }">
                  {{ consentReady ? '已完成' : '必做' }}
                </span>
              </div>
              <h3>启用提醒服务</h3>
              <p>启用后系统才会开始初始化推送能力，并继续申请 Registration ID。</p>
            </div>
          </div>

          <div class="permission-step__actions">
            <el-button
              class="teacher-action-button teacher-action-button--primary"
              type="primary"
              size="small"
              :disabled="consentReady"
              :loading="activeAction === 'consent'"
              @click="handleEnsureConsent"
            >
              {{ consentReady ? '已启用' : '立即启用' }}
            </el-button>
          </div>
        </article>

        <article class="permission-step" :class="{ 'permission-step--done': notificationReady }">
          <div class="permission-step__head">
            <div class="permission-step__icon">
              <el-icon><BellFilled /></el-icon>
            </div>

            <div class="permission-step__copy">
              <div class="permission-step__meta">
                <span class="permission-step__index">步骤 2</span>
                <span class="permission-step__badge" :class="{ 'is-ready': notificationReady }">
                  {{ notificationReady ? '已完成' : '必做' }}
                </span>
              </div>
              <h3>通知权限</h3>
              <p>确认 App 通知权限和系统通知总开关都已打开。</p>
            </div>
          </div>

          <div class="permission-step__actions">
            <el-button
              class="teacher-action-button teacher-action-button--primary"
              type="primary"
              size="small"
              :loading="activeAction === 'notification'"
              @click="handleRequestNotificationPermission"
            >
              {{ notificationReady ? '重新检查' : '开启通知' }}
            </el-button>
            <el-button
              class="teacher-action-button teacher-action-button--secondary"
              size="small"
              :loading="activeAction === 'notification-settings'"
              @click="handleOpenNotificationSettings"
            >
              系统设置
            </el-button>
          </div>
        </article>

        <article class="permission-step" :class="{ 'permission-step--done': batteryReady }">
          <div class="permission-step__head">
            <div class="permission-step__icon">
              <el-icon><SetUp /></el-icon>
            </div>

            <div class="permission-step__copy">
              <div class="permission-step__meta">
                <span class="permission-step__index">步骤 3</span>
                <span class="permission-step__badge" :class="{ 'is-ready': batteryReady }">
                  {{ batteryReady ? '已完成' : '必做' }}
                </span>
              </div>
              <h3>后台保护</h3>
              <p>关闭电池优化，减少应用被系统限制后导致的延迟提醒；后台兜底不承诺分钟级准点。</p>
            </div>
          </div>

          <div class="permission-step__actions permission-step__actions--center">
            <el-button
              class="teacher-action-button teacher-action-button--secondary"
              size="small"
              :loading="activeAction === 'battery'"
              @click="handleOpenBatterySettings"
            >
              打开设置
            </el-button>
          </div>
        </article>

        <article class="permission-step permission-step--optional">
          <div class="permission-step__head">
            <div class="permission-step__icon">
              <el-icon><SwitchButton /></el-icon>
            </div>

            <div class="permission-step__copy">
              <div class="permission-step__meta">
                <span class="permission-step__index">步骤 4</span>
                <span class="permission-step__badge" :class="{ 'is-ready': autoStartRecommendedReady }">
                  {{ autoStartRecommendedReady ? '可跳过' : '建议项' }}
                </span>
              </div>
              <h3>自启动</h3>
              <p>{{ autoStartSummary }}</p>
            </div>
          </div>

          <div class="permission-step__actions permission-step__actions--center">
            <el-button
              class="teacher-action-button teacher-action-button--secondary"
              size="small"
              :disabled="!canOpenAutoStartSettings"
              :loading="activeAction === 'auto-start'"
              @click="handleOpenAutoStartSettings"
            >
              {{ canOpenAutoStartSettings ? '打开自启动设置' : '手动检查即可' }}
            </el-button>
          </div>
        </article>
      </section>

      <p v-if="vendorHintText" class="permission-inline-hint">
        {{ vendorHintText }}
      </p>

      <footer class="permission-footer">
        <p class="permission-footer__text">{{ footerText }}</p>

        <div class="permission-footer__actions">
          <el-button
            v-if="isCompleted"
            class="teacher-action-button teacher-action-button--primary"
            type="primary"
            size="small"
            @click="handleGoApproval"
          >
            返回审批页
          </el-button>
          <el-button
            class="teacher-action-button"
            :class="isCompleted ? 'teacher-action-button--secondary' : 'teacher-action-button--primary'"
            :type="isCompleted ? 'default' : 'primary'"
            size="small"
            @click="handleGoSettings"
          >
            {{ isCompleted ? '返回设置页' : '查看设置页' }}
          </el-button>
        </div>
      </footer>
    </el-card>
  </div>
</template>

<script setup>
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  BellFilled,
  CircleCheckFilled,
  Clock,
  Opportunity,
  Promotion,
  RefreshRight,
  SetUp,
  SwitchButton
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { APPROVAL_ROUTE } from '../constants/notifications';
import { useAuthStore } from '../stores/auth';
import { useTeacherNotificationsStore } from '../stores/notifications';
import {
  ensureTeacherPushConsent,
  hasTeacherSeenInitialPermissionGuide,
  markTeacherInitialPermissionGuideShown,
  openTeacherAutoStartSettings,
  openTeacherBatteryOptimizationSettings,
  openTeacherNotificationSettings,
  refreshTeacherPermissionStatus,
  requestTeacherNotificationPermission,
  startTeacherBulkPermissionFlow
} from '../services/teacherNotificationRuntime';

const SETTINGS_ROUTE = '/dashboard/settings';
const LOGIN_ROUTE = '/';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useTeacherNotificationsStore();
const refreshing = ref(false);
const activeAction = ref('');
const enteredAsFirstVisit = ref(false);

const isAndroidRuntime = computed(() => Capacitor.getPlatform() === 'android');
const permissionStatus = computed(() => notificationStore.permissionStatus || {});
const consentReady = computed(() => Boolean(permissionStatus.value.consentGranted));
const notificationReady = computed(() => (
  Boolean(permissionStatus.value.notificationsGranted && permissionStatus.value.notificationsEnabled)
));
const batteryReady = computed(() => Boolean(permissionStatus.value.batteryOptimizationIgnored));
const permissionReady = computed(() => consentReady.value && notificationReady.value && batteryReady.value);
const canOpenAutoStartSettings = computed(() => Boolean(permissionStatus.value.canOpenAutoStartSettings));
const autoStartRecommendedReady = computed(() => !canOpenAutoStartSettings.value);
const isCompleted = computed(() => permissionReady.value);
const highlightConsentStep = computed(() => (
  enteredAsFirstVisit.value && isAndroidRuntime.value && !consentReady.value
));

const heroPrimaryActionKey = computed(() => {
  if (!consentReady.value) {
    return 'consent';
  }

  if (!isCompleted.value) {
    return 'bulk';
  }

  return 'complete';
});

const bulkActionKey = computed(() => (isAndroidRuntime.value ? 'bulk' : 'web-check'));

const bulkActionTitle = computed(() => (
  isAndroidRuntime.value
    ? '一键检查推荐权限链路'
    : '浏览器端仅做状态检查'
));

const bulkActionDescription = computed(() => (
  isAndroidRuntime.value
    ? '按“通知权限 → 电池优化/后台保护 → 自启动入口”的顺序串联现有流程，不会新增系统外能力。'
    : 'Windows / Web 端不会尝试原生设置跳转，只会刷新当前浏览器通知状态并展示说明。'
));

const bulkActionButtonText = computed(() => (
  isAndroidRuntime.value ? '一键申请推荐权限' : '检查浏览器状态'
));

const heroPrimaryActionText = computed(() => {
  if (!consentReady.value) {
    return '启用提醒服务';
  }

  if (!isCompleted.value) {
    return '继续完成设置';
  }

  return '返回审批页';
});

const heroSummaryTitle = computed(() => {
  if (isCompleted.value) {
    return '当前设备已能稳定接收审批提醒';
  }

  if (!consentReady.value) {
    return '先启用提醒服务';
  }

  return '继续补齐通知和后台保护';
});

const heroSummaryText = computed(() => {
  if (isCompleted.value) {
    return '后续不需要再频繁进入权限页；提醒会优先走远程推送，未命中时再走后台兜底，可能存在系统延迟。';
  }

  if (!consentReady.value) {
    return '这是推送初始化前的第一步，启用后系统才会继续注册提醒能力。';
  }

  return '建议按下面顺序处理，完成后再刷新一次确认状态；远程推送未就绪时不要把后台兜底当作实时替代。';
});

const autoStartSummary = computed(() => {
  const manufacturer = String(permissionStatus.value.manufacturer || '').toLowerCase();
  const vendorPushReady = (
    (manufacturer.includes('vivo') || manufacturer.includes('iqoo')) && permissionStatus.value.vivoPushConfigured
  ) || (
    (manufacturer.includes('honor') || manufacturer.includes('荣耀')) && permissionStatus.value.honorPushConfigured
  );

  return vendorPushReady
    ? '已检测到当前机型的厂商通道参数，建议继续保留自启动和后台保护设置。'
    : '当前机型的厂商通道仍待补齐，自启动和后台保护对通知稳定性仍然很重要；若厂商页打不开，请按系统设置手动检查。';
});

const vendorHintText = computed(() => {
  const manufacturer = String(permissionStatus.value.manufacturer || '').toLowerCase();

  if (manufacturer.includes('vivo') || manufacturer.includes('iqoo')) {
    return permissionStatus.value.vivoPushConfigured
      ? 'Vivo / iQOO 机型已检测到厂商通道参数，仍建议放开自启动和后台保护。'
      : 'Vivo / iQOO 机型当前缺少 VIVO_APPKEY / VIVO_APPID，后台远程推送稳定性会受影响。';
  }

  if (manufacturer.includes('honor') || manufacturer.includes('荣耀')) {
    return permissionStatus.value.honorPushConfigured
      ? '荣耀机型已检测到厂商通道参数，仍建议重点检查通知权限和后台保护设置。'
      : '荣耀机型当前缺少 HONOR_APPID，后台远程推送稳定性会受影响。';
  }

  return '';
});

const footerText = computed(() => (
  isCompleted.value
    ? '权限已经准备完成，后续可在设置页查看更详细的诊断信息。'
    : `如果你刚从系统设置返回，可以点右上角刷新，页面会重新读取最新权限状态。${isAndroidRuntime.value ? '' : ' 当前平台只做状态检查，不会执行原生设置跳转。'}`
));

function navigateToProtectedRoute(targetRoute, options = {}) {
  if (!authStore.isLoggedIn) {
    router.replace(LOGIN_ROUTE);
    return false;
  }

  const method = options.replace ? 'replace' : 'push';
  router[method](targetRoute);
  return true;
}

function handleGoApproval() {
  navigateToProtectedRoute(APPROVAL_ROUTE);
}

function handleGoSettings() {
  navigateToProtectedRoute(SETTINGS_ROUTE);
}

function handleBack() {
  if (!authStore.isLoggedIn) {
    router.replace(LOGIN_ROUTE);
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  handleGoSettings();
}

async function runAction(key, action, successMessage, errorMessage) {
  activeAction.value = key;

  try {
    await action();
    if (successMessage) {
      ElMessage.success(successMessage);
    }
  } catch (error) {
    ElMessage.error(errorMessage);
  } finally {
    activeAction.value = '';
  }
}

async function handleRefresh(options = {}) {
  if (refreshing.value) {
    return;
  }

  const silent = Boolean(options.silent);
  refreshing.value = true;

  try {
    await refreshTeacherPermissionStatus(notificationStore, {
      allowAutoNavigate: false
    });

    if (!silent) {
      ElMessage.success('权限状态已刷新');
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error('刷新权限状态失败，请稍后再试');
    }
  } finally {
    refreshing.value = false;
  }
}

async function handleEnsureConsent() {
  await runAction(
    'consent',
    async () => {
      await ensureTeacherPushConsent(notificationStore);
    },
    '提醒服务已启用',
    '启用提醒服务失败，请稍后再试'
  );
}

async function handleRequestNotificationPermission() {
  await runAction(
    'notification',
    async () => {
      await requestTeacherNotificationPermission(notificationStore);
    },
    '通知状态已刷新',
    '请求通知权限失败，请稍后再试'
  );
}

async function handleOpenNotificationSettings() {
  await runAction(
    'notification-settings',
    async () => {
      await openTeacherNotificationSettings(notificationStore);
    },
    '已打开系统通知设置',
    '打开系统通知设置失败'
  );
}

async function handleOpenBatterySettings() {
  await runAction(
    'battery',
    async () => {
      await openTeacherBatteryOptimizationSettings(notificationStore);
    },
    '已打开后台保护设置',
    '打开后台保护设置失败'
  );
}

async function handleOpenAutoStartSettings() {
  await runAction(
    'auto-start',
    async () => {
      await openTeacherAutoStartSettings(notificationStore);
    },
    '',
    '打开自启动设置失败'
  );
}

async function handleStartBulkFlow() {
  await runAction(
    'bulk',
    async () => {
      await startTeacherBulkPermissionFlow(notificationStore);
    },
    '已开始继续检查推荐设置',
    '启动推荐设置流程失败，请稍后再试'
  );
}

async function handleBulkGuidanceAction() {
  if (isAndroidRuntime.value) {
    await handleStartBulkFlow();
    return;
  }

  await handleRefresh({ silent: true });
  ElMessage.info('Windows / Web 平台仅检查浏览器通知状态，不会尝试原生权限跳转。');
}

async function handleHeroPrimaryAction() {
  if (!consentReady.value) {
    await handleEnsureConsent();
    return;
  }

  if (!isCompleted.value) {
    await handleStartBulkFlow();
    return;
  }

  handleGoApproval();
}

onMounted(() => {
  notificationStore.clearPermissionReminder();

  Promise.resolve().then(async () => {
    if (isAndroidRuntime.value) {
      enteredAsFirstVisit.value = !(await hasTeacherSeenInitialPermissionGuide());
      await markTeacherInitialPermissionGuideShown('page_entry');
    }

    await handleRefresh({ silent: true });
  }).catch(() => {});
});
</script>

<style scoped>
.permission-page {
  height: 100%;
}

.glass-card {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.62) !important;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important;
  border-radius: 20px !important;
}

.permission-shell {
  min-height: 100%;
}

:deep(.permission-shell .el-card__body) {
  padding: 16px !important;
}

.permission-topbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.65);
}

.permission-topbar__copy {
  min-width: 0;
}

.permission-topbar__eyebrow {
  display: block;
  margin-bottom: 5px;
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7b8fb3;
  font-weight: 700;
}

.permission-topbar__copy h1 {
  margin: 0;
  font-size: 17px;
  line-height: 1.15;
  color: #12316f;
}

.permission-topbar__copy p {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #60759d;
}

.permission-icon-button,
.permission-refresh-button {
  border: 1px solid rgba(203, 215, 232, 0.95);
  background: rgba(255, 255, 255, 0.8);
  color: #1f4fb9;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 10px 22px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.permission-icon-button {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.permission-icon-button :deep(.el-icon) {
  font-size: 16px;
}

.permission-refresh-button {
  min-width: 72px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
}

.permission-refresh-button:disabled {
  opacity: 0.7;
  cursor: default;
}

.permission-refresh-button :deep(.el-icon) {
  font-size: 13px;
}

.is-rotating {
  animation: permission-spin 0.8s linear infinite;
}

.permission-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.65);
}

.permission-summary-card,
.permission-steps-card,
.permission-bulk-card {
  border-radius: 18px;
  border: 1px solid rgba(213, 225, 241, 0.92);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.06);
}

.permission-summary-card {
  overflow: hidden;
}

.permission-bulk-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
}

.permission-bulk-card__copy {
  min-width: 0;
}

.permission-bulk-card__copy strong {
  display: block;
  font-size: 13px;
  line-height: 1.35;
  color: #12316f;
}

.permission-bulk-card__copy p {
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #60759d;
}

.permission-summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
}

.permission-summary-item + .permission-summary-item {
  border-top: 1px dashed rgba(148, 163, 184, 0.65);
}

.permission-summary-item__main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.permission-summary-item__icon {
  flex: 0 0 auto;
  font-size: 15px;
  color: #94a3b8;
}

.permission-summary-item__icon.is-ready {
  color: #16a34a;
}

.permission-summary-item span {
  font-size: 11px;
  line-height: 1.3;
  color: #5b7097;
}

.permission-summary-item strong {
  flex: 0 0 auto;
  font-size: 12px;
  line-height: 1.3;
  color: #14336f;
}

.permission-hero {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.18) 0%, rgba(96, 165, 250, 0) 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(233, 243, 255, 0.78) 100%);
  border: 1px solid rgba(191, 219, 254, 0.78);
}

.permission-hero.is-complete {
  border-color: rgba(134, 239, 172, 0.82);
  background:
    radial-gradient(circle at top right, rgba(134, 239, 172, 0.16) 0%, rgba(134, 239, 172, 0) 34%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 253, 244, 0.82) 100%);
}

.permission-hero__icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  background: rgba(219, 234, 254, 0.88);
}

.permission-hero.is-complete .permission-hero__icon {
  color: #16a34a;
  background: rgba(220, 252, 231, 0.95);
}

.permission-hero__icon :deep(.el-icon) {
  font-size: 20px;
}

.permission-hero__copy {
  min-width: 0;
}

.permission-hero__copy strong {
  display: block;
  font-size: 14px;
  line-height: 1.35;
  color: #12316f;
}

.permission-hero__copy p {
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #60759d;
}

.permission-steps-card {
  overflow: hidden;
  padding: 14px 0;
}

.permission-step {
  padding: 14px;
}

.permission-step + .permission-step {
  border-top: 1px dashed rgba(148, 163, 184, 0.65);
}

.permission-step--focus {
  background:
    linear-gradient(180deg, rgba(239, 246, 255, 0.58) 0%, rgba(255, 255, 255, 0.22) 100%);
}

.permission-step--done {
  background: linear-gradient(180deg, rgba(248, 252, 255, 0.96) 0%, rgba(240, 249, 255, 0.7) 100%);
}

.permission-step--optional {
  background: rgba(248, 250, 252, 0.52);
}

.permission-step__head {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
}

.permission-step__icon {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  background: rgba(219, 234, 254, 0.94);
}

.permission-step__icon :deep(.el-icon) {
  font-size: 18px;
}

.permission-step__copy {
  min-width: 0;
}

.permission-step__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.permission-step__index,
.permission-step__badge {
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
}

.permission-step__index {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.96);
}

.permission-step__badge {
  color: #7c2d12;
  background: rgba(255, 237, 213, 0.92);
}

.permission-step__badge.is-ready {
  color: #166534;
  background: rgba(220, 252, 231, 0.94);
}

.permission-step__copy h3 {
  margin: 0;
  font-size: 14px;
  line-height: 1.28;
  color: #12316f;
}

.permission-step__copy p {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #64799f;
}

.permission-step__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-left: 50px;
}

.permission-step__actions--center {
  justify-content: center;
  padding-left: 0;
}

.permission-inline-hint {
  margin: 0;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px solid rgba(191, 219, 254, 0.72);
  background: rgba(239, 246, 255, 0.74);
  font-size: 11px;
  line-height: 1.55;
  color: #4f6793;
}

.permission-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(148, 163, 184, 0.65);
}

.permission-footer__text {
  margin: 0;
  min-width: 0;
  flex: 1 1 auto;
  font-size: 11px;
  line-height: 1.55;
  color: #60759d;
}

.permission-footer__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

:deep(.permission-page .teacher-action-button.el-button.el-button--small) {
  min-height: 32px;
  padding: 8px 18px !important;
  font-size: 12px;
}

@keyframes permission-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  :deep(.permission-shell .el-card__body) {
    padding: 14px !important;
  }

  .permission-hero,
  .permission-bulk-card,
  .permission-footer {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .permission-hero__button,
  .permission-bulk-card__button,
  .permission-footer__actions,
  .permission-footer__actions :deep(.el-button) {
    width: 100%;
  }

  .permission-topbar {
    grid-template-columns: auto 1fr;
  }

  .permission-refresh-button {
    grid-column: 1 / -1;
    justify-self: flex-start;
  }
}

@media (max-width: 480px) {
  :deep(.permission-shell .el-card__body) {
    padding: 12px !important;
  }

  .permission-topbar__copy h1 {
    font-size: 16px;
  }

  .permission-step,
  .permission-hero {
    padding: 12px;
  }

  .permission-step__head {
    gap: 10px;
  }

  .permission-step__actions {
    padding-left: 0;
  }

  .permission-step__actions :deep(.el-button) {
    flex: 1 1 100%;
  }
}
</style>
