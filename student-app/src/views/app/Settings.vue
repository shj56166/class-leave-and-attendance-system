<template>
  <div class="settings-page">
    <section class="settings-page__hero">
      <p class="settings-page__eyebrow">学生端设置</p>
      <h1 class="settings-page__title">设置</h1>
      <p class="settings-page__meta">账号信息、安装方式和安全入口都在这里统一查看。</p>
    </section>

    <section class="settings-profile">
      <div class="settings-profile__top">
        <div class="settings-profile__avatar" aria-hidden="true">
          <span>{{ profileInitial }}</span>
        </div>
        <div class="settings-profile__summary">
          <p class="settings-profile__eyebrow">当前账号</p>
          <h2 class="settings-profile__name">{{ displayName }}</h2>
          <p class="settings-profile__class">{{ displayClassName }}</p>
        </div>
        <span class="settings-profile__role" :class="roleToneClass">{{ roleText }}</span>
      </div>

      <div class="settings-profile__meta">
        <div class="settings-profile__meta-item">
          <span class="settings-profile__meta-label">身份</span>
          <strong class="settings-profile__meta-value">{{ roleText }}</strong>
        </div>
        <div class="settings-profile__meta-item">
          <span class="settings-profile__meta-label">说明</span>
          <strong class="settings-profile__meta-value">{{ roleDescription }}</strong>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <p class="settings-section__title">安装与连接</p>
      <div class="settings-install">
        <div class="settings-install__item">
          <span class="settings-install__label">当前打开方式</span>
          <strong class="settings-install__value">{{ platformModeText }}</strong>
        </div>
        <div class="settings-install__item">
          <span class="settings-install__label">主屏状态</span>
          <strong class="settings-install__value">{{ installStatusText }}</strong>
        </div>
      </div>

      <ServerConnectionPanel v-if="isAndroidRuntime" compact />
    </section>

    <section class="settings-section">
      <p class="settings-section__title">账户与安全</p>
      <div class="settings-group">
        <button type="button" class="settings-row" @click="router.push('/change-password')">
          <span class="settings-row__icon settings-row__icon--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.9" />
              <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
            </svg>
          </span>

          <span class="settings-row__body">
            <span class="settings-row__title">密码管理</span>
            <span class="settings-row__description">修改当前登录密码与账户安全信息</span>
          </span>

          <span class="settings-row__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </section>

    <section class="settings-section">
      <p class="settings-section__title">当前会话</p>
      <div class="settings-group">
        <button type="button" class="settings-row settings-row--danger" @click="handleLogout">
          <span class="settings-row__icon settings-row__icon--red" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M21 12H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>

          <span class="settings-row__body">
            <span class="settings-row__title">退出登录</span>
            <span class="settings-row__description">{{ '\u9000\u51fa\u540e\u56de\u5230\u4e3b\u9875\uff0c\u4ee5\u6e38\u5ba2\u6a21\u5f0f\u6d4f\u89c8' }}</span>
          </span>

          <span class="settings-row__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </section>

    <ProjectConfirmModal
      v-model="logoutConfirmVisible"
      title="确认退出"
      message="确定要退出当前学生账户吗？"
      :details="['退出后需要重新登录才能继续进入学生端。']"
      confirm-text="退出登录"
      type="warning"
      @confirm="confirmLogout"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ProjectConfirmModal from '../../components/ProjectConfirmModal.vue';
import ServerConnectionPanel from '../../components/ServerConnectionPanel.vue';
import { isNativeAndroidRuntime } from '../../config/serverRuntime';
import { useUserStore } from '../../stores/user';

const router = useRouter();
const userStore = useUserStore();
const logoutConfirmVisible = ref(false);
const isAndroidRuntime = isNativeAndroidRuntime();

const displayName = computed(() => userStore.user?.name || '当前学生');
const displayClassName = computed(() => userStore.user?.className || '未同步班级信息');
const isCadre = computed(() => userStore.user?.role === 'cadre');
const roleText = computed(() => (isCadre.value ? '班干' : '学生'));
const roleToneClass = computed(() => (isCadre.value ? 'settings-profile__role--cadre' : 'settings-profile__role--student'));
const roleDescription = computed(() => (isCadre.value ? '可使用班级管理功能' : '可使用学生端常规功能'));
const profileInitial = computed(() => String(displayName.value || '学').trim().slice(0, 1));

const platformModeText = computed(() => (isAndroidRuntime ? 'Android App' : 'Web / iOS PWA'));
const installStatusText = computed(() => {
  if (typeof window === 'undefined') {
    return '浏览器打开';
  }

  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true;

  return standalone ? '已从主屏或桌面打开' : '浏览器打开';
});

const handleLogout = async () => {
  logoutConfirmVisible.value = true;
};

const confirmLogout = () => {
  logoutConfirmVisible.value = false;
  userStore.logout();
  router.push('/app/home');
};
</script>

