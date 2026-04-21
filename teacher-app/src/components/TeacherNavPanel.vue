<template>
  <aside
    class="teacher-nav-panel"
    :class="{
      'teacher-nav-panel--mobile': isMobile,
      'teacher-nav-panel--flow-mode': flowModeEnabled
    }"
  >
    <div class="teacher-nav-panel__top">
      <div class="teacher-nav-brand">
        <div class="teacher-nav-brand__mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="teacher-nav-brand__text">
          <p class="teacher-nav-brand__eyebrow">Teacher Console</p>
          <h3>{{ title }}</h3>
        </div>
      </div>
    </div>

    <nav ref="menuRef" class="teacher-nav-menu" aria-label="教师端主导航">
      <div class="teacher-nav-glider" :style="activeIndicatorStyle" aria-hidden="true"></div>

      <button
        v-for="item in items"
        :key="item.route"
        :ref="(element) => setItemRef(item.route, element)"
        type="button"
        class="teacher-nav-item"
        :class="{ 'teacher-nav-item--active': item.route === activeRoute }"
        @click="$emit('navigate', item.route)"
      >
        <span class="teacher-nav-item__icon">
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
        </span>
        <span class="teacher-nav-item__label">{{ item.label }}</span>
      </button>
    </nav>

    <div class="teacher-nav-panel__bottom">
      <div class="teacher-nav-quick-setting">
        <strong class="teacher-nav-quick-setting__title">流畅模式</strong>
        <el-switch
          :model-value="flowModeEnabled"
          size="small"
          inline-prompt
          active-text="开"
          inactive-text="关"
          @update:model-value="$emit('toggle-flow-mode', $event)"
        />
      </div>

      <div class="teacher-nav-user">
        <div class="teacher-nav-user__avatar">{{ userInitial }}</div>
        <div class="teacher-nav-user__meta">
          <strong>{{ userName }}</strong>
          <span>{{ subtitle }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  activeRoute: {
    type: String,
    default: ''
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  flowModeEnabled: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '请假管理系统'
  },
  userName: {
    type: String,
    default: '教师'
  },
  subtitle: {
    type: String,
    default: '教师端'
  }
});

defineEmits(['navigate', 'toggle-flow-mode']);

const menuRef = ref(null);
const activeIndicatorStyle = ref({
  height: '0px',
  transform: 'translateY(0px)',
  opacity: 0
});

const userInitial = computed(() => props.userName?.trim()?.charAt(0) || '师');

const itemRefs = new Map();
let resizeObserver = null;
let rafId = 0;

const routeKey = computed(() => props.items.map((item) => item.route).join('|'));

function setItemRef(route, element) {
  if (element) {
    itemRefs.set(route, element);
  } else {
    itemRefs.delete(route);
  }

  scheduleIndicatorUpdate();
}

function updateIndicator() {
  const target = itemRefs.get(props.activeRoute);
  const menu = menuRef.value;

  if (!menu || !target || target.offsetHeight === 0) {
    activeIndicatorStyle.value = {
      ...activeIndicatorStyle.value,
      opacity: 0
    };
    return;
  }

  activeIndicatorStyle.value = {
    height: `${target.offsetHeight}px`,
    transform: `translateY(${target.offsetTop}px)`,
    opacity: 1
  };
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

function handleResize() {
  scheduleIndicatorUpdate();
}

function connectResizeObserver() {
  if (typeof ResizeObserver === 'undefined') {
    return;
  }

  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => {
    scheduleIndicatorUpdate();
  });

  if (menuRef.value) {
    resizeObserver.observe(menuRef.value);
  }

  itemRefs.forEach((element) => {
    if (element) {
      resizeObserver.observe(element);
    }
  });
}

watch(
  () => props.activeRoute,
  () => {
    scheduleIndicatorUpdate();
  },
  { immediate: true }
);

watch(routeKey, async () => {
  await nextTick();
  connectResizeObserver();
  scheduleIndicatorUpdate();
});

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
.teacher-nav-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
  padding: 18px;
  border-radius: 30px;
  color: #eaf2ff;
  background:
    linear-gradient(180deg, rgba(30, 58, 138, 0.92) 0%, rgba(37, 99, 235, 0.78) 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 30px 60px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

:global(.ui-can-blur) .teacher-nav-panel {
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}

.teacher-nav-panel--mobile {
  min-height: auto;
  border-radius: 24px;
}

.teacher-nav-panel__top,
.teacher-nav-panel__bottom {
  flex: 0 0 auto;
}

.teacher-nav-panel__bottom {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.teacher-nav-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 2px;
}

.teacher-nav-brand__mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f8fbff;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.teacher-nav-brand__mark svg {
  width: 24px;
  height: 24px;
}

.teacher-nav-brand__text h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.03em;
}

.teacher-nav-brand__eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(232, 242, 255, 0.7);
}

.teacher-nav-menu {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.teacher-nav-glider {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(219, 234, 254, 0.86) 100%);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  z-index: 1;
  pointer-events: none;
  transition:
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.4s ease-in-out,
    box-shadow 0.4s ease-in-out,
    opacity 0.2s ease;
}

.teacher-nav-item {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: 54px;
  border: 1px solid transparent;
  border-radius: 18px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(244, 248, 255, 0.84);
  background: transparent;
  text-align: left;
  box-shadow: none;
}

.teacher-nav-item:not(.teacher-nav-item--active):hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.teacher-nav-item--active {
  color: #13336e;
}

.teacher-nav-item__icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  transition:
    background 0.4s ease-in-out,
    color 0.3s ease-in-out;
}

.teacher-nav-item--active .teacher-nav-item__icon {
  background: rgba(59, 130, 246, 0.12);
}

.teacher-nav-item__label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: color 0.3s ease-in-out;
}

.teacher-nav-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.teacher-nav-quick-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.teacher-nav-quick-setting__title {
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.teacher-nav-quick-setting :deep(.el-switch) {
  --el-switch-on-color: rgba(255, 255, 255, 0.92);
  --el-switch-off-color: rgba(255, 255, 255, 0.28);
  flex: 0 0 auto;
}

.teacher-nav-quick-setting :deep(.el-switch__label) {
  color: #1e3a8a;
  font-weight: 700;
}

.teacher-nav-quick-setting :deep(.el-switch.is-disabled) {
  opacity: 0.68;
}

.teacher-nav-user__avatar {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
}

.teacher-nav-user__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.teacher-nav-user__meta strong {
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.teacher-nav-user__meta span {
  color: rgba(232, 242, 255, 0.74);
  font-size: 12px;
}

@media (max-width: 768px) {
  .teacher-nav-panel {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .teacher-nav-glider,
  .teacher-nav-item__icon,
  .teacher-nav-item__label {
    transition-duration: 0.01ms !important;
  }
}

.teacher-nav-panel--flow-mode .teacher-nav-glider,
.teacher-nav-panel--flow-mode .teacher-nav-item__icon,
.teacher-nav-panel--flow-mode .teacher-nav-item__label {
  transition-duration: 0.01ms !important;
}
</style>

<style>
html.ui-platform-windows .teacher-nav-menu {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html.ui-platform-windows .teacher-nav-menu::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
</style>
