import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qingjia.teacher',
  appName: 'Qingjia Teacher',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
