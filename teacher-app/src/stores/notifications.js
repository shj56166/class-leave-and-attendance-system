import { defineStore } from 'pinia';
import {
  APPROVAL_REMINDER_PERMISSIONS_ROUTE,
  APPROVAL_ROUTE
} from '../constants/notifications';

const MAX_RECENT_LEAVE_REQUEST_IDS = 60;

function resolvePermissionPromptStep(status) {
  return status?.consentGranted === false ? 'consent' : 'permissions';
}

function normalizePermissionPromptPayload(input) {
  if (!input) {
    return {
      status: null,
      step: null,
      bulkPermissionFlowActive: null
    };
  }

  const hasPromptOptions = Object.prototype.hasOwnProperty.call(input, 'status')
    || Object.prototype.hasOwnProperty.call(input, 'step')
    || Object.prototype.hasOwnProperty.call(input, 'bulkPermissionFlowActive');

  if (hasPromptOptions) {
    return {
      status: input.status || null,
      step: input.step || null,
      bulkPermissionFlowActive: typeof input.bulkPermissionFlowActive === 'boolean'
        ? input.bulkPermissionFlowActive
        : null
    };
  }

  return {
    status: input,
    step: null,
    bulkPermissionFlowActive: null
  };
}

function buildBanner(summaryText) {
  return {
    text: summaryText || '有新的待审批请假',
    route: APPROVAL_ROUTE
  };
}

function buildPopup(summaryText, leaveRequestId) {
  return {
    title: '新的待审批请假',
    text: summaryText || '有新的待审批请假',
    route: APPROVAL_ROUTE,
    leaveRequestId: Number(leaveRequestId || 0)
  };
}

function buildPermissionReminderBanner(payload = {}) {
  return {
    text: String(payload.text || '完善审批提醒权限后，通知会更稳定').trim() || '完善审批提醒权限后，通知会更稳定',
    route: String(payload.route || APPROVAL_REMINDER_PERMISSIONS_ROUTE),
    source: String(payload.source || 'permission_guidance'),
    shownAt: payload.shownAt || new Date().toISOString()
  };
}

export const useTeacherNotificationsStore = defineStore('teacherNotifications', {
  state: () => ({
    unreadCount: 0,
    latestSummary: '',
    activeBanner: null,
    activePopup: null,
    needsApprovalRefresh: false,
    lastLeaveRequestId: null,
    recentLeaveRequestIds: [],
    permissionPromptStep: 'permissions',
    permissionStatus: null,
    bulkPermissionFlowActive: false,
    lastSystemNotificationId: null,
    permissionReminderBanner: null
  }),

  actions: {
    handlePendingLeave(payload, options = {}) {
      const leaveRequestId = Number(payload?.leaveRequestId || 0);
      if (!leaveRequestId || this.recentLeaveRequestIds.includes(leaveRequestId)) {
        return false;
      }

      const summaryText = String(payload?.summaryText || '有新的待审批请假');
      const showBanner = options.showBanner !== false;

      this.lastLeaveRequestId = leaveRequestId;
      this.recentLeaveRequestIds = [
        leaveRequestId,
        ...this.recentLeaveRequestIds.filter((item) => item !== leaveRequestId)
      ].slice(0, MAX_RECENT_LEAVE_REQUEST_IDS);
      this.latestSummary = summaryText;
      this.unreadCount += 1;
      this.needsApprovalRefresh = true;
      this.activeBanner = showBanner ? buildBanner(summaryText) : null;
      this.activePopup = buildPopup(summaryText, leaveRequestId);

      return true;
    },

    markApprovalRefreshed() {
      this.unreadCount = 0;
      this.activeBanner = null;
      this.needsApprovalRefresh = false;
    },

    clearPopup() {
      this.activePopup = null;
    },

    clearBanner() {
      this.activeBanner = null;
    },

    showPermissionReminder(payload = {}) {
      this.permissionReminderBanner = buildPermissionReminderBanner(payload);
    },

    clearPermissionReminder() {
      this.permissionReminderBanner = null;
    },

    openPermissionPrompt(payload = null) {
      const options = normalizePermissionPromptPayload(payload);

      if (options.status) {
        this.permissionStatus = options.status;
      }

      if (options.step) {
        this.permissionPromptStep = options.step;
      } else {
        this.permissionPromptStep = resolvePermissionPromptStep(this.permissionStatus);
      }

      if (options.bulkPermissionFlowActive !== null) {
        this.bulkPermissionFlowActive = options.bulkPermissionFlowActive;
      }
    },

    closePermissionPrompt() {
      this.bulkPermissionFlowActive = false;
    },

    setPermissionStatus(status) {
      this.permissionStatus = status || null;
    },

    updatePermissionStatusPartial(patch = {}) {
      this.permissionStatus = {
        ...(this.permissionStatus || {}),
        ...patch
      };
    },

    setPermissionPromptStep(step = 'permissions') {
      this.permissionPromptStep = step;
    },

    setBulkPermissionFlowActive(active) {
      this.bulkPermissionFlowActive = Boolean(active);
    },

    setLastSystemNotificationId(id) {
      this.lastSystemNotificationId = Number(id || 0) || null;
    },

    reset() {
      this.unreadCount = 0;
      this.latestSummary = '';
      this.activeBanner = null;
      this.activePopup = null;
      this.needsApprovalRefresh = false;
      this.lastLeaveRequestId = null;
      this.recentLeaveRequestIds = [];
      this.permissionPromptStep = 'permissions';
      this.permissionStatus = null;
      this.bulkPermissionFlowActive = false;
      this.lastSystemNotificationId = null;
      this.permissionReminderBanner = null;
    }
  }
});
