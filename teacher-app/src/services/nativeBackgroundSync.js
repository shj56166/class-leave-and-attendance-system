import { registerPlugin } from '@capacitor/core';
import {
  TEACHER_BACKGROUND_SYNC_WINDOWS
} from '../constants/backgroundSync';

const defaultStatus = {
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

export const TeacherBackgroundSync = registerPlugin('TeacherBackgroundSync', {
  web: () => ({
    async getStatus() {
      return {
        ...defaultStatus
      };
    },
    async syncConfig() {
      return {
        ...defaultStatus
      };
    }
  })
});
