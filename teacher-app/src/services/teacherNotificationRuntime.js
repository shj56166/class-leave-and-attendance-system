import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  getSchedules,
  getPendingNotificationEvents,
  registerPushDevice,
  unregisterPushDevice
} from '../api/teacher';
import {
  APPROVAL_REMINDER_PERMISSIONS_ROUTE,
  APPROVAL_ROUTE,
  isTeacherPermissionFlowCompleted,
  resolveTeacherLaunchRoute,
  TEACHER_NOTIFICATION_ACTION_OPEN,
  TEACHER_NOTIFICATION_ACTION_TYPE,
  TEACHER_NOTIFICATION_CHANNEL_ID
} from '../constants/notifications';
import {
  TEACHER_BACKGROUND_SYNC_WINDOWS
} from '../constants/backgroundSync';
import {
  ensureServerRuntimeReady,
  getServerRuntimeState
} from '../config/serverRuntime';
import { TeacherDeviceSettings } from './nativeDeviceSettings';
import { TeacherJPush } from './nativeJPush';
import { TeacherBackgroundSync } from './nativeBackgroundSync';
import { TeacherLocalReminder } from './nativeLocalReminder';

const JPUSH_STATUS_RETRY_DELAY_MS = 1200;
const REGISTRATION_REFRESH_INTERVAL_MS = 8000;
const REGISTRATION_REFRESH_STALE_MS = 5 * 60 * 1000;
const DEVICE_SESSION_STORAGE_KEY = 'teacher_push_device_session_v1';
const PENDING_UNREGISTER_STORAGE_KEY = 'teacher_push_pending_unregister_v1';
const NOTIFICATION_OWNER_JPUSH = 'jpush';
const NOTIFICATION_OWNER_LOCAL_FALLBACK = 'local_fallback';
const LOCAL_SOCKET_NOTIFICATION_SOURCE = 'local_socket';
const JPUSH_REMOTE_NOTIFICATION_SOURCE = 'jpush_remote';
const BACKGROUND_SYNC_NOTIFICATION_SOURCE = 'background_sync';
const LOCAL_DAILY_REMINDER_TIME = '07:40';
const LOCAL_DAILY_REMINDER_SOURCE = 'local_daily_approval_reminder';
const PERMISSION_PROMPT_STEP_CONSENT = 'consent';
const PERMISSION_PROMPT_STEP_PERMISSIONS = 'permissions';
const PERMISSION_GUIDANCE_STORAGE_PREFIX = 'teacher_permission_guidance_v1';
const PERMISSION_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const PERMISSION_REMINDER_SOURCE_AUTO = 'auto_redirect';
const PERMISSION_REMINDER_SOURCE_BANNER = 'banner';

let runtimeBootstrapped = false;
let listenersBound = false;
let activeRouter = null;
let activeStore = null;
let currentToken = '';
let lastRegisteredFingerprint = '';
let appIsActive = true;
let registrationRefreshTimer = null;
let bulkPermissionFlowState = {
  lastLaunchedStep: ''
};

function isNativeAndroid() {
  return Capacitor.getPlatform() === 'android';
}

function safeParseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function safeReadStorage(key, fallback = null) {
  try {
    return safeParseJson(localStorage.getItem(key), fallback);
  } catch (error) {
    return fallback;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures and keep best-effort runtime behavior.
  }
}

function safeRemoveStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage failures and keep best-effort runtime behavior.
  }
}

function readCurrentTeacherUser() {
  try {
    return safeParseJson(localStorage.getItem('teacher_user'), null);
  } catch (error) {
    return null;
  }
}

function readCurrentTeacherToken() {
  try {
    return String(localStorage.getItem('teacher_token') || '').trim();
  } catch (error) {
    return '';
  }
}

function readCurrentTeacherId() {
  return String(readCurrentTeacherUser()?.id || '').trim();
}

