export const TEACHER_NOTIFICATION_CHANNEL_ID = 'teacher_pending_approval';
export const TEACHER_NOTIFICATION_ACTION_TYPE = 'teacher_pending_approval_actions';
export const TEACHER_NOTIFICATION_ACTION_OPEN = 'open_approval';
export const APPROVAL_ROUTE = '/dashboard/approval';
export const APPROVAL_REMINDER_PERMISSIONS_ROUTE = '/dashboard/approval-reminder-permissions';

export function isTeacherPermissionFlowCompleted(status = null) {
  if (!status) {
    return false;
  }

  return Boolean(
    status.consentGranted
      && status.notificationsGranted
      && status.notificationsEnabled
      && status.batteryOptimizationIgnored
  );
}

export function resolveTeacherLaunchRoute({
  isAndroid = false,
  isLoggedIn = false,
  hasShownInitialPermissionGuide = true,
  permissionFlowCompleted = true
} = {}) {
  if (!isLoggedIn) {
    return APPROVAL_ROUTE;
  }

  if (isAndroid && !hasShownInitialPermissionGuide && !permissionFlowCompleted) {
    return APPROVAL_REMINDER_PERMISSIONS_ROUTE;
  }

  return APPROVAL_ROUTE;
}

export function resolveTeacherJPushRuntimeStatus(status = {}) {
  if (!status.jpushSdkConfigured) {
    return {
      title: '未注入',
      detail: '当前构建缺少可用 AppKey。'
    };
  }

  if (status.consentGranted === false) {
    return {
      title: '待启用提醒服务',
      detail: '当前构建已包含极光配置，但在你确认提醒服务前不会启动推送注册。'
    };
  }

  if (status.jpushPushStopped) {
    return {
      title: '已停止',
      detail: '检测到推送被 stop，应用恢复时会自动尝试 resume。'
    };
  }

  if (status.jpushOperational && status.jpushRegistrationIdReady) {
    return {
      title: '运行中',
      detail: '极光已完成初始化，并拿到 Registration ID。'
    };
  }

  return {
    title: '初始化中',
    detail: '提醒服务已启用，正在等待极光完成初始化和 Registration ID。'
  };
}

export function resolveTeacherJPushRegistrationStatus(status = {}) {
  if (status.consentGranted === false) {
    return {
      title: '等待中',
      detail: '启用提醒服务后才会开始申请 Registration ID。'
    };
  }

  if (status.jpushRegistrationIdReady) {
    return {
      title: '已就绪',
      detail: status.jpushRegistrationId || 'Registration ID 已同步。'
    };
  }

  if (status.lastPushRegisterAt) {
    return {
      title: '等待中',
      detail: '最近已尝试注册，正在等待极光返回 Registration ID。'
    };
  }

  return {
    title: '等待中',
    detail: '提醒服务启用后，会在初始化完成时生成 Registration ID。'
  };
}
