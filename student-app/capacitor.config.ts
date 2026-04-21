import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qingjia.student',
  appName: 'Qingjia Student',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