<style scoped>
.settings-page {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  padding: clamp(18px, calc(12px + env(safe-area-inset-top, 0px)), 34px) 14px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-page__hero {
  padding: 4px 2px 0;
}

.settings-page__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #6b80a5;
}

.settings-page__title {
  margin: 8px 0 0;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(25px, 7.8vw, 30px);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #142b63;
}

.settings-page__meta {
  margin: 10px 0 0;
  max-width: 34ch;
  font-size: 13px;
  line-height: 1.55;
  color: #617392;
}

.settings-profile {
  border-radius: 28px;
  padding: 18px;
  background:
    radial-gradient(circle at top right, rgba(191, 219, 254, 0.9) 0%, rgba(191, 219, 254, 0) 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(243, 248, 255, 0.9) 100%);
  border: 1px solid rgba(220, 230, 244, 0.96);
  box-shadow:
    0 16px 34px rgba(148, 163, 184, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.settings-profile__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.settings-profile__avatar {
  width: 56px;
  height: 56px;
  flex: 0 0 auto;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1d4ed8;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(224, 236, 255, 0.84) 100%);
  border: 1px solid rgba(214, 225, 242, 0.96);
  box-shadow: 0 10px 22px rgba(59, 130, 246, 0.12);
}

.settings-profile__avatar span {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.settings-profile__summary {
  min-width: 0;
  flex: 1 1 auto;
}

.settings-profile__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #6b80a5;
}

.settings-profile__name {
  margin: 6px 0 0;
  overflow: hidden;
  font-size: clamp(24px, 6.8vw, 28px);
  font-weight: 780;
  line-height: 1.08;
  letter-spacing: -0.045em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #15316e;
}

.settings-profile__class {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #5f769d;
}

.settings-profile__role {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  border: 1px solid rgba(255, 255, 255, 0.72);
}

.settings-profile__role--student {
  color: #2563eb;
  background: rgba(239, 246, 255, 0.9);
}

.settings-profile__role--cadre {
  color: #c26a0b;
  background: rgba(255, 246, 224, 0.94);
}

.settings-profile__meta {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed rgba(186, 201, 226, 0.78);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.settings-profile__meta-item {
  min-width: 0;
  padding: 12px 13px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(224, 233, 247, 0.92);
}

.settings-profile__meta-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #7a91b8;
}

.settings-profile__meta-value {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  color: #15316e;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-install {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.settings-install__item {
  min-width: 0;
  padding: 14px 15px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(244, 248, 255, 0.9) 100%);
  border: 1px solid rgba(221, 231, 245, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
}

.settings-install__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #7a91b8;
}

.settings-install__value {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #15316e;
}

.settings-section__title {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6a7fa7;
}

.settings-group {
  border-radius: 24px;
  overflow: hidden;
  background: rgba(248, 251, 255, 0.92);
  border: 1px solid rgba(220, 230, 244, 0.96);
  box-shadow: 0 8px 22px rgba(148, 163, 184, 0.08);
}

.settings-row {
  width: 100%;
  min-height: 80px;
  border: 0;
  border-radius: 0;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: transparent;
  appearance: none;
  transition:
    transform 0.18s ease,
    background-color 0.24s ease;
}

.settings-row + .settings-row {
  border-top: 1px solid rgba(226, 233, 246, 0.92);
}

.settings-row:active {
  transform: scale(0.987);
  background: rgba(240, 246, 255, 0.88);
}

.settings-row--danger {
  background: rgba(255, 245, 245, 0.58);
}

.settings-row--danger:active {
  background: rgba(255, 238, 238, 0.92);
}

.settings-row__icon {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.settings-row__icon svg {
  width: 20px;
  height: 20px;
}

.settings-row__icon--blue {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.16);
}

.settings-row__icon--red {
  background: #ef4444;
  box-shadow: 0 8px 16px rgba(239, 68, 68, 0.14);
}

.settings-row__body {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-row__title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #15316e;
}

.settings-row--danger .settings-row__title {
  color: #a11d2f;
}

.settings-row__description {
  font-size: 12px;
  line-height: 1.5;
  color: #65799f;
}

.settings-row__arrow {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7a93bd;
}

.settings-row__arrow svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 375px) {
  .settings-page {
    padding: clamp(16px, calc(10px + env(safe-area-inset-top, 0px)), 28px) 12px 0;
    gap: 18px;
  }

  .settings-profile {
    padding: 16px;
    border-radius: 24px;
  }

  .settings-profile__top {
    gap: 12px;
  }

  .settings-profile__meta {
    grid-template-columns: 1fr;
  }

  .settings-install {
    grid-template-columns: 1fr;
  }

  .settings-row {
    min-height: 76px;
    padding: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-row {
    transition-duration: 0.01ms !important;
  }
}
</style>
