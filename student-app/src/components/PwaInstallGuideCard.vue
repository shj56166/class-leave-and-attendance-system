<template>
  <section v-if="visible" class="install-guide">
    <div class="install-guide__header">
      <div>
        <p class="install-guide__eyebrow">iPhone 安装</p>
        <h3 class="install-guide__title">添加到主屏后会像 App 一样打开</h3>
      </div>

      <button type="button" class="install-guide__close" aria-label="关闭" @click="dismiss">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <p class="install-guide__text">
      请用 Safari 打开当前页面，点击底部或顶部的分享按钮，再选择“添加到主屏幕”。
    </p>

    <div class="install-guide__steps">
      <span>1. Safari 打开</span>
      <span>2. 点分享</span>
      <span>3. 添加到主屏</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { safeGetItem, safeSetItem } from '../utils/storage';

const DISMISS_KEY = 'student-pwa-install-guide-dismissed-v1';

const shouldShow = ref(false);

const visible = computed(() => shouldShow.value);

function isIosSafari() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
  return isAppleMobile && isSafari;
}

function isStandaloneMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true;
}

function dismiss() {
  shouldShow.value = false;
  safeSetItem(DISMISS_KEY, '1');
}

onMounted(() => {
  const dismissed = safeGetItem(DISMISS_KEY) === '1';
  shouldShow.value = isIosSafari() && !isStandaloneMode() && !dismissed;
});
</script>

<style scoped>
.install-guide {
  padding: 18px;
  border-radius: 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.22) 0%, rgba(96, 165, 250, 0) 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 246, 255, 0.94) 100%);
  border: 1px solid rgba(217, 228, 244, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 18px 34px rgba(148, 163, 184, 0.1);
}

.install-guide__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.install-guide__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #7890b6;
}

.install-guide__title {
  margin: 6px 0 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 780;
  color: #15316e;
}

.install-guide__close {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(214, 224, 241, 0.92);
  color: #5670a2;
  background: rgba(255, 255, 255, 0.82);
}

.install-guide__close svg {
  width: 16px;
  height: 16px;
}

.install-guide__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: #5f769d;
}

.install-guide__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.install-guide__steps span {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #1f4fb8;
  background: rgba(239, 246, 255, 0.96);
  border: 1px solid rgba(191, 219, 254, 0.88);
}
</style>
