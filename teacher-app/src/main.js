import '../../design-system/modal/modal-system.css';
import { setupModalCapabilities } from '../../design-system/modal/modal-capabilities';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './style.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import router from './router';
import { bootstrapServerRuntime } from './config/serverRuntime';
import { useUiPreferencesStore } from './stores/uiPreferences';

setupModalCapabilities();

const applyPlatformClass = () => {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  const platformValue = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  const isWindows = /win/i.test(String(platformValue));

  document.documentElement.classList.toggle('ui-platform-windows', isWindows);
};

applyPlatformClass();

const app = createApp(App);
const pinia = createPinia();
const uiPreferencesStore = useUiPreferencesStore(pinia);

uiPreferencesStore.initialize();

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(pinia);
app.use(router);
app.use(ElementPlus);

bootstrapServerRuntime().catch((error) => {
  console.error('Bootstrap server runtime failed:', error);
});

app.mount('#app');
