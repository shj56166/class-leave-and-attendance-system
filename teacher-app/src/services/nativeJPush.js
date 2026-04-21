import { registerPlugin } from '@capacitor/core';

export const TeacherJPush = registerPlugin('TeacherJPush', {
  web: () => ({
    async getStatus() {
      return {
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
      };
    },
    async getConsentStatus() {
      return {
        consentGranted: false
      };
    },
    async grantConsentAndEnsureInitialized() {
      return {
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
      };
    },
    async setPushEnabled() {
      return {
        consentGranted: false,
        enabled: false,
        sdkConfigured: false,
        vivoPushConfigured: false,
        honorPushConfigured: false,
        pushStopped: false,
        pushOperational: false
      };
    },
    async consumePendingOpen() {
      return {
        hasPending: false,
        payload: null
      };
    },
    async consumePendingRegistrationUpgrade() {
      return {
        hasPending: false,
        payload: null
      };
    },
    async rememberDeliveredNotification() {
      return {
        success: true
      };
    }
  })
});