function isSameLocalDay(leftTimestamp, rightTimestamp = Date.now()) {
  const left = Number(leftTimestamp || 0);
  const right = Number(rightTimestamp || 0);
  if (!left || !right) {
    return false;
  }

  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function normalizeTeacherScheduleBundle(bundle = {}) {
  return {
    periods: Array.isArray(bundle?.periods) ? bundle.periods : [],
    schedules: Array.isArray(bundle?.schedules) ? bundle.schedules : [],
    specialDates: Array.isArray(bundle?.specialDates) ? bundle.specialDates : [],
    syncedAt: Number(bundle?.syncedAt || Date.now())
  };
}

async function resolvePermissionAudienceKey() {
  const teacherUser = readCurrentTeacherUser();
  const teacherId = String(teacherUser?.id || 'anonymous').trim() || 'anonymous';

  if (!isNativeAndroid()) {
    return `web:${teacherId}`;
  }

  const [deviceId, deviceInfo] = await Promise.all([
    Device.getId().catch(() => ({ identifier: 'unknown' })),
    Device.getInfo().catch(() => ({ manufacturer: 'android', model: 'unknown' }))
  ]);

  return `${teacherId}:${buildDeviceFingerprint(deviceId, deviceInfo)}`;
}

function buildPermissionGuidanceStorageKey(type, audienceKey) {
  return `${PERMISSION_GUIDANCE_STORAGE_PREFIX}:${type}:${audienceKey}`;
}

async function hasShownInitialPermissionGuide() {
  const audienceKey = await resolvePermissionAudienceKey();
  const record = safeReadStorage(buildPermissionGuidanceStorageKey('first-entry', audienceKey), null);
  return Boolean(record?.shownAt);
}

async function markInitialPermissionGuideShown(source = PERMISSION_REMINDER_SOURCE_AUTO) {
  const audienceKey = await resolvePermissionAudienceKey();
  safeWriteStorage(buildPermissionGuidanceStorageKey('first-entry', audienceKey), {
    shownAt: Date.now(),
    source
  });
}

async function readLastPermissionReminder() {
  const audienceKey = await resolvePermissionAudienceKey();
  return safeReadStorage(buildPermissionGuidanceStorageKey('last-reminder', audienceKey), null);
}

async function markPermissionReminderShown(source = PERMISSION_REMINDER_SOURCE_BANNER) {
  const audienceKey = await resolvePermissionAudienceKey();
  safeWriteStorage(buildPermissionGuidanceStorageKey('last-reminder', audienceKey), {
    shownAt: Date.now(),
    source
  });
}

function isPermissionPageRoute(routeLike = null) {
  const path = String(
    routeLike?.path
      || routeLike?.fullPath
      || activeRouter?.currentRoute?.value?.path
      || ''
  ).trim();

  return path === APPROVAL_REMINDER_PERMISSIONS_ROUTE;
}

async function navigateToPermissionGuidancePage(options = {}) {
  if (!activeRouter || isPermissionPageRoute()) {
    return false;
  }

  const navigationMethod = options.replace ? 'replace' : 'push';
  await activeRouter[navigationMethod](APPROVAL_REMINDER_PERMISSIONS_ROUTE);
  return true;
}

function buildDefaultPermissionStatus(overrides = {}) {
  return {
    consentGranted: !isNativeAndroid(),
    display: isNativeAndroid() ? 'prompt' : 'granted',
    notificationsGranted: !isNativeAndroid(),
    notificationsEnabled: !isNativeAndroid(),
    batteryOptimizationIgnored: !isNativeAndroid(),
    canOpenAutoStartSettings: false,
    manufacturer: isNativeAndroid() ? '' : 'web',
    model: '',
    platform: Capacitor.getPlatform(),
    appIsActive,
    jpushEnabled: false,
    jpushSdkConfigured: false,
    vivoPushConfigured: false,
    honorPushConfigured: false,
    jpushPushStopped: false,
    jpushOperational: false,
    jpushRegistrationIdReady: false,
    jpushRegistrationId: '',
    lastPushRegisterAt: 0,
    lastRemoteNotificationAt: 0,
    lastRealtimeNotificationAt: 0,
    lastRealtimeLeaveRequestId: 0,
    backgroundSyncEnabled: false,
    backgroundSyncConfigured: false,
    backgroundSyncAppIsForeground: appIsActive,
    backgroundSyncLastRunAt: 0,
    backgroundSyncLastSuccessAt: 0,
    backgroundSyncLastPolledAt: 0,
    backgroundSyncNotificationOwner: '',
    backgroundSyncBindingId: '',
    backgroundSyncCursorSubmittedAt: '',
    backgroundSyncCursorLeaveRequestId: 0,
    systemNotificationOwner: '',
    backgroundSyncWindows: TEACHER_BACKGROUND_SYNC_WINDOWS,
    localReminderEnabled: false,
    localReminderConfigured: false,
    localReminderTeacherId: '',
    localReminderReminderTime: LOCAL_DAILY_REMINDER_TIME,
    localReminderRoute: APPROVAL_ROUTE,
    localReminderHasScheduleBundle: false,
    localReminderLastScheduleSyncAt: 0,
    localReminderNextTriggerAt: 0,
    localReminderLastTriggeredAt: 0,
    localReminderLastNotifiedAt: 0,
    ...overrides
  };
}

function isPermissionFlowCompleted(status) {
  return isTeacherPermissionFlowCompleted(status);
}

function resolvePermissionPromptStep(status) {
  return status?.consentGranted === false
    ? PERMISSION_PROMPT_STEP_CONSENT
    : PERMISSION_PROMPT_STEP_PERMISSIONS;
}

function openPermissionPrompt(notificationStore, status, options = {}) {
  notificationStore?.setPermissionStatus(status);
  notificationStore?.setPermissionPromptStep(options.step || resolvePermissionPromptStep(status));

  if (typeof options.bulkPermissionFlowActive === 'boolean') {
    notificationStore?.setBulkPermissionFlowActive(options.bulkPermissionFlowActive);
  }
}

function stopTeacherBulkPermissionFlow(notificationStore) {
  bulkPermissionFlowState = {
    lastLaunchedStep: ''
  };
  notificationStore?.setBulkPermissionFlowActive(false);
}

function closePermissionPromptIfComplete(notificationStore, status) {
  if (!isPermissionFlowCompleted(status)) {
    return false;
  }

  stopTeacherBulkPermissionFlow(notificationStore);
  notificationStore?.clearPermissionReminder();
  notificationStore?.closePermissionPrompt();
  return true;
}

async function syncTeacherPermissionGuidance(status, options = {}) {
  const effectiveStatus = status || activeStore?.permissionStatus || buildDefaultPermissionStatus();
  activeStore?.setPermissionStatus(effectiveStatus);
  activeStore?.setPermissionPromptStep(resolvePermissionPromptStep(effectiveStatus));

  if (!isNativeAndroid()) {
    activeStore?.clearPermissionReminder();
    return {
      completed: true,
      redirected: false,
      reminded: false
    };
  }

  if (isPermissionFlowCompleted(effectiveStatus)) {
    activeStore?.clearPermissionReminder();
    return {
      completed: true,
      redirected: false,
      reminded: false
    };
  }

  if (isPermissionPageRoute(options.route)) {
    activeStore?.clearPermissionReminder();
    return {
      completed: false,
      redirected: false,
      reminded: false
    };
  }

  const hasShownInitialGuide = await hasShownInitialPermissionGuide();
  if (!hasShownInitialGuide) {
    activeStore?.clearPermissionReminder();
    return {
      completed: false,
      redirected: false,
      reminded: false
    };
  }

  const lastReminder = await readLastPermissionReminder();
  const lastShownAt = Number(lastReminder?.shownAt || 0);
  const reminderDue = !lastShownAt || Date.now() - lastShownAt >= PERMISSION_REMINDER_INTERVAL_MS;

  if (reminderDue) {
    await markPermissionReminderShown(options.source || PERMISSION_REMINDER_SOURCE_BANNER);
    activeStore?.showPermissionReminder({
      text: '审批提醒权限未完成，当前仅能依赖兜底提醒，可能存在系统延迟',
      route: APPROVAL_REMINDER_PERMISSIONS_ROUTE,
      source: options.source || PERMISSION_REMINDER_SOURCE_BANNER
    });

    return {
      completed: false,
      redirected: false,
      reminded: true
    };
  }

  return {
    completed: false,
    redirected: false,
    reminded: false
  };
}

export async function hasTeacherSeenInitialPermissionGuide() {
  if (!isNativeAndroid()) {
    return true;
  }

  return hasShownInitialPermissionGuide();
}

export async function markTeacherInitialPermissionGuideShown(source = 'page_entry') {
  if (!isNativeAndroid()) {
    return false;
  }

  const shown = await hasShownInitialPermissionGuide();
  if (shown) {
    return false;
  }

  await markInitialPermissionGuideShown(source);
  return true;
}

export async function resolveTeacherStartupRoute() {
  const isLoggedIn = Boolean(readCurrentTeacherToken());
  const isAndroid = isNativeAndroid();

  if (!isLoggedIn || !isAndroid) {
    return resolveTeacherLaunchRoute({
      isAndroid,
      isLoggedIn,
      hasShownInitialPermissionGuide: true,
      permissionFlowCompleted: true
    });
  }

  const [hasShownGuide, permissionStatus] = await Promise.all([
    hasShownInitialPermissionGuide(),
    readNativePermissionStatus()
  ]);

  return resolveTeacherLaunchRoute({
    isAndroid,
    isLoggedIn,
    hasShownInitialPermissionGuide: hasShownGuide,
    permissionFlowCompleted: isPermissionFlowCompleted(permissionStatus)
  });
}

function buildDeviceFingerprint(deviceId, deviceInfo) {
  const manufacturer = String(deviceInfo?.manufacturer || 'unknown').trim();
  const model = String(deviceInfo?.model || 'unknown').trim();
  const identifier = String(deviceId?.identifier || 'unknown').trim();
  return `${manufacturer}:${model}:${identifier}`.slice(0, 191);
}

function buildNotificationBody(payload) {
  return String(payload?.summaryText || '有新的待审批请假').trim() || '有新的待审批请假';
}

function buildNotificationTitle(payload) {
  const studentName = String(payload?.studentName || '').trim();
  return studentName ? `${studentName} 提交了新的待审批请假` : '有新的待审批请假';
}

function buildAuthConfig(token) {
  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    : {};
}

function generateBindingId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `binding_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadRegisteredDeviceSession() {
  return safeReadStorage(DEVICE_SESSION_STORAGE_KEY, null);
}

function saveRegisteredDeviceSession(session) {
  if (!session) {
    return;
  }

  safeWriteStorage(DEVICE_SESSION_STORAGE_KEY, session);
  lastRegisteredFingerprint = String(session.deviceFingerprint || '');
}

function clearRegisteredDeviceSession() {
  safeRemoveStorage(DEVICE_SESSION_STORAGE_KEY);
  lastRegisteredFingerprint = '';
}

function loadPendingUnregisterSession() {
  return safeReadStorage(PENDING_UNREGISTER_STORAGE_KEY, null);
}

function savePendingUnregisterSession(session) {
  if (!session) {
    return;
  }

  safeWriteStorage(PENDING_UNREGISTER_STORAGE_KEY, {
    ...session,
    queuedAt: session.queuedAt || Date.now()
  });
}

function clearPendingUnregisterSession() {
  safeRemoveStorage(PENDING_UNREGISTER_STORAGE_KEY);
}

function resolveCurrentBindingId() {
  if (!currentToken) {
    return '';
  }

  const registeredSession = loadRegisteredDeviceSession();
  if (registeredSession?.authToken === currentToken && registeredSession?.bindingId) {
    return String(registeredSession.bindingId);
  }

  const pendingSession = loadPendingUnregisterSession();
  if (pendingSession?.authToken === currentToken && pendingSession?.bindingId) {
    return String(pendingSession.bindingId);
  }

  return generateBindingId();
}

function resolveSystemNotificationOwner(permissionStatus = null) {
  const status = permissionStatus || activeStore?.permissionStatus || buildDefaultPermissionStatus();
  const registeredSession = loadRegisteredDeviceSession();
  const jpushRegistrationId = String(status.jpushRegistrationId || '').trim();
  const hasRegisteredJPushOwner = Boolean(
    registeredSession?.bindingId
      && registeredSession?.provider === 'jpush'
      && registeredSession?.registrationId === jpushRegistrationId
      && (!currentToken || registeredSession?.authToken === currentToken)
  );

  return hasRegisteredJPushOwner
    ? NOTIFICATION_OWNER_JPUSH
    : NOTIFICATION_OWNER_LOCAL_FALLBACK;
}

function shouldPromptForPermissions(status) {
  if (!isNativeAndroid()) {
    return false;
  }

  if (status?.consentGranted === false) {
    return false;
  }

  return !isPermissionFlowCompleted(status);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function ensureChannelRegistered() {
  if (!isNativeAndroid()) {
    return;
  }

  await LocalNotifications.createChannel({
    id: TEACHER_NOTIFICATION_CHANNEL_ID,
    name: '教师待审批提醒',
    description: '学生提交待审批请假后优先远程提醒；未命中时会回退到本地兜底提醒。',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#3B82F6'
  });

  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: TEACHER_NOTIFICATION_ACTION_TYPE,
        actions: [
          {
            id: TEACHER_NOTIFICATION_ACTION_OPEN,
            title: '查看审批',
            foreground: true
          }
        ]
      }
    ]
  });
}

async function readJPushStatus() {
  if (!isNativeAndroid()) {
    return buildDefaultPermissionStatus();
  }

  return TeacherJPush.getStatus().catch(() => ({
    consentGranted: false,
    enabled: false,
    sdkConfigured: false,
    vivoPushConfigured: false,
    honorPushConfigured: false,
    pushStopped: false,
    pushOperational: false,
    registrationId: '',
    hasRegistrationId: false,
    lastRegistrationAt: 0,
    lastRemoteNotificationAt: 0
  }));
}

async function readBackgroundSyncStatus() {
  if (!isNativeAndroid()) {
    return {
      enabled: false,
      configured: false,
      appIsForeground: true,
      lastRunAt: 0,
      lastSuccessAt: 0,
      lastPolledAt: 0,
      notificationOwner: '',
      bindingId: '',
      cursorSubmittedAt: '',
      cursorLeaveRequestId: 0,
      windows: TEACHER_BACKGROUND_SYNC_WINDOWS
    };
  }

  return TeacherBackgroundSync.getStatus().catch(() => ({
    enabled: false,
    configured: false,
    appIsForeground: appIsActive,
    lastRunAt: 0,
    lastSuccessAt: 0,
    lastPolledAt: 0,
    notificationOwner: '',
    bindingId: '',
    cursorSubmittedAt: '',
    cursorLeaveRequestId: 0,
    windows: TEACHER_BACKGROUND_SYNC_WINDOWS
  }));
}

async function readLocalReminderStatus() {
  if (!isNativeAndroid()) {
    return {
      enabled: false,
      configured: false,
      teacherId: '',
      reminderTime: LOCAL_DAILY_REMINDER_TIME,
      route: APPROVAL_ROUTE,
      hasScheduleBundle: false,
      lastScheduleSyncAt: 0,
      nextTriggerAt: 0,
      lastTriggeredAt: 0,
      lastNotifiedAt: 0
    };
  }

  return TeacherLocalReminder.getStatus().catch(() => ({
    enabled: false,
    configured: false,
    teacherId: '',
    reminderTime: LOCAL_DAILY_REMINDER_TIME,
    route: APPROVAL_ROUTE,
    hasScheduleBundle: false,
    lastScheduleSyncAt: 0,
    nextTriggerAt: 0,
    lastTriggeredAt: 0,
    lastNotifiedAt: 0
  }));
}

function applyLocalReminderStatus(status, permissionStatus = null) {
  const effectiveStatus = status || {};
  activeStore?.updatePermissionStatusPartial({
    localReminderEnabled: Boolean(effectiveStatus.enabled),
    localReminderConfigured: Boolean(effectiveStatus.configured),
    localReminderTeacherId: String(effectiveStatus.teacherId || ''),
    localReminderReminderTime: String(effectiveStatus.reminderTime || LOCAL_DAILY_REMINDER_TIME),
    localReminderRoute: String(effectiveStatus.route || APPROVAL_ROUTE),
    localReminderHasScheduleBundle: Boolean(effectiveStatus.hasScheduleBundle),
    localReminderLastScheduleSyncAt: Number(effectiveStatus.lastScheduleSyncAt || 0),
    localReminderNextTriggerAt: Number(effectiveStatus.nextTriggerAt || 0),
    localReminderLastTriggeredAt: Number(effectiveStatus.lastTriggeredAt || 0),
    localReminderLastNotifiedAt: Number(effectiveStatus.lastNotifiedAt || 0),
    ...(permissionStatus ? { appIsActive: Boolean(permissionStatus.appIsActive) } : {})
  });

  return effectiveStatus;
}

async function ensureNativePushOperational(reason = 'unknown') {
  if (!isNativeAndroid()) {
    return readJPushStatus();
  }

  let status = await readJPushStatus();

  if (!status.sdkConfigured || status.consentGranted === false) {
    return status;
  }

  if (status.pushStopped) {
    console.warn('Teacher JPush was unexpectedly stopped, resuming push.', {
      reason,
      registrationIdReady: Boolean(status.registrationId)
    });
    await TeacherJPush.setPushEnabled({ enabled: true }).catch(() => {});
    status = await readJPushStatus();
  }

  if (!status.registrationId) {
    await delay(JPUSH_STATUS_RETRY_DELAY_MS);
    status = await readJPushStatus();
  }

  return status;
}

async function readNativePermissionStatus() {
  if (!isNativeAndroid()) {
    return buildDefaultPermissionStatus();
  }

  const existingStatus = activeStore?.permissionStatus || buildDefaultPermissionStatus();

  const [localPermissions, nativeStatus, jpushStatus, backgroundSyncStatus, localReminderStatus] = await Promise.all([
    LocalNotifications.checkPermissions().catch(() => ({ display: 'prompt' })),
    TeacherDeviceSettings.getPermissionStatus().catch(() => ({
      notificationsEnabled: true,
      batteryOptimizationIgnored: true,
      canOpenAutoStartSettings: false,
      manufacturer: 'unknown',
      model: ''
    })),
    readJPushStatus(),
    readBackgroundSyncStatus(),
    readLocalReminderStatus()
  ]);

  return buildDefaultPermissionStatus({
    consentGranted: Boolean(jpushStatus?.consentGranted),
    display: localPermissions?.display || 'prompt',
    notificationsGranted: localPermissions?.display === 'granted',
    notificationsEnabled: nativeStatus?.notificationsEnabled !== false,
    batteryOptimizationIgnored: nativeStatus?.batteryOptimizationIgnored !== false,
    canOpenAutoStartSettings: Boolean(nativeStatus?.canOpenAutoStartSettings),
    manufacturer: nativeStatus?.manufacturer || '',
    model: nativeStatus?.model || '',
    jpushEnabled: Boolean(jpushStatus?.enabled),
    jpushSdkConfigured: Boolean(jpushStatus?.sdkConfigured),
    vivoPushConfigured: Boolean(jpushStatus?.vivoPushConfigured),
    honorPushConfigured: Boolean(jpushStatus?.honorPushConfigured),
    jpushPushStopped: Boolean(jpushStatus?.pushStopped),
    jpushOperational: Boolean(jpushStatus?.pushOperational),
    jpushRegistrationIdReady: Boolean(jpushStatus?.registrationId),
    jpushRegistrationId: String(jpushStatus?.registrationId || ''),
    lastPushRegisterAt: Number(jpushStatus?.lastRegistrationAt || 0),
    lastRemoteNotificationAt: Number(jpushStatus?.lastRemoteNotificationAt || 0),
    lastRealtimeNotificationAt: Number(existingStatus?.lastRealtimeNotificationAt || 0),
    lastRealtimeLeaveRequestId: Number(existingStatus?.lastRealtimeLeaveRequestId || 0),
    backgroundSyncEnabled: Boolean(backgroundSyncStatus?.enabled),
    backgroundSyncConfigured: Boolean(backgroundSyncStatus?.configured),
    backgroundSyncAppIsForeground: Boolean(backgroundSyncStatus?.appIsForeground),
    backgroundSyncLastRunAt: Number(backgroundSyncStatus?.lastRunAt || 0),
    backgroundSyncLastSuccessAt: Number(backgroundSyncStatus?.lastSuccessAt || 0),
    backgroundSyncLastPolledAt: Number(backgroundSyncStatus?.lastPolledAt || 0),
    backgroundSyncNotificationOwner: String(backgroundSyncStatus?.notificationOwner || ''),
    backgroundSyncBindingId: String(backgroundSyncStatus?.bindingId || ''),
    backgroundSyncCursorSubmittedAt: String(backgroundSyncStatus?.cursorSubmittedAt || ''),
    backgroundSyncCursorLeaveRequestId: Number(backgroundSyncStatus?.cursorLeaveRequestId || 0),
    systemNotificationOwner: resolveSystemNotificationOwner({
      jpushOperational: Boolean(jpushStatus?.pushOperational),
      jpushRegistrationIdReady: Boolean(jpushStatus?.registrationId)
    }),
    backgroundSyncWindows: Array.isArray(backgroundSyncStatus?.windows) && backgroundSyncStatus.windows.length
      ? backgroundSyncStatus.windows
      : TEACHER_BACKGROUND_SYNC_WINDOWS,
    localReminderEnabled: Boolean(localReminderStatus?.enabled),
    localReminderConfigured: Boolean(localReminderStatus?.configured),
    localReminderTeacherId: String(localReminderStatus?.teacherId || ''),
    localReminderReminderTime: String(localReminderStatus?.reminderTime || LOCAL_DAILY_REMINDER_TIME),
    localReminderRoute: String(localReminderStatus?.route || APPROVAL_ROUTE),
    localReminderHasScheduleBundle: Boolean(localReminderStatus?.hasScheduleBundle),
    localReminderLastScheduleSyncAt: Number(localReminderStatus?.lastScheduleSyncAt || 0),
    localReminderNextTriggerAt: Number(localReminderStatus?.nextTriggerAt || 0),
    localReminderLastTriggeredAt: Number(localReminderStatus?.lastTriggeredAt || 0),
    localReminderLastNotifiedAt: Number(localReminderStatus?.lastNotifiedAt || 0)
  });
}

async function getDeviceRegistrationPayload(permissionStatus) {
  const [deviceId, deviceInfo, appInfo, jpushStatus] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
    App.getInfo(),
    ensureNativePushOperational('register-device')
  ]);

  const deviceFingerprint = buildDeviceFingerprint(deviceId, deviceInfo);
  const jpushRegistrationId = String(jpushStatus?.registrationId || '').trim();
  const bindingId = resolveCurrentBindingId();
  const systemNotificationOwner = resolveSystemNotificationOwner({
    jpushOperational: Boolean(jpushStatus?.pushOperational),
    jpushRegistrationIdReady: Boolean(jpushRegistrationId)
  });

  return {
    bindingId,
    registrationId: jpushRegistrationId || deviceId.identifier,
    deviceFingerprint,
    platform: deviceInfo.platform || 'android',
    provider: jpushRegistrationId ? 'jpush' : 'local_notifications',
    manufacturer: deviceInfo.manufacturer || '',
    model: deviceInfo.model || '',
    appVersion: appInfo.version || '',
    permissionSnapshot: {
      ...permissionStatus,
      jpushEnabled: Boolean(jpushStatus?.enabled),
      jpushSdkConfigured: Boolean(jpushStatus?.sdkConfigured),
      vivoPushConfigured: Boolean(jpushStatus?.vivoPushConfigured),
      honorPushConfigured: Boolean(jpushStatus?.honorPushConfigured),
      jpushPushStopped: Boolean(jpushStatus?.pushStopped),
      jpushOperational: Boolean(jpushStatus?.pushOperational),
      jpushRegistrationIdReady: Boolean(jpushRegistrationId),
      jpushRegistrationId,
      systemNotificationOwner,
      lastPushRegisterAt: Number(jpushStatus?.lastRegistrationAt || permissionStatus?.lastPushRegisterAt || 0),
      lastRemoteNotificationAt: Number(jpushStatus?.lastRemoteNotificationAt || permissionStatus?.lastRemoteNotificationAt || 0)
    }
  };
}

function shouldRegisterPayload(payload, options = {}) {
  const previousSession = loadRegisteredDeviceSession();
  if (!previousSession) {
    return true;
  }

  if (options.force) {
    return true;
  }

  if (previousSession.authToken !== currentToken) {
    return true;
  }

  if (previousSession.deviceFingerprint !== payload.deviceFingerprint) {
    return true;
  }

  if (previousSession.bindingId !== payload.bindingId) {
    return true;
  }

  if (previousSession.registrationId !== payload.registrationId) {
    return true;
  }

  if (previousSession.provider !== payload.provider) {
    return true;
  }

  const lastSyncedAt = Number(previousSession.lastSyncedAt || 0);
  return Date.now() - lastSyncedAt >= REGISTRATION_REFRESH_STALE_MS;
}

async function rememberDeliveredLeaveRequest(leaveRequestId, source) {
  if (!isNativeAndroid() || !leaveRequestId) {
    return;
  }

  await TeacherJPush.rememberDeliveredNotification({
    leaveRequestId: Number(leaveRequestId),
    source: String(source || LOCAL_SOCKET_NOTIFICATION_SOURCE)
  }).catch(() => {});
}

async function syncBackgroundRuntime(permissionStatus = null) {
  if (!isNativeAndroid()) {
    return {
      enabled: false,
      configured: false,
      appIsForeground: true,
      lastRunAt: 0,
      lastSuccessAt: 0,
      lastPolledAt: 0,
      notificationOwner: '',
      bindingId: '',
      cursorSubmittedAt: '',
      cursorLeaveRequestId: 0,
      windows: TEACHER_BACKGROUND_SYNC_WINDOWS
    };
  }

  await ensureServerRuntimeReady();
  const runtimeState = getServerRuntimeState();
  const serverOrigin = String(runtimeState.serverOrigin || runtimeState.socketUrl || '').trim();
  const effectivePermissionStatus = permissionStatus || activeStore?.permissionStatus || buildDefaultPermissionStatus();
  const backgroundCursorSubmittedAt = String(effectivePermissionStatus.backgroundSyncCursorSubmittedAt || '').trim();
  const backgroundCursorLeaveRequestId = Number(effectivePermissionStatus.backgroundSyncCursorLeaveRequestId || 0);
  const notificationOwner = resolveSystemNotificationOwner(effectivePermissionStatus);
  const bindingId = resolveCurrentBindingId();
  const syncEnabled = Boolean(
    currentToken
      && serverOrigin
      && (effectivePermissionStatus?.consentGranted ?? true)
      && (effectivePermissionStatus?.notificationsGranted ?? true)
      && (effectivePermissionStatus?.notificationsEnabled ?? true)
  );

  const result = await TeacherBackgroundSync.syncConfig({
    enabled: syncEnabled,
    serverOrigin,
    authToken: currentToken,
    bindingId,
    notificationOwner,
    cursorSubmittedAt: backgroundCursorSubmittedAt,
    cursorLeaveRequestId: backgroundCursorLeaveRequestId
  }).catch(() => readBackgroundSyncStatus());

  activeStore?.updatePermissionStatusPartial({
    backgroundSyncEnabled: Boolean(result?.enabled),
    backgroundSyncConfigured: Boolean(result?.configured),
    backgroundSyncAppIsForeground: Boolean(result?.appIsForeground),
    backgroundSyncLastRunAt: Number(result?.lastRunAt || 0),
    backgroundSyncLastSuccessAt: Number(result?.lastSuccessAt || 0),
    backgroundSyncLastPolledAt: Number(result?.lastPolledAt || 0),
    backgroundSyncNotificationOwner: String(result?.notificationOwner || ''),
    backgroundSyncBindingId: String(result?.bindingId || ''),
    backgroundSyncCursorSubmittedAt: String(result?.cursorSubmittedAt || backgroundCursorSubmittedAt),
    backgroundSyncCursorLeaveRequestId: Number(result?.cursorLeaveRequestId || backgroundCursorLeaveRequestId || 0),
    systemNotificationOwner: notificationOwner,
    backgroundSyncWindows: Array.isArray(result?.windows) && result.windows.length
      ? result.windows
      : TEACHER_BACKGROUND_SYNC_WINDOWS
  });

  return result;
}

async function syncLocalReminderRuntime(permissionStatus = null, options = {}) {
  if (!isNativeAndroid()) {
    return readLocalReminderStatus();
  }

  const effectivePermissionStatus = permissionStatus || activeStore?.permissionStatus || buildDefaultPermissionStatus();
  const teacherId = options.clearTeacherContext ? '' : String(options.teacherId || readCurrentTeacherId()).trim();
  const enabled = Boolean(
    !options.clearTeacherContext
      && currentToken
      && teacherId
      && (effectivePermissionStatus?.notificationsGranted ?? true)
      && (effectivePermissionStatus?.notificationsEnabled ?? true)
  );

  const payload = {
    enabled,
    reminderTime: LOCAL_DAILY_REMINDER_TIME,
    route: APPROVAL_ROUTE,
    teacherId
  };

  if (Object.prototype.hasOwnProperty.call(options, 'scheduleBundle')) {
    payload.scheduleBundle = normalizeTeacherScheduleBundle(options.scheduleBundle || {});
  }

  const result = await TeacherLocalReminder.syncConfig(payload).catch(() => readLocalReminderStatus());
  return applyLocalReminderStatus(result, effectivePermissionStatus);
}

export async function syncTeacherLocalReminderScheduleBundle(options = {}) {
  if (!isNativeAndroid()) {
    return null;
  }

  const permissionStatus = options.permissionStatus || activeStore?.permissionStatus || await readNativePermissionStatus();

  if (!currentToken || options.clearTeacherContext) {
    return syncLocalReminderRuntime(permissionStatus, {
      clearTeacherContext: true,
      scheduleBundle: {
        periods: [],
        schedules: [],
        specialDates: [],
        syncedAt: 0
      }
    });
  }

  if (options.bundle) {
    return syncLocalReminderRuntime(permissionStatus, {
      scheduleBundle: normalizeTeacherScheduleBundle(options.bundle)
    });
  }

  const localReminderStatus = await readLocalReminderStatus();
  if (!options.force && isSameLocalDay(localReminderStatus?.lastScheduleSyncAt, Date.now())) {
    return syncLocalReminderRuntime(permissionStatus);
  }

  try {
    const response = await getSchedules();
    return syncLocalReminderRuntime(permissionStatus, {
      scheduleBundle: normalizeTeacherScheduleBundle(response)
    });
  } catch (error) {
    console.warn('Sync teacher local reminder schedules failed:', error);
    return syncLocalReminderRuntime(permissionStatus);
  }
}

async function consumePendingRegistrationUpgrade(reason = 'unknown') {
  if (!isNativeAndroid()) {
    return false;
  }

  const pending = await TeacherJPush.consumePendingRegistrationUpgrade().catch(() => ({
    hasPending: false,
    payload: null
  }));

  if (!pending?.hasPending || !pending?.payload?.registrationId) {
    return false;
  }

  activeStore?.updatePermissionStatusPartial({
    jpushRegistrationIdReady: true,
    jpushRegistrationId: String(pending.payload.registrationId || ''),
    lastPushRegisterAt: Number(pending.payload.registeredAt || Date.now()),
    systemNotificationOwner: resolveSystemNotificationOwner({
      ...(activeStore?.permissionStatus || {}),
      jpushRegistrationIdReady: true,
      jpushRegistrationId: String(pending.payload.registrationId || '')
    })
  });

  if (!currentToken) {
    return true;
  }

  await registerCurrentDevice({
    force: true,
    reason
  }).catch(() => {});

  return true;
}

function clearRegistrationRefreshTimer() {
  if (!registrationRefreshTimer) {
    return;
  }

  window.clearInterval(registrationRefreshTimer);
  registrationRefreshTimer = null;
}

function ensureRegistrationRefreshTimer() {
  if (!isNativeAndroid() || !currentToken || registrationRefreshTimer) {
    return;
  }

  registrationRefreshTimer = window.setInterval(async () => {
    if (!currentToken) {
      clearRegistrationRefreshTimer();
      return;
    }

    const jpushStatus = await ensureNativePushOperational('registration-refresh');
    const registeredSession = loadRegisteredDeviceSession();
    const hasUpgradedJPushRegistration = Boolean(
      jpushStatus.registrationId
        && registeredSession?.provider === 'jpush'
        && registeredSession?.registrationId === jpushStatus.registrationId
    );

    if (hasUpgradedJPushRegistration) {
      clearRegistrationRefreshTimer();
      return;
    }

    await registerCurrentDevice({
      force: Boolean(jpushStatus.registrationId),
      reason: 'registration-refresh'
    }).catch(() => {});
  }, REGISTRATION_REFRESH_INTERVAL_MS);
}

async function unregisterDeviceSession(session, reason = 'unknown') {
  if (!session?.deviceFingerprint) {
    return true;
  }

  if (!session.authToken) {
    savePendingUnregisterSession(session);
    return false;
  }

  try {
    await unregisterPushDevice({
      bindingId: session.bindingId,
      deviceFingerprint: session.deviceFingerprint,
      registrationId: session.registrationId || ''
    }, buildAuthConfig(session.authToken));

    const currentSession = loadRegisteredDeviceSession();
    if (
      currentSession?.deviceFingerprint === session.deviceFingerprint
      && currentSession?.bindingId === session.bindingId
    ) {
      clearRegisteredDeviceSession();
    }

    const pendingSession = loadPendingUnregisterSession();
    if (
      pendingSession?.deviceFingerprint === session.deviceFingerprint
      && pendingSession?.bindingId === session.bindingId
    ) {
      clearPendingUnregisterSession();
    }

    return true;
  } catch (error) {
    console.warn('Teacher push device unregister failed, keeping retry session.', {
      reason,
      deviceFingerprint: session.deviceFingerprint
    });
    savePendingUnregisterSession(session);
    return false;
  }
}

async function flushPendingUnregisterSession(reason = 'unknown') {
  if (!isNativeAndroid()) {
    return true;
  }

  const pendingSession = loadPendingUnregisterSession();
  if (!pendingSession?.deviceFingerprint) {
    return true;
  }

  return unregisterDeviceSession(pendingSession, reason);
}

async function registerCurrentDevice(options = {}) {
  if (!currentToken || !isNativeAndroid()) {
    return null;
  }

  await flushPendingUnregisterSession('before-register');

  const permissionStatus = await readNativePermissionStatus();
  if (permissionStatus?.consentGranted === false) {
    activeStore?.setPermissionStatus(permissionStatus);
    await syncBackgroundRuntime(permissionStatus);
    return null;
  }

  const payload = await getDeviceRegistrationPayload(permissionStatus);

  if (!shouldRegisterPayload(payload, options)) {
    activeStore?.setPermissionStatus(payload.permissionSnapshot);
    await syncBackgroundRuntime(payload.permissionSnapshot);
    return payload;
  }

  await registerPushDevice(payload, buildAuthConfig(currentToken));

  saveRegisteredDeviceSession({
    bindingId: payload.bindingId,
    deviceFingerprint: payload.deviceFingerprint,
    registrationId: payload.registrationId,
    provider: payload.provider,
    authToken: currentToken,
    lastSyncedAt: Date.now()
  });

  activeStore?.setPermissionStatus(payload.permissionSnapshot);
  await syncBackgroundRuntime(payload.permissionSnapshot);

  if (payload.provider !== 'jpush') {
    ensureRegistrationRefreshTimer();
  } else {
    clearRegistrationRefreshTimer();
  }

  return payload;
}

function getNextBulkPermissionStep(status) {
  if (!status?.notificationsGranted) {
    return {
      key: 'notification-permission',
      inline: true,
      execute: requestTeacherNotificationPermission
    };
  }

  if (!status?.notificationsEnabled) {
    return {
      key: 'notification-settings',
      inline: false,
      execute: openTeacherNotificationSettings
    };
  }

  if (!status?.batteryOptimizationIgnored) {
    return {
      key: 'battery-settings',
      inline: false,
      execute: openTeacherBatteryOptimizationSettings
    };
  }

  if (status?.canOpenAutoStartSettings) {
    return {
      key: 'auto-start-settings',
      inline: false,
      execute: openTeacherAutoStartSettings
    };
  }

  return null;
}

export function cancelTeacherBulkPermissionFlow(notificationStore) {
  stopTeacherBulkPermissionFlow(notificationStore || activeStore);
}

export async function ensureTeacherPushConsent(notificationStore) {
  activeStore = notificationStore || activeStore;

  if (!isNativeAndroid()) {
    const webStatus = buildDefaultPermissionStatus({
      consentGranted: true
    });
    notificationStore?.setPermissionStatus(webStatus);
    notificationStore?.setPermissionPromptStep(PERMISSION_PROMPT_STEP_PERMISSIONS);
    return webStatus;
  }

  const currentStatus = notificationStore?.permissionStatus || await readNativePermissionStatus();
  if (currentStatus?.consentGranted) {
    notificationStore?.setPermissionStatus(currentStatus);
    notificationStore?.setPermissionPromptStep(PERMISSION_PROMPT_STEP_PERMISSIONS);
    return currentStatus;
  }

  await TeacherJPush.grantConsentAndEnsureInitialized();
  const permissionStatus = await refreshTeacherPermissionStatus(notificationStore);
  notificationStore?.setPermissionPromptStep(PERMISSION_PROMPT_STEP_PERMISSIONS);

  if (currentToken) {
    await registerCurrentDevice({
      force: true,
      reason: 'grant-consent'
    }).catch(() => {});
  }

  return notificationStore?.permissionStatus || permissionStatus;
}

export async function advanceTeacherBulkPermissionFlow(notificationStore, options = {}) {
  const targetStore = notificationStore || activeStore;
  const permissionStatus = options.status || await refreshTeacherPermissionStatus(targetStore);

  if (!targetStore?.bulkPermissionFlowActive) {
    return permissionStatus;
  }

  if (closePermissionPromptIfComplete(targetStore, permissionStatus)) {
    return permissionStatus;
  }

  const nextStep = getNextBulkPermissionStep(permissionStatus);
  if (!nextStep) {
    stopTeacherBulkPermissionFlow(targetStore);
    openPermissionPrompt(targetStore, permissionStatus, {
      step: PERMISSION_PROMPT_STEP_PERMISSIONS,
      bulkPermissionFlowActive: false
    });
    return permissionStatus;
  }

  if (bulkPermissionFlowState.lastLaunchedStep === nextStep.key) {
    stopTeacherBulkPermissionFlow(targetStore);
    openPermissionPrompt(targetStore, permissionStatus, {
      step: PERMISSION_PROMPT_STEP_PERMISSIONS,
      bulkPermissionFlowActive: false
    });
    return permissionStatus;
  }

  bulkPermissionFlowState.lastLaunchedStep = nextStep.key;
  const nextStatus = await nextStep.execute(targetStore);

  if (nextStep.inline) {
    return advanceTeacherBulkPermissionFlow(targetStore, {
      status: nextStatus
    });
  }

  return nextStatus;
}

export async function startTeacherBulkPermissionFlow(notificationStore) {
  const targetStore = notificationStore || activeStore;
  const permissionStatus = await ensureTeacherPushConsent(targetStore);

  targetStore?.setBulkPermissionFlowActive(true);
  bulkPermissionFlowState = {
    lastLaunchedStep: ''
  };

  openPermissionPrompt(targetStore, permissionStatus, {
    step: PERMISSION_PROMPT_STEP_PERMISSIONS,
    bulkPermissionFlowActive: true
  });

  if (closePermissionPromptIfComplete(targetStore, permissionStatus)) {
    return permissionStatus;
  }

  return advanceTeacherBulkPermissionFlow(targetStore, {
    status: permissionStatus
  });
}

function navigateToApproval(extra = {}) {
  activeStore?.clearPopup();
  activeStore?.clearBanner();

  if (activeRouter && activeRouter.currentRoute.value.path !== APPROVAL_ROUTE) {
    activeRouter.push(extra.route || APPROVAL_ROUTE);
  }
}

async function consumePendingNotificationOpen() {
  if (!isNativeAndroid()) {
    return false;
  }

  const pending = await TeacherJPush.consumePendingOpen().catch(() => ({
    hasPending: false,
    payload: null
  }));

  if (!pending?.hasPending || !pending?.payload) {
    return false;
  }

  const payload = pending.payload;
  console.info('Teacher notification opened from native channel.', {
    source: payload.source || JPUSH_REMOTE_NOTIFICATION_SOURCE,
    leaveRequestId: payload.leaveRequestId || null,
    appIsActive
  });

  activeStore?.updatePermissionStatusPartial({
    lastRemoteNotificationAt: Date.now()
  });

  if (payload.leaveRequestId) {
    activeStore?.handlePendingLeave(payload, {
      showBanner: false
    });
  }

  navigateToApproval({
    route: payload.route || APPROVAL_ROUTE
  });

  return true;
}

async function bindNotificationListeners() {
  if (listenersBound) {
    return;
  }

  listenersBound = true;

  if (isNativeAndroid()) {
    await TeacherJPush.addListener('registrationUpdated', async (event) => {
      activeStore?.updatePermissionStatusPartial({
        jpushRegistrationIdReady: Boolean(event?.registrationId),
        jpushRegistrationId: String(event?.registrationId || ''),
        lastPushRegisterAt: Number(event?.registeredAt || Date.now()),
        systemNotificationOwner: resolveSystemNotificationOwner({
          ...(activeStore?.permissionStatus || {}),
          jpushRegistrationIdReady: Boolean(event?.registrationId),
          jpushRegistrationId: String(event?.registrationId || '')
        })
      });

      await consumePendingRegistrationUpgrade('registration-updated');
    });
  }

  await App.addListener('appStateChange', async (state) => {
    appIsActive = Boolean(state?.isActive);
    activeStore?.updatePermissionStatusPartial({ appIsActive });

    if (appIsActive) {
      const permissionStatus = await refreshTeacherPermissionStatus(activeStore, {
        allowAutoNavigate: false,
        source: 'app-foreground',
        route: activeRouter?.currentRoute?.value
      });
      await consumePendingRegistrationUpgrade('app-foreground');
      await consumePendingNotificationOpen();
      await flushPendingUnregisterSession('app-foreground');
      if (permissionStatus?.consentGranted) {
        await registerCurrentDevice({
          force: true,
          reason: 'app-foreground'
        });
      }
      await syncTeacherLocalReminderScheduleBundle({
        permissionStatus: activeStore?.permissionStatus || permissionStatus,
        force: false
      });
      await advanceTeacherBulkPermissionFlow(activeStore, {
        status: activeStore?.permissionStatus || permissionStatus
      }).catch(() => {});
      return;
    }

    await syncBackgroundRuntime(activeStore?.permissionStatus || null);
    await syncLocalReminderRuntime(activeStore?.permissionStatus || null);
  });

  await LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
    const extra = event?.notification?.extra || {};
    if (extra?.leaveRequestId) {
      await rememberDeliveredLeaveRequest(extra.leaveRequestId, extra.source || LOCAL_SOCKET_NOTIFICATION_SOURCE);
    }

    navigateToApproval({
      route: extra?.route || APPROVAL_ROUTE
    });
  });
}

export async function bootstrapTeacherNotificationRuntime({ router, notificationStore }) {
  activeRouter = router;
  activeStore = notificationStore;
  lastRegisteredFingerprint = String(loadRegisteredDeviceSession()?.deviceFingerprint || '');

  if (runtimeBootstrapped) {
    return;
  }

  runtimeBootstrapped = true;
  if (!isNativeAndroid()) {
    return;
  }

  await ensureChannelRegistered();
  await bindNotificationListeners();
  const jpushStatus = await ensureNativePushOperational('bootstrap');
  if (jpushStatus?.consentGranted) {
    await consumePendingRegistrationUpgrade('bootstrap');
  }
  await flushPendingUnregisterSession('bootstrap');
  await consumePendingNotificationOpen();
  if (jpushStatus?.consentGranted) {
    ensureRegistrationRefreshTimer();
  }
}

export async function syncTeacherNotificationSession({ token, notificationStore, router }) {
  currentToken = token || '';
  activeStore = notificationStore || activeStore;
  activeRouter = router || activeRouter;

  if (!isNativeAndroid()) {
    const webStatus = buildDefaultPermissionStatus({
      consentGranted: true
    });
    notificationStore?.setPermissionStatus(webStatus);
    notificationStore?.clearPermissionReminder();
    return webStatus;
  }

  if (!currentToken) {
    clearRegistrationRefreshTimer();
    notificationStore?.clearPermissionReminder();
    await syncBackgroundRuntime(buildDefaultPermissionStatus());
    await syncTeacherLocalReminderScheduleBundle({
      permissionStatus: buildDefaultPermissionStatus(),
      clearTeacherContext: true
    });
    await unregisterCurrentDevice('session-cleared');
    return null;
  }

  const jpushStatus = await ensureNativePushOperational('session-sync');
  if (jpushStatus?.consentGranted) {
    await consumePendingRegistrationUpgrade('session-sync');
  }
  await flushPendingUnregisterSession('session-sync');
  const permissionStatus = await readNativePermissionStatus();
  notificationStore?.setPermissionStatus(permissionStatus);
  await syncTeacherLocalReminderScheduleBundle({
    permissionStatus,
    force: true
  });

  if (permissionStatus?.consentGranted === false) {
    openPermissionPrompt(notificationStore, permissionStatus, {
      step: PERMISSION_PROMPT_STEP_CONSENT,
      bulkPermissionFlowActive: false
    });
    await syncTeacherPermissionGuidance(permissionStatus, {
      source: 'session-sync',
      route: activeRouter?.currentRoute?.value
    });
    return notificationStore?.permissionStatus || permissionStatus;
  }

  if (shouldPromptForPermissions(permissionStatus)) {
    openPermissionPrompt(notificationStore, permissionStatus, {
      step: PERMISSION_PROMPT_STEP_PERMISSIONS,
      bulkPermissionFlowActive: false
    });
    await syncTeacherPermissionGuidance(permissionStatus, {
      source: 'session-sync',
      route: activeRouter?.currentRoute?.value
    });
  } else {
    notificationStore?.clearPermissionReminder();
  }

  await registerCurrentDevice({
    force: true,
    reason: 'session-sync'
  });
  await consumePendingNotificationOpen();
  ensureRegistrationRefreshTimer();

  return notificationStore?.permissionStatus || permissionStatus;
}

export async function refreshTeacherPermissionStatus(notificationStore, options = {}) {
  if (!isNativeAndroid()) {
    const status = buildDefaultPermissionStatus({
      consentGranted: true
    });
    notificationStore?.setPermissionStatus(status);
    notificationStore?.clearPermissionReminder();
    return status;
  }

  const jpushStatus = await ensureNativePushOperational('refresh-permission-status');
  const permissionStatus = await readNativePermissionStatus();
  notificationStore?.setPermissionStatus(permissionStatus);
  await syncBackgroundRuntime(permissionStatus);
  await syncTeacherLocalReminderScheduleBundle({
    permissionStatus,
    force: false
  });
  await syncTeacherPermissionGuidance(permissionStatus, {
    allowAutoNavigate: Boolean(options.allowAutoNavigate),
    source: options.source || 'refresh-permission-status',
    route: options.route || activeRouter?.currentRoute?.value
  });
  if (jpushStatus?.consentGranted) {
    closePermissionPromptIfComplete(notificationStore, permissionStatus);
  }
  return notificationStore?.permissionStatus || permissionStatus;
}

export async function requestTeacherNotificationPermission(notificationStore) {
  if (!isNativeAndroid()) {
    return refreshTeacherPermissionStatus(notificationStore);
  }

  await ensureTeacherPushConsent(notificationStore);
  await LocalNotifications.requestPermissions();
  const permissionStatus = await refreshTeacherPermissionStatus(notificationStore);
  if (permissionStatus?.consentGranted) {
    await registerCurrentDevice({ force: true, reason: 'request-permission' });
  }
  return permissionStatus;
}

export async function openTeacherNotificationSettings(notificationStore) {
  if (!isNativeAndroid()) {
    return refreshTeacherPermissionStatus(notificationStore);
  }

  await TeacherDeviceSettings.openNotificationSettings();
  return refreshTeacherPermissionStatus(notificationStore);
}

export async function openTeacherAutoStartSettings(notificationStore) {
  if (!isNativeAndroid()) {
    return refreshTeacherPermissionStatus(notificationStore);
  }

  await TeacherDeviceSettings.openAutoStartSettings();
  return refreshTeacherPermissionStatus(notificationStore);
}

export async function openTeacherBatteryOptimizationSettings(notificationStore) {
  if (!isNativeAndroid()) {
    return refreshTeacherPermissionStatus(notificationStore);
  }

  await TeacherDeviceSettings.openBatteryOptimizationSettings();
  return refreshTeacherPermissionStatus(notificationStore);
}

export async function presentTeacherPendingLeaveNotification(payload, notificationStore) {
  if (!isNativeAndroid()) {
    return false;
  }

  const permissionStatus = notificationStore?.permissionStatus || await readNativePermissionStatus();
  if (permissionStatus?.consentGranted === false) {
    return false;
  }

  const canUseLocalFallback = !permissionStatus.jpushOperational || !permissionStatus.jpushRegistrationIdReady;
  const shouldPreferRemoteWhileBackground = !permissionStatus.appIsActive && !canUseLocalFallback;

  if (shouldPreferRemoteWhileBackground) {
    console.info('Skip local teacher system notification because JPush remote delivery is available.', {
      source: LOCAL_SOCKET_NOTIFICATION_SOURCE,
      leaveRequestId: payload?.leaveRequestId || null,
      appIsActive: permissionStatus.appIsActive,
      jpushEnabled: permissionStatus.jpushEnabled,
      jpushOperational: permissionStatus.jpushOperational,
      jpushRegistrationIdReady: permissionStatus.jpushRegistrationIdReady
    });
    return false;
  }

  if (!permissionStatus.notificationsGranted || !permissionStatus.notificationsEnabled) {
    return false;
  }

  const notificationId = Number(payload?.leaveRequestId || Date.now());
  if (notificationStore?.lastSystemNotificationId === notificationId) {
    return false;
  }

  console.info('Present local teacher system notification.', {
    source: LOCAL_SOCKET_NOTIFICATION_SOURCE,
    leaveRequestId: payload?.leaveRequestId || null,
    appIsActive: permissionStatus.appIsActive,
    jpushEnabled: permissionStatus.jpushEnabled,
    jpushOperational: permissionStatus.jpushOperational,
    jpushRegistrationIdReady: permissionStatus.jpushRegistrationIdReady,
    mode: permissionStatus.appIsActive ? 'foreground_realtime' : 'background_fallback'
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: buildNotificationTitle(payload),
        body: buildNotificationBody(payload),
        largeBody: buildNotificationBody(payload),
        summaryText: '教师待审批提醒',
        channelId: TEACHER_NOTIFICATION_CHANNEL_ID,
        actionTypeId: TEACHER_NOTIFICATION_ACTION_TYPE,
        autoCancel: true,
        extra: {
          source: LOCAL_SOCKET_NOTIFICATION_SOURCE,
          route: APPROVAL_ROUTE,
          leaveRequestId: notificationId
        }
      }
    ]
  });

  await rememberDeliveredLeaveRequest(notificationId, LOCAL_SOCKET_NOTIFICATION_SOURCE);
  notificationStore?.setLastSystemNotificationId(notificationId);
  return true;
}

function applyPendingEventsCursor(response, notificationStore) {
  const nextCursor = response?.nextCursor || null;
  if (!nextCursor) {
    return null;
  }

  const cursorSubmittedAt = String(nextCursor.submittedAt || '').trim();
  const cursorLeaveRequestId = Number(nextCursor.leaveRequestId || 0);
  notificationStore?.updatePermissionStatusPartial({
    backgroundSyncCursorSubmittedAt: cursorSubmittedAt,
    backgroundSyncCursorLeaveRequestId: cursorLeaveRequestId
  });

  return {
    cursorSubmittedAt,
    cursorLeaveRequestId
  };
}

export async function syncTeacherBackgroundPendingEvents({
  cursorSubmittedAt,
  cursorLeaveRequestId,
  notificationStore
} = {}) {
  if (!currentToken || !isNativeAndroid()) {
    return [];
  }

  const response = await getPendingNotificationEvents({
    cursorSubmittedAt: cursorSubmittedAt
      || notificationStore?.permissionStatus?.backgroundSyncCursorSubmittedAt
      || new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    cursorLeaveRequestId: Number(
      cursorLeaveRequestId
      || notificationStore?.permissionStatus?.backgroundSyncCursorLeaveRequestId
      || 0
    )
  }, buildAuthConfig(currentToken));

  const events = Array.isArray(response?.events) ? response.events : [];
  applyPendingEventsCursor(response, notificationStore);
  for (const event of events) {
    const accepted = notificationStore?.handlePendingLeave(event, {
      showBanner: false
    });

    if (accepted) {
      await rememberDeliveredLeaveRequest(event.leaveRequestId, BACKGROUND_SYNC_NOTIFICATION_SOURCE);
    }
  }

  await syncBackgroundRuntime(notificationStore?.permissionStatus || null);
  return events;
}

async function unregisterCurrentDevice(reason = 'unknown') {
  if (!isNativeAndroid()) {
    return true;
  }

  const registeredSession = loadRegisteredDeviceSession();
  if (!registeredSession?.deviceFingerprint) {
    clearRegisteredDeviceSession();
    return true;
  }

  const session = {
    ...registeredSession,
    authToken: currentToken || registeredSession.authToken || ''
  };

  savePendingUnregisterSession(session);
  const success = await unregisterDeviceSession(session, reason);

  if (success) {
    clearRegisteredDeviceSession();
  }

  return success;
}

export async function destroyTeacherNotificationSession() {
  const logoutToken = currentToken;
  stopTeacherBulkPermissionFlow(activeStore);
  clearRegistrationRefreshTimer();
  currentToken = '';

  const registeredSession = loadRegisteredDeviceSession();
  if (registeredSession?.deviceFingerprint) {
    savePendingUnregisterSession({
      ...registeredSession,
      authToken: logoutToken || registeredSession.authToken || ''
    });
  }

  await syncBackgroundRuntime(buildDefaultPermissionStatus({
    notificationsGranted: true,
    notificationsEnabled: true
  }));
  await syncTeacherLocalReminderScheduleBundle({
    permissionStatus: buildDefaultPermissionStatus({
      notificationsGranted: true,
      notificationsEnabled: true
    }),
    clearTeacherContext: true
  });
  await unregisterCurrentDevice('destroy-session');
}
