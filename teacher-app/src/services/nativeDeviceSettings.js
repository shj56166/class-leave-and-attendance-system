import { registerPlugin } from '@capacitor/core';

export const TeacherDeviceSettings = registerPlugin('TeacherDeviceSettings', {
  web: () => ({
    async getPermissionStatus() {
      return {
        notificationsEnabled: true,
        batteryOptimizationIgnored: true,
        canOpenAutoStartSettings: false,
        manufacturer: 'web'
      };
    },
    async getNetworkInfo() {
      return {
        ipv4Address: '',
        gatewayAddress: '',
        subnetMask: '',
        subnetPrefix: ''
      };
    },
    async openNotificationSettings() {},
    async openAutoStartSettings() {},
    async openBatteryOptimizationSettings() {}
  })
});
