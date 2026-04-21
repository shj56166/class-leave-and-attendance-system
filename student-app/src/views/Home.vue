<template>
  <div class="home-page">
    <div class="welcome-card">
      <div class="welcome-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" />
        </svg>
      </div>
      <h2 class="welcome-title">欢迎，{{ userStore.user?.name }}</h2>
      <p class="welcome-class">{{ userStore.user?.className }}</p>
    </div>

    <div class="nav-grid">
      <div class="nav-item" @click="$router.push('/apply')">
        <div class="nav-icon nav-icon-blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path
              d="M17.5 2.5C17.8978 2.10217 18.4374 1.87868 19 1.87868C19.5626 1.87868 20.1022 2.10217 20.5 2.5C20.8978 2.89782 21.1213 3.43739 21.1213 4C21.1213 4.56261 20.8978 5.10217 20.5 5.5L12 14L8 15L9 11L17.5 2.5Z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="nav-text">请假申请</span>
      </div>
      <div class="nav-item" @click="$router.push('/leaves')">
        <div class="nav-icon nav-icon-green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <polyline points="16,13 12,17 8,13" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
            <line x1="12" y1="17" x2="12" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <span class="nav-text">请假记录</span>
      </div>
      <div class="nav-item" @click="$router.push('/schedule')">
        <div class="nav-icon nav-icon-amber">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <span class="nav-text">我的课表</span>
      </div>
      <div class="nav-item" @click="goToPassword">
        <div class="nav-icon nav-icon-purple">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" />
            <path
              d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <span class="nav-text">密码管理</span>
      </div>
      <div class="nav-item nav-item-logout" @click="logout">
        <div class="nav-icon nav-icon-red">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <polyline points="16,17 21,12 16,7" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <span class="nav-text">退出登录</span>
      </div>
    </div>

    <van-action-sheet v-model:show="showPasswordSheet" :actions="passwordActions" cancel-text="取消"
      @select="onPasswordSelect" />

    <ProjectConfirmModal
      v-model="logoutConfirmVisible"
      title="确认退出"
      message="确定要退出登录吗？"
      :details="['退出后需要重新登录才能继续进入学生端。']"
      confirm-text="退出登录"
      type="warning"
      @confirm="confirmLogout"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import ProjectConfirmModal from '../components/ProjectConfirmModal.vue';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

const showPasswordSheet = ref(false);
const logoutConfirmVisible = ref(false);
const passwordActions = [
  { name: '设置密码', value: 'set' },
  { name: '修改密码', value: 'change' }
];

const goToPassword = () => {
  showPasswordSheet.value = true;
};

const onPasswordSelect = (action) => {
  showPasswordSheet.value = false;
  if (action.value === 'set') {
    router.push('/set-password');
  } else if (action.value === 'change') {
    router.push('/change-password');
  }
};

const logout = () => {
  logoutConfirmVisible.value = true;
};

const confirmLogout = () => {
  logoutConfirmVisible.value = false;
  userStore.logout();
  router.push('/app/home');
};
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 40%, #BFDBFE 100%);
  padding: 40px 20px 32px;
  position: relative;
  overflow: hidden;
}

.home-page::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -60px;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.welcome-card {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12);
  border-radius: 24px;
  padding: 28px 24px;
  text-align: center;
  margin-bottom: 28px;
  position: relative;
  z-index: 1;
  animation: fadeIn 0.5s ease-out;
}

.welcome-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3B82F6;
}

.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: #1E3A8A;
  margin: 0 0 4px 0;
}

.welcome-class {
  font-size: 14px;
  color: #3B82F6;
  margin: 0;
  font-weight: 500;
}

.nav-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  position: relative;
  z-index: 1;
}

.nav-item {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 16px rgba(31, 38, 135, 0.08);
  border-radius: 20px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: fadeIn 0.5s ease-out both;
}

.nav-item:nth-child(1) {
  animation-delay: 0.05s;
}

.nav-item:nth-child(2) {
  animation-delay: 0.1s;
}

.nav-item:nth-child(3) {
  animation-delay: 0.15s;
}

.nav-item:nth-child(4) {
  animation-delay: 0.2s;
}

.nav-item:nth-child(5) {
  animation-delay: 0.25s;
}

.nav-item:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.1);
}

.nav-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 10px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon-blue {
  background: rgba(59, 130, 246, 0.12);
  color: #3B82F6;
}

.nav-icon-green {
  background: rgba(34, 197, 94, 0.12);
  color: #22C55E;
}

.nav-icon-amber {
  background: rgba(245, 158, 11, 0.12);
  color: #F59E0B;
}

.nav-icon-purple {
  background: rgba(139, 92, 246, 0.12);
  color: #8B5CF6;
}

.nav-icon-red {
  background: rgba(239, 68, 68, 0.12);
  color: #EF4444;
}

.nav-text {
  font-size: 14px;
  font-weight: 600;
  color: #1E3A8A;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-card,
  .nav-item {
    animation: none;
  }
}
</style>
