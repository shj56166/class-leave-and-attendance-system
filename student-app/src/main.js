import '../../design-system/modal/modal-system.css';
import { setupModalCapabilities } from '../../design-system/modal/modal-capabilities';
import 'vant/lib/index.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './route-transitions.css';
import { installRouteTransitionTracking } from './composables/useRouteTransition';
import { bootstrapServerRuntime } from './config/serverRuntime';
import router from './router';

setupModalCapabilities();

async function clearDevServiceWorkers() {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (!registrations.length) {
      return;
    }

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }

    console.info('[student-app] Cleared legacy service workers in dev mode.');
  } catch (error) {
    console.warn('[student-app] Failed to clear dev service workers:', error);
  }
}

const app = createApp(App);
const pinia = createPinia();

installRouteTransitionTracking(router);

app.use(pinia);
app.use(router);

bootstrapServerRuntime().catch((error) => {
  console.warn('Bootstrap student server runtime failed:', error);
});

app.mount('#app');

void clearDevServiceWorkers();
