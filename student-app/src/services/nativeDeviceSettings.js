import { registerPlugin } from '@capacitor/core';

export const StudentDeviceSettings = registerPlugin('StudentDeviceSettings', {
  web: () => ({
    async getNetworkInfo() {
      return {
        ipv4Address: '',
        gatewayAddress: '',
        subnetMask: '',
        subnetPrefix: ''
      };
    }
  })
});
