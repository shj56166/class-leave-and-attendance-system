import { registerPlugin } from '@capacitor/core';

const defaultStatus = {
  enabled: false,
  configured: false,
  teacherId: '',
  reminderTime: '07:40',
  route: '/dashboard/approval',
  hasScheduleBundle: false,
  lastScheduleSyncAt: 0,
  nextTriggerAt: 0,
  lastTriggeredAt: 0,
  lastNotifiedAt: 0
};

export const TeacherLocalReminder = registerPlugin('TeacherLocalReminder', {
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
