<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>校园请假管理 Demo</h2>
          <p>教师端演示登录</p>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input
            ref="usernameInputRef"
            v-model="form.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            size="large"
            @keydown.enter.prevent="handleUsernameEnter"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            ref="passwordInputRef"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keydown.enter.prevent="handlePasswordEnter"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            class="teacher-action-button teacher-action-button--primary"
            type="primary"
            size="large"
            style="width: 100%"
            :loading="loading"
            @click="onSubmit"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-server-panel">
        <ServerConnectionPanel compact />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { teacherLogin } from '../api/teacher';
import ServerConnectionPanel from '../components/ServerConnectionPanel.vue';
import { resolveTeacherStartupRoute } from '../services/teacherNotificationRuntime';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const formRef = ref(null);
const usernameInputRef = ref(null);
const passwordInputRef = ref(null);
const loading = ref(false);

const focusPasswordInput = () => {
  passwordInputRef.value?.focus?.();
};

const handleUsernameEnter = () => {
  if (loading.value) {
    return;
  }

  focusPasswordInput();
};

const handlePasswordEnter = () => {
  if (loading.value) {
    return;
  }

  onSubmit();
};

const onSubmit = async () => {
  if (!formRef.value || loading.value) {
    return;
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      if (!form.value.username.trim()) {
        usernameInputRef.value?.focus?.();
      } else if (!form.value.password.trim()) {
        focusPasswordInput();
      }
      return;
    }

    loading.value = true;
    try {
      const res = await teacherLogin(form.value);
      authStore.login(res.token, res.teacher);
      ElMessage.success('登录成功');
      const targetRoute = await resolveTeacherStartupRoute();
      router.replace(targetRoute);
    } catch (error) {
      // Error message is handled in the request interceptor.
    } finally {
      loading.value = false;
    }
  });
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 40%, #bfdbfe 100%);
  position: relative;
  overflow: hidden;
  padding: 24px 14px;
}

.login-container::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -80px;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.login-container::after {
  content: '';
  position: absolute;
  bottom: -100px;
  left: -60px;
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.login-card {
  width: 460px;
  max-width: 94vw;
  position: relative;
  z-index: 1;
}

.login-server-panel {
  margin-top: 10px;
}

:deep(.el-card) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important;
  border-radius: 24px !important;
}

:deep(.el-card__header) {
  border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important;
  padding: 28px 28px 20px !important;
}

:deep(.el-card__body) {
  padding: 24px 28px 28px !important;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 6px 0;
  color: #1e3a8a;
  font-size: 24px;
  font-weight: 700;
}

.card-header p {
  margin: 0;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.85) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15) !important;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3) !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3) !important;
}

:deep(.el-input__inner) {
  color: #1e3a8a;
}

:deep(.el-input__prefix .el-icon) {
  color: #3b82f6;
}

</style>
