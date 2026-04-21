<template>
  <div class="app-shell">
    <div class="app-shell__frame">
      <main class="app-main">
        <div class="route-stage route-stage--tab">
          <router-view v-slot="{ Component }">
            <transition :name="tabTransitionName">
              <component
                :is="Component"
                :key="tabViewKey"
                class="route-scene route-scene--tab"
                :data-route-motion-tier="tabMotionTier"
              />
            </transition>
          </router-view>
        </div>
      </main>
    </div>

    <div class="app-tabbar-wrap">
      <nav ref="tabbarRef" class="app-tabbar" aria-label="学生端主导航">
        <div class="app-tabbar__ambient" aria-hidden="true"></div>

        <button
          v-for="item in tabs"
          :key="item.route"
          :ref="(element) => setTabRef(item.route, element)"
          type="button"
          class="app-tabbar__item"
          :class="{ 'app-tabbar__item--active': activeRoute === item.route }"
          :aria-current="activeRoute === item.route ? 'page' : undefined"
          @click="navigateTo(item.route)"
        >
          <span class="app-tabbar__icon-wrap" aria-hidden="true">
            <span class="app-tabbar__icon">
              <svg v-if="item.key === 'home'" viewBox="0 0 24 24" fill="none">
                <path d="M5.5 10.3L12 4.9L18.5 10.3V17.4C18.5 18.5046 17.6046 19.4 16.5 19.4H7.5C6.39543 19.4 5.5 18.5046 5.5 17.4V10.3Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M9.1 19.4V13.5C9.1 12.8373 9.63726 12.3 10.3 12.3H13.7C14.3627 12.3 14.9 12.8373 14.9 13.5V19.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4.4 10.7L12 4.25L19.6 10.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
              </svg>

              <svg v-else-if="item.key === 'manage'" viewBox="0 0 24 24" fill="none">
                <rect x="4.2" y="5" width="6.4" height="6.4" rx="2.2" stroke="currentColor" stroke-width="1.8" />
                <rect x="13.4" y="5" width="6.4" height="6.4" rx="2.2" stroke="currentColor" stroke-width="1.8" />
                <rect x="4.2" y="14.2" width="6.4" height="6.4" rx="2.2" stroke="currentColor" stroke-width="1.8" />
                <rect x="13.4" y="14.2" width="6.4" height="6.4" rx="2.2" stroke="currentColor" stroke-width="1.8" />
                <circle cx="17.1" cy="8.7" r="1.3" fill="currentColor" opacity="0.78" />
              </svg>

              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.9" />
                <path d="M12 4.2V5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M12 18.1V19.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M19.8 12H18.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M5.9 12H4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M17.52 6.48L16.3 7.7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M7.7 16.3L6.48 17.52" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M17.52 17.52L16.3 16.3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M7.7 7.7L6.48 6.48" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
          </span>

          <span class="app-tabbar__label">{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getStudentProfile } from '../api/student';
import { useRouteTransition } from '../composables/useRouteTransition';
import { useUserStore } from '../stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const {
  motionTier: tabMotionTier,
  transitionName: tabTransitionName,
  viewKey: tabViewKey
} = useRouteTransition('tab');

const tabs = [
  { key: 'home', label: '首页', route: '/app/home' },
  { key: 'manage', label: '管理', route: '/app/manage' },
  { key: 'settings', label: '设置', route: '/app/settings' }
];

const tabbarRef = ref(null);
const activeRoute = computed(() => {
  const matched = tabs.find((item) => (
    route.path === item.route
    || route.path.startsWith(`${item.route}/`)
  ));
  return matched?.route || '/app/home';
});

const tabRefs = new Map();
let resizeObserver = null;
let rafId = 0;

function setTabRef(targetRoute, element) {
  if (element) {
    tabRefs.set(targetRoute, element);
  } else {
    tabRefs.delete(targetRoute);
  }

  scheduleIndicatorUpdate();
}

function updateIndicator() {
  const target = tabRefs.get(activeRoute.value);
  const tabbar = tabbarRef.value;

  if (!tabbar || !target || target.offsetWidth === 0) {
    return;
  }
}

function scheduleIndicatorUpdate() {
  if (typeof window === 'undefined') {
    return;
  }

  window.cancelAnimationFrame(rafId);
  rafId = window.requestAnimationFrame(async () => {
    await nextTick();
    updateIndicator();
  });
}

