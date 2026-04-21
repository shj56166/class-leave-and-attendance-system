<template>
  <div class="teacher-settings-page">
    <el-card class="teacher-settings-card">
      <template #header>
        <div class="teacher-settings-header">
          <div>
            <h2>界面设置</h2>
            <p>按设备性能切换动效与模糊强度，降低教师端运行开销。</p>
            <article class="status-card">
              <span>后台兜底策略</span>
              <strong>{{ backgroundSyncWindowsLabel }}</strong>
              <small>{{ formatDateTime(permissionStatus.backgroundSyncLastRunAt) }}</small>
            </article>
          </div>
        </div>
      </template>

      <div class="teacher-settings-list">
        <section class="teacher-settings-item">
          <div class="teacher-settings-copy">
            <h3>通知与运行权限</h3>
            <p>检查通知权限、后台保护和自启动引导，避免新审批提醒被系统拦截；当远程推送失效时会走本地后台兜底提醒，可能存在系统延迟。</p>
            <div class="teacher-settings-inline-status">
              <el-tag round :type="permissionStatus.notificationsGranted && permissionStatus.notificationsEnabled ? 'success' : 'warning'">
                {{ permissionStatus.notificationsGranted && permissionStatus.notificationsEnabled ? '通知已开启' : '通知待开启' }}
              </el-tag>
              <el-tag round :type="permissionStatus.batteryOptimizationIgnored ? 'success' : 'info'">
                {{ permissionStatus.batteryOptimizationIgnored ? '后台保护已放行' : '建议关闭电池优化' }}
              </el-tag>
            </div>
          </div>
          <div class="settings-actions">
            <el-button class="teacher-action-button teacher-action-button--secondary" :loading="refreshingPermissionStatus" @click="handleRefreshPermissionStatus">刷新状态</el-button>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="handleOpenPermissionCenter">打开权限中心</el-button>
          </div>
        </section>

        <section class="teacher-settings-item">
          <div class="teacher-settings-copy">
            <h3>减少动画效果</h3>
            <p>关闭页面切换、浮层与模糊动效，适合性能较弱的设备。</p>
          </div>
          <el-switch
            :model-value="uiPreferencesStore.reduceEffects"
            size="large"
            inline-prompt
            active-text="开"
            inactive-text="关"
            @update:model-value="uiPreferencesStore.setReduceEffects"
          />
        </section>

        <section class="teacher-settings-item teacher-settings-item--stack">
          <div class="teacher-settings-copy">
            <h3>JPush 状态诊断</h3>
            <p>检查当前 APK 是否已完成极光初始化、推送是否被停用，以及最近一次注册和远程通知时间。</p>
          </div>
          <div class="status-grid">
            <article class="status-card">
              <span>SDK 配置</span>
              <strong>{{ permissionStatus.jpushSdkConfigured ? '已注入' : '未注入' }}</strong>
              <small>{{ permissionStatus.jpushSdkConfigured ? '当前构建已包含有效 AppKey' : '当前构建缺少可用 AppKey' }}</small>
            </article>
            <article class="status-card">
              <span>厂商通道</span>
              <strong>{{ vendorPushStatus.title }}</strong>
              <small>{{ vendorPushStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>推送运行态</span>
              <strong>{{ jpushRuntimeStatus.title }}</strong>
              <small>{{ jpushRuntimeStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>Registration ID</span>
              <strong>{{ jpushRegistrationStatus.title }}</strong>
              <small>{{ jpushRegistrationStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>设备与厂商</span>
              <strong>{{ permissionStatus.manufacturer || '未知厂商' }}</strong>
              <small>{{ permissionStatus.model || '未识别机型' }}</small>
            </article>
            <article class="status-card">
              <span>当前通知链路</span>
              <strong>{{ permissionStatus.systemNotificationOwner === 'jpush' ? 'JPush 远程推送' : '本地后台兜底提醒' }}</strong>
              <small>{{ permissionStatus.backgroundSyncNotificationOwner || permissionStatus.systemNotificationOwner || '等待状态同步' }}</small>
            </article>
            <article class="status-card">
              <span>最近注册</span>
              <strong>{{ permissionStatus.lastPushRegisterAt ? '已记录' : '暂无' }}</strong>
              <small>{{ formatDateTime(permissionStatus.lastPushRegisterAt) }}</small>
            </article>
            <article class="status-card">
              <span>最近远程通知</span>
              <strong>{{ permissionStatus.lastRemoteNotificationAt ? '已记录' : '暂无' }}</strong>
              <small>{{ formatDateTime(permissionStatus.lastRemoteNotificationAt) }}</small>
            </article>
          </div>
        </section>

        <section class="teacher-settings-item teacher-settings-item--stack">
          <div class="teacher-settings-copy">
            <h3>服务端推送诊断</h3>
            <p>对齐服务端是否已加载 JPush 凭据、当前设备是否绑定为 JPush，以及最近一次远程投递和 Socket.IO 实时分发结果。</p>
          </div>
          <div class="settings-actions">
            <el-button class="teacher-action-button teacher-action-button--secondary" :loading="loadingPushDiagnostics" @click="handleLoadPushDiagnostics">
              刷新服务端诊断
            </el-button>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="sendingTestJpushNotification" @click="handleSendTestJpushNotification">
              发送远程测试
            </el-button>
          </div>
          <div class="status-grid">
            <article class="status-card">
              <span>服务端 JPush</span>
              <strong>{{ serverJpushConfigStatus.title }}</strong>
              <small>{{ serverJpushConfigStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>服务端活跃设备</span>
              <strong>{{ pushDiagnostics.summary.activeDeviceCount || 0 }}</strong>
              <small>{{ formatDateTime(pushDiagnostics.summary.lastSeenAt) }}</small>
            </article>
            <article class="status-card">
              <span>设备绑定状态</span>
              <strong>{{ serverDeviceBindingStatus.title }}</strong>
              <small>{{ serverDeviceBindingStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>当前 Provider</span>
              <strong>{{ activeServerPushDevice?.provider || '暂无' }}</strong>
              <small>{{ activeServerPushDevice?.bindingId || '服务端暂无 bindingId 记录' }}</small>
            </article>
            <article class="status-card">
              <span>最近 JPush 同步</span>
              <strong>{{ activeServerPushDevice?.lastJpushSyncAt ? '已记录' : '暂无' }}</strong>
              <small>{{ formatDateTime(activeServerPushDevice?.lastJpushSyncAt) }}</small>
            </article>
            <article class="status-card">
              <span>最近服务端投递</span>
              <strong>{{ latestServerJpushDeliveryStatus.title }}</strong>
              <small>{{ latestServerJpushDeliveryStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>最近 Socket.IO 分发</span>
              <strong>{{ latestServerSocketDeliveryStatus.title }}</strong>
              <small>{{ latestServerSocketDeliveryStatus.detail }}</small>
            </article>
            <article class="status-card">
              <span>前台实时接收</span>
              <strong>{{ latestRealtimeReceiveStatus.title }}</strong>
              <small>{{ latestRealtimeReceiveStatus.detail }}</small>
            </article>
          </div>
        </section>

        <ServerConnectionPanel />
      </div>
    </el-card>

    <el-card v-if="authStore.isAdmin" class="teacher-settings-card teacher-settings-card--security">
      <template #header>
        <div class="teacher-settings-header">
          <div>
            <h2>数据安全</h2>
            <p>支持导出数据库、上传备份做旁路预览，并在确认后执行覆盖恢复。</p>
          </div>
        </div>
      </template>

      <div class="teacher-settings-list">
        <section class="teacher-settings-item">
          <div class="teacher-settings-copy">
            <h3>一键导出数据库</h3>
            <p>下载当前数据库压缩包，包含 SQL 文件和 manifest 校验清单。</p>
          </div>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" size="large" :loading="exporting" @click="handleExportBackup">
            导出备份
          </el-button>
        </section>

        <section class="teacher-settings-item">
          <div class="teacher-settings-copy">
            <h3>上传备份并预览恢复</h3>
            <p>先恢复到预览库，核对关键表差异后，再决定是否覆盖正式库。</p>
          </div>
          <div class="settings-actions">
            <input
              ref="archiveInputRef"
              type="file"
              accept=".zip"
              class="hidden-input"
              @change="handleArchiveSelected"
            />
            <el-button class="teacher-action-button teacher-action-button--success" type="success" size="large" :loading="previewing" @click="openArchivePicker">
              上传并预览
            </el-button>
          </div>
        </section>

        <section v-if="previewInfo" class="teacher-settings-preview">
          <div class="teacher-settings-preview__head">
            <div>
              <h3>当前恢复预览</h3>
              <p>{{ previewInfo.archiveName }} · {{ previewInfo.previewDatabase }}</p>
            </div>
            <div class="settings-actions">
              <el-button class="teacher-action-button teacher-action-button--danger" type="warning" :loading="replacing" @click="handleReplaceDatabase">
                覆盖恢复正式库
              </el-button>
              <el-button class="teacher-action-button teacher-action-button--secondary" :loading="clearingPreview" @click="handleClearPreview">
                清理预览库
              </el-button>
            </div>
          </div>

          <div class="preview-grid">
            <article class="preview-card">
              <span class="preview-card__label">备份时间</span>
              <strong>{{ previewInfo.manifest?.createdAt || '-' }}</strong>
            </article>
            <article class="preview-card">
              <span class="preview-card__label">SHA256</span>
              <strong class="preview-card__hash">{{ previewInfo.manifest?.backup?.sha256 || '-' }}</strong>
            </article>
            <article class="preview-card">
              <span class="preview-card__label">预览创建时间</span>
              <strong>{{ formatDateTime(previewInfo.createdAt) }}</strong>
            </article>
          </div>

          <el-table
            :data="previewInfo.comparison?.tables || []"
            size="small"
            border
            stripe
            class="preview-table"
          >
            <el-table-column prop="table" label="表名" min-width="180" />
            <el-table-column prop="currentCount" label="当前库" width="110" />
            <el-table-column prop="previewCount" label="预览库" width="110" />
            <el-table-column label="差异" width="120">
              <template #default="{ row }">
                <el-tag :type="row.diff === 0 ? 'info' : row.diff > 0 ? 'warning' : 'success'">
                  {{ row.diff }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="preview-migrations">
            <div class="migration-box">
              <h4>预览库新增 migration</h4>
              <p>{{ formatList(previewInfo.comparison?.migrations?.previewOnly) }}</p>
            </div>
            <div class="migration-box">
              <h4>当前库独有 migration</h4>
              <p>{{ formatList(previewInfo.comparison?.migrations?.currentOnly) }}</p>
            </div>
          </div>
        </section>

        <section class="teacher-settings-status">
          <div class="teacher-settings-copy">
            <h3>最近执行状态</h3>
            <p>记录最近一次导出、预览恢复和覆盖恢复的结果，方便排查。</p>
          </div>

          <div class="status-grid">
            <article class="status-card">
              <span>最近导出</span>
              <strong>{{ backupStatus.lastExport?.fileName || '暂无' }}</strong>
              <small>{{ formatDateTime(backupStatus.lastExport?.createdAt) }}</small>
            </article>
            <article class="status-card">
              <span>最近预览</span>
              <strong>{{ backupStatus.lastPreview?.archiveName || '暂无' }}</strong>
              <small>{{ formatDateTime(backupStatus.lastPreview?.createdAt) }}</small>
            </article>
            <article class="status-card">
              <span>最近覆盖恢复</span>
              <strong>{{ backupStatus.lastReplace?.safetyBackup?.fileName || '暂无' }}</strong>
              <small>{{ formatDateTime(backupStatus.lastReplace?.createdAt) }}</small>
            </article>
          </div>
        </section>
      </div>
    </el-card>

    <el-card v-if="authStore.isAdmin" class="teacher-settings-card">
      <template #header>
        <div class="teacher-settings-header">
          <div>
            <h2>自动备份预留</h2>
            <p>保留计划配置入口，便于后续接入定时任务。</p>
          </div>
        </div>
      </template>

      <div class="teacher-settings-list">
        <section class="teacher-settings-item teacher-settings-item--stack">
          <el-form :model="backupForm" label-position="top" class="backup-form">
            <el-form-item label="启用状态">
              <el-switch v-model="backupForm.enabled" inline-prompt active-text="开" inactive-text="关" />
            </el-form-item>
            <el-form-item label="计划表达式">
              <el-input v-model="backupForm.schedule" placeholder="例如 0 2 * * *" />
            </el-form-item>
            <el-form-item label="保留天数">
              <el-input-number v-model="backupForm.retentionDays" :min="1" :max="365" />
            </el-form-item>
            <el-form-item label="备份目录">
              <el-input v-model="backupForm.destination" placeholder="例如 backups/" />
            </el-form-item>
          </el-form>

          <div class="settings-actions settings-actions--end">
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="savingSettings" @click="handleSaveBackupSettings">
              保存预留设置
            </el-button>
          </div>
        </section>
      </div>
    </el-card>

    <el-card class="teacher-settings-card teacher-settings-card--danger">
      <template #header>
        <div class="teacher-settings-header">
          <div>
            <h2>账号操作</h2>
            <p>保留显眼的退出入口，不会清除本机保存的界面偏好。</p>
          </div>
        </div>
      </template>

      <div class="teacher-settings-danger">
        <div class="teacher-settings-copy">
          <h3>退出登录</h3>
          <p>退出当前教师账号，不删除数据库，也不影响已有备份文件。</p>
        </div>
        <el-button class="teacher-action-button teacher-action-button--danger" type="danger" size="large" @click="requestTeacherLogout">
          退出登录
        </el-button>
      </div>
    </el-card>

    <ProjectConfirmDialog
      v-model="replaceConfirmVisible"
      title="确认覆盖恢复"
      message="覆盖恢复会先自动备份当前正式库，再用预览备份整库替换当前数据。"
      :details="[
        '该操作会影响学生端和教师端看到的历史数据。',
        '建议先确认预览库中的关键表差异和 migration 列表。'
      ]"
      confirm-text="确认恢复"
      confirm-type="warning"
      :loading="replacing"
      @confirm="confirmReplaceDatabase"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  getPushDeviceStatus,
  deleteBackupPreview,
  exportDatabaseBackup,
  getBackupStatus,
  previewDatabaseBackupImport,
  replaceDatabaseFromPreview,
  sendTestJpushNotification,
  updateBackupSettings
} from '../api/teacher';
import ProjectConfirmDialog from '../components/ProjectConfirmDialog.vue';
import ServerConnectionPanel from '../components/ServerConnectionPanel.vue';
import { formatTeacherBackgroundSyncWindows } from '../constants/backgroundSync';
import {
  APPROVAL_REMINDER_PERMISSIONS_ROUTE,
  resolveTeacherJPushRegistrationStatus,
  resolveTeacherJPushRuntimeStatus
} from '../constants/notifications';
import { useAuthStore } from '../stores/auth';
import { useTeacherNotificationsStore } from '../stores/notifications';
import { useUiPreferencesStore } from '../stores/uiPreferences';
import { refreshTeacherPermissionStatus } from '../services/teacherNotificationRuntime';
import { parseRequestErrorMessage } from '../utils/request';

const uiPreferencesStore = useUiPreferencesStore();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useTeacherNotificationsStore();
const requestTeacherLogout = inject('requestTeacherLogout', () => {});

const archiveInputRef = ref(null);
const exporting = ref(false);
const previewing = ref(false);
const replacing = ref(false);
const replaceConfirmVisible = ref(false);
const clearingPreview = ref(false);
const savingSettings = ref(false);
const refreshingPermissionStatus = ref(false);
const loadingPushDiagnostics = ref(false);
const sendingTestJpushNotification = ref(false);

const backupStatus = ref({
  lastExport: null,
  lastPreview: null,
  lastReplace: null,
  previews: [],
  settings: null
});

const backupForm = ref({
  enabled: false,
  schedule: '0 2 * * *',
  retentionDays: 14,
  destination: 'backups/',
  lastRunAt: null,
  lastRunStatus: 'idle'
});
const pushDiagnostics = ref({
  serverJpushConfigured: false,
  devices: [],
  recentJpushDeliveries: [],
  recentSocketDeliveries: [],
  summary: {
    activeDeviceCount: 0,
    activeJpushDeviceCount: 0,
    lastSeenAt: null,
    lastSocketSentAt: null
  }
});

const previewInfo = computed(() => backupStatus.value.lastPreview || null);
const permissionStatus = computed(() => notificationStore.permissionStatus || {});
const jpushRuntimeStatus = computed(() => resolveTeacherJPushRuntimeStatus(permissionStatus.value));
const jpushRegistrationStatus = computed(() => resolveTeacherJPushRegistrationStatus(permissionStatus.value));
const activeServerPushDevice = computed(() => (
  pushDiagnostics.value.devices.find((device) => device.provider === 'jpush')
  || pushDiagnostics.value.devices[0]
  || null
));
const latestServerJpushDelivery = computed(() => (
  Array.isArray(pushDiagnostics.value.recentJpushDeliveries)
    ? pushDiagnostics.value.recentJpushDeliveries[0] || null
    : null
));
const latestServerSocketDelivery = computed(() => (
  Array.isArray(pushDiagnostics.value.recentSocketDeliveries)
    ? pushDiagnostics.value.recentSocketDeliveries[0] || null
    : null
));
const backgroundSyncWindowsLabel = computed(() => {
  if (Array.isArray(permissionStatus.value.backgroundSyncWindows) && permissionStatus.value.backgroundSyncWindows.length) {
    return permissionStatus.value.backgroundSyncWindows
      .map((window) => `${window.label || '时段'} ${window.start}-${window.end}`)
      .join(' / ');
  }

  return formatTeacherBackgroundSyncWindows();
});
const vendorPushStatus = computed(() => {
  const manufacturer = String(permissionStatus.value.manufacturer || '').trim();
  const manufacturerLower = manufacturer.toLowerCase();

  if (manufacturerLower.includes('vivo')) {
    return permissionStatus.value.vivoPushConfigured
      ? {
          title: 'Vivo 已配置',
          detail: '已检测到 Vivo 厂商通道参数'
        }
      : {
          title: 'Vivo 待配置',
          detail: '当前构建缺少 VIVO_APPKEY / VIVO_APPID'
        };
  }

  if (manufacturerLower.includes('honor') || manufacturer.includes('荣耀')) {
    return permissionStatus.value.honorPushConfigured
      ? {
          title: '荣耀已配置',
          detail: '已检测到荣耀厂商通道参数'
        }
      : {
          title: '荣耀待配置',
          detail: '当前构建缺少 HONOR_APPID'
        };
  }

  return {
    title: '按机型适配',
    detail: 'Vivo / 荣耀机型建议补齐厂商通道参数'
  };
});
const serverJpushConfigStatus = computed(() => (
  pushDiagnostics.value.serverJpushConfigured
    ? {
        title: '已配置',
        detail: '服务端已检测到 JPUSH_APP_KEY / JPUSH_MASTER_SECRET'
      }
    : {
        title: '未配置',
        detail: '服务端缺少 JPush 凭据，后台远程推送会被跳过'
      }
));
const serverDeviceBindingStatus = computed(() => {
  if (!pushDiagnostics.value.devices.length) {
    return {
      title: '未发现设备',
      detail: '服务端暂无当前教师的活跃设备记录'
    };
  }

  if (activeServerPushDevice.value?.provider === 'jpush') {
    return {
      title: '已升级为 JPush',
      detail: `当前设备 provider=${activeServerPushDevice.value.provider}`
    };
  }

  return {
    title: '未升级为 JPush',
    detail: `当前设备 provider=${activeServerPushDevice.value?.provider || 'unknown'}`
  };
});
const latestServerJpushDeliveryStatus = computed(() => {
  const delivery = latestServerJpushDelivery.value;

  if (!delivery) {
    return {
      title: '暂无',
      detail: '尚无服务端 JPush 投递记录'
    };
  }

  if (delivery.status === 'sent') {
    return {
      title: '已发送',
      detail: formatDateTime(delivery.sentAt)
    };
  }

  if (delivery.status === 'failed') {
    return {
      title: '发送失败',
      detail: formatDeliveryPayload(delivery.responsePayload)
    };
  }

  return {
    title: '已跳过',
    detail: formatDeliveryPayload(delivery.responsePayload)
  };
});
const latestServerSocketDeliveryStatus = computed(() => {
  const delivery = latestServerSocketDelivery.value;
  const receiverCount = Number(delivery?.responsePayload?.receiverCount || 0);
  const reason = String(delivery?.responsePayload?.reason || '');

  if (!delivery) {
    return {
      title: '暂无',
      detail: '尚无服务端 Socket.IO 分发记录'
    };
  }

  if (delivery.status === 'sent') {
    return {
      title: receiverCount > 0 ? `已分发 ${receiverCount} 个连接` : '已分发',
      detail: formatDateTime(delivery.sentAt)
    };
  }

  if (reason === 'no_receivers') {
    return {
      title: '房间无人在线',
      detail: formatDateTime(delivery.sentAt)
    };
  }

  if (delivery.status === 'failed') {
    return {
      title: '分发失败',
      detail: formatDeliveryPayload(delivery.responsePayload)
    };
  }

  return {
    title: '已跳过',
    detail: formatDeliveryPayload(delivery.responsePayload)
  };
});
const latestRealtimeReceiveStatus = computed(() => {
  const receivedAt = Number(permissionStatus.value.lastRealtimeNotificationAt || 0);
  const leaveRequestId = Number(permissionStatus.value.lastRealtimeLeaveRequestId || 0);

  if (!receivedAt) {
    return {
      title: '暂无',
      detail: '当前设备尚未记录前台 Socket.IO 实时事件'
    };
  }

  return {
    title: '已收到',
    detail: leaveRequestId
      ? `${formatDateTime(receivedAt)} · leaveRequestId=${leaveRequestId}`
      : formatDateTime(receivedAt)
  };
});

function formatDateTime(value) {
  if (!value) {
    return '暂无';
  }

  return new Date(value).toLocaleString('zh-CN');
}

function formatList(items = []) {
  return Array.isArray(items) && items.length ? items.join('、') : '无';
}

function formatDeliveryPayload(payload = null) {
  if (!payload) {
    return '暂无响应详情';
  }

  if (payload.reason) {
    return String(payload.reason);
  }

  if (payload.message) {
    return String(payload.message);
  }

  if (payload.httpStatus) {
    return `HTTP ${payload.httpStatus}`;
  }

  if (payload.error?.message) {
    return String(payload.error.message);
  }

  try {
    const serialized = JSON.stringify(payload);
    return serialized.length > 80 ? `${serialized.slice(0, 77)}...` : serialized;
  } catch (error) {
    return '响应详情不可序列化';
  }
}

function syncBackupForm(settings = {}) {
  backupForm.value = {
    enabled: Boolean(settings.enabled),
    schedule: settings.schedule || '0 2 * * *',
    retentionDays: Number(settings.retentionDays || 14),
    destination: settings.destination || 'backups/',
    lastRunAt: settings.lastRunAt || null,
    lastRunStatus: settings.lastRunStatus || 'idle'
  };
}

async function handleRefreshPermissionStatus() {
  refreshingPermissionStatus.value = true;
  try {
    await refreshTeacherPermissionStatus(notificationStore);
    await loadPushDiagnostics();
    ElMessage.success('权限状态已刷新');
  } catch (error) {
    ElMessage.error('刷新权限状态失败');
  } finally {
    refreshingPermissionStatus.value = false;
  }
}

function handleOpenPermissionCenter() {
  router.push(APPROVAL_REMINDER_PERMISSIONS_ROUTE);
}

async function loadPushDiagnostics() {
  loadingPushDiagnostics.value = true;
  try {
    const response = await getPushDeviceStatus();
    pushDiagnostics.value = {
      serverJpushConfigured: Boolean(response?.serverJpushConfigured),
      devices: Array.isArray(response?.devices) ? response.devices : [],
      recentJpushDeliveries: Array.isArray(response?.recentJpushDeliveries) ? response.recentJpushDeliveries : [],
      recentSocketDeliveries: Array.isArray(response?.recentSocketDeliveries) ? response.recentSocketDeliveries : [],
      summary: {
        activeDeviceCount: Number(response?.summary?.activeDeviceCount || 0),
        activeJpushDeviceCount: Number(response?.summary?.activeJpushDeviceCount || 0),
        lastSeenAt: response?.summary?.lastSeenAt || null,
        lastSocketSentAt: response?.summary?.lastSocketSentAt || null
      }
    };
  } catch (error) {
    throw error;
  } finally {
    loadingPushDiagnostics.value = false;
  }
}

async function handleLoadPushDiagnostics() {
  try {
    await loadPushDiagnostics();
    ElMessage.success('服务端推送诊断已刷新');
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '刷新服务端推送诊断失败'));
  }
}

async function handleSendTestJpushNotification() {
  sendingTestJpushNotification.value = true;
  try {
    const response = await sendTestJpushNotification();
    const status = String(response?.result?.status || '');
    const reason = String(response?.result?.reason || '');
    await loadPushDiagnostics();

    if (status === 'sent') {
      ElMessage.success('服务端已发起远程测试推送');
      return;
    }

    ElMessage.warning(`测试推送结果：${status || 'unknown'}${reason ? ` (${reason})` : ''}`);
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '发送远程测试推送失败'));
  } finally {
    sendingTestJpushNotification.value = false;
  }
}

async function loadBackupStatus() {
  if (!authStore.isAdmin) {
    return;
  }

  try {
    const response = await getBackupStatus();
    backupStatus.value = response;
    syncBackupForm(response.settings || {});
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '加载备份状态失败'));
  }
}

async function handleExportBackup() {
  exporting.value = true;
  try {
    const blob = await exportDatabaseBackup();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
      link.download = `leave-demo-backup-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    ElMessage.success('数据库备份已导出');
    await loadBackupStatus();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '导出数据库失败'));
  } finally {
    exporting.value = false;
  }
}

function openArchivePicker() {
  archiveInputRef.value?.click();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取备份文件失败'));
    reader.readAsDataURL(file);
  });
}

async function handleArchiveSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (!file) {
    return;
  }

  previewing.value = true;
  try {
    const archiveBase64 = await readFileAsDataUrl(file);
    await previewDatabaseBackupImport({
      archiveName: file.name,
      archiveBase64
    });
    ElMessage.success('备份预览完成');
    await loadBackupStatus();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '预览恢复失败'));
  } finally {
    previewing.value = false;
  }
}

function handleReplaceDatabase() {
  if (!previewInfo.value) {
    return;
  }

  replaceConfirmVisible.value = true;
}

async function confirmReplaceDatabase() {
  if (!previewInfo.value || replacing.value) {
    return;
  }

  replacing.value = true;
  try {
    await replaceDatabaseFromPreview({
      previewId: previewInfo.value.previewId
    });
    replaceConfirmVisible.value = false;
    ElMessage.success('数据库覆盖恢复完成');
    await loadBackupStatus();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '覆盖恢复失败'));
  } finally {
    replacing.value = false;
  }
}

async function handleClearPreview() {
  if (!previewInfo.value) {
    return;
  }

  clearingPreview.value = true;
  try {
    await deleteBackupPreview(previewInfo.value.previewId);
    ElMessage.success('预览库已清理');
    await loadBackupStatus();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '清理预览库失败'));
  } finally {
    clearingPreview.value = false;
  }
}

async function handleSaveBackupSettings() {
  savingSettings.value = true;
  try {
    const saved = await updateBackupSettings(backupForm.value);
    syncBackupForm(saved);
    ElMessage.success('自动备份预留设置已保存');
    await loadBackupStatus();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '保存备份设置失败'));
  } finally {
    savingSettings.value = false;
  }
}

onMounted(() => {
  handleRefreshPermissionStatus().catch(() => {});
  loadBackupStatus();
});
</script>

<style scoped>
.teacher-settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hidden-input {
  display: none;
}

:deep(.el-card) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important;
  border-radius: 20px !important;
}

:deep(.el-card__header) {
  border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important;
  padding: 20px 20px 14px !important;
}

:deep(.el-card__body) {
  padding: 18px 20px 20px !important;
}

.teacher-settings-header h2,
.teacher-settings-copy h3 {
  margin: 0;
  color: #12316f;
}

.teacher-settings-header h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.teacher-settings-header p,
.teacher-settings-copy p {
  margin: 8px 0 0;
  font-size: 12px;
  color: #5c739e;
  line-height: 1.55;
}

.teacher-settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.teacher-settings-item,
.teacher-settings-danger,
.teacher-settings-status,
.teacher-settings-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 14px 32px rgba(148, 163, 184, 0.1);
}

.teacher-settings-item--stack,
.teacher-settings-status,
.teacher-settings-preview {
  flex-direction: column;
  align-items: stretch;
}

.teacher-settings-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.teacher-settings-copy h3 {
  font-size: 15px;
  font-weight: 700;
}

.teacher-settings-copy p {
  font-size: 13px;
}

.teacher-settings-inline-status {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.teacher-settings-card--security :deep(.el-card__header) {
  border-bottom-color: rgba(34, 197, 94, 0.15) !important;
}

.teacher-settings-card--danger :deep(.el-card__header) {
  border-bottom-color: rgba(239, 68, 68, 0.12) !important;
}

.teacher-settings-card--danger .teacher-settings-danger {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(254, 242, 242, 0.78) 100%);
  border-color: rgba(254, 202, 202, 0.7);
}

.teacher-settings-card :deep(.el-switch) {
  --el-switch-on-color: #2563eb;
  --el-switch-off-color: rgba(148, 163, 184, 0.48);
  flex: 0 0 auto;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-actions--end {
  justify-content: flex-end;
}

.preview-grid,
.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.preview-card,
.status-card,
.migration-box {
  padding: 14px;
  border-radius: 14px;
  background: #f7fbff;
  border: 1px solid rgba(191, 219, 254, 0.9);
}

.preview-card__label,
.status-card span {
  display: block;
  font-size: 11px;
  color: #5c739e;
}

.preview-card strong,
.status-card strong {
  display: block;
  margin-top: 6px;
  color: #12316f;
  font-size: 13px;
}

.preview-card__hash {
  word-break: break-all;
}

.status-card small {
  display: block;
  margin-top: 6px;
  color: #6b7f9f;
  font-size: 11px;
}

.preview-table {
  margin-top: 4px;
}

.teacher-settings-preview__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.teacher-settings-preview__head h3,
.migration-box h4 {
  margin: 0;
  color: #12316f;
}

.teacher-settings-preview__head p,
.migration-box p {
  margin: 8px 0 0;
  color: #5c739e;
  line-height: 1.55;
  font-size: 12px;
}

.preview-migrations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.backup-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.backup-form :deep(.el-form-item) {
  margin-bottom: 0;
}

@media (max-width: 960px) {
  .preview-grid,
  .status-grid,
  .preview-migrations,
  .backup-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .teacher-settings-item,
  .teacher-settings-danger,
  .teacher-settings-preview__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .teacher-settings-card :deep(.el-switch) {
    align-self: flex-end;
  }

  .teacher-settings-danger .el-button,
  .settings-actions .el-button {
    width: 100%;
  }

  .settings-actions {
    width: 100%;
  }
}
</style>