function navigateTo(targetRoute) {
  if (!userStore.isLoggedIn && targetRoute !== '/app/home') {
    showToast('请先登录后再使用这个功能');
    router.push('/login');
    return;
  }

  if (targetRoute !== route.path) {
    router.push(targetRoute);
  }
}

function handleResize() {
  scheduleIndicatorUpdate();
}

async function syncStudentProfile() {
  if (!userStore.isLoggedIn) {
    return;
  }

  const requestToken = userStore.token;

  try {
    const response = await getStudentProfile();
    if (
      response?.student
      && userStore.isLoggedIn
      && userStore.token
      && userStore.token === requestToken
    ) {
      userStore.setUser({
        ...(userStore.user || {}),
        ...response.student
      });
    }
  } catch (error) {
    // Let the global request interceptor handle auth failures.
  }
}

function connectResizeObserver() {
  if (typeof ResizeObserver === 'undefined') {
    return;
  }

  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => {
    scheduleIndicatorUpdate();
  });

  if (tabbarRef.value) {
    resizeObserver.observe(tabbarRef.value);
  }

  tabRefs.forEach((element) => {
    if (element) {
      resizeObserver.observe(element);
    }
  });
}

watch(
  () => route.path,
  () => {
    scheduleIndicatorUpdate();
    syncStudentProfile();
  },
  { immediate: true }
);

onMounted(() => {
  connectResizeObserver();
  scheduleIndicatorUpdate();

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();

  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
    window.cancelAnimationFrame(rafId);
  }
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0) 34%),
    radial-gradient(circle at bottom left, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0) 26%),
    linear-gradient(180deg, #f8fbff 0%, #eef4ff 28%, #e6eefb 100%);
  color: #12316f;
}

.app-shell__frame {
  width: 100%;
  max-width: 448px;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 26px 0 92px;
}

.app-tabbar-wrap {
  position: fixed;
  left: 50%;
  bottom: 0;
  width: 100%;
  max-width: 448px;
  z-index: 45;
  padding: 0 0 calc(env(safe-area-inset-bottom, 0px) + 2px);
  display: flex;
  justify-content: center;
  transform: translateX(-50%);
  background:
    linear-gradient(180deg, rgba(238, 244, 255, 0) 0%, rgba(238, 244, 255, 0.82) 34%, rgba(232, 239, 251, 0.98) 100%);
  pointer-events: none;
}

.app-tabbar {
  position: relative;
  width: 100%;
  min-height: 68px;
  padding: 6px 12px calc(6px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: stretch;
  gap: 6px;
  border-top: 1px solid rgba(198, 210, 232, 0.92);
  background: rgba(241, 246, 255, 0.92);
  box-shadow:
    0 -1px 0 rgba(255, 255, 255, 0.82),
    0 -10px 20px rgba(148, 163, 184, 0.08);
  pointer-events: auto;
}

:global(.ui-can-blur) .app-tabbar {
  backdrop-filter: blur(18px) saturate(125%);
  -webkit-backdrop-filter: blur(18px) saturate(125%);
}

.app-tabbar__ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.16) 28%, transparent 100%);
}

.app-tabbar__item {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  min-width: 0;
  min-height: 54px;
  padding: 6px 6px 4px;
  border: 0;
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #617390;
  background: transparent;
  appearance: none;
  transition:
    color 0.2s ease,
    transform 0.16s ease,
    opacity 0.24s ease;
}

.app-tabbar__item:active {
  transform: scale(0.985);
}

.app-tabbar__item--active {
  color: #1d4ed8;
}

.app-tabbar__icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition:
    background 0.28s ease,
    box-shadow 0.28s ease,
    transform 0.28s ease;
}

.app-tabbar__icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.22s ease;
}

.app-tabbar__icon svg {
  width: 20px;
  height: 20px;
}

.app-tabbar__label {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  opacity: 0.9;
}

.app-tabbar__item--active .app-tabbar__icon {
  transform: translateY(-0.5px);
}

.app-tabbar__item:not(.app-tabbar__item--active) {
  opacity: 0.92;
}

@media (max-width: 375px) {
  .app-shell__frame {
    max-width: 100%;
  }

  .app-main {
    padding: 20px 0 88px;
  }

  .app-tabbar-wrap {
    max-width: 100%;
  }

  .app-tabbar {
    min-height: 64px;
    padding-left: 10px;
    padding-right: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-tabbar__item,
  .app-tabbar__icon-wrap,
  .app-tabbar__icon {
    transition-duration: 0.01ms !important;
  }
}
</style>
