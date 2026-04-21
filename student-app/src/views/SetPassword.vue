<template>
  <div class="set-password-page">
    <div class="header">
      <h1>设置密码</h1>
      <p>首次登录，请设置6位数字密码</p>
    </div>

    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field
          v-model="password"
          type="digit"
          maxlength="6"
          name="password"
          label="设置密码"
          placeholder="请输入6位数字密码"
          :rules="[
            { required: true, message: '请输入密码' },
            { pattern: /^\d{6}$/, message: '密码必须是6位数字' }
          ]"
        />
        <van-field
          v-model="confirmPassword"
          type="digit"
          maxlength="6"
          name="confirmPassword"
          label="确认密码"
          placeholder="请再次输入密码"
          :rules="[
            { required: true, message: '请再次输入密码' },
            { validator: validateConfirm, message: '两次密码不一致' }
          ]"
        />
      </van-cell-group>

      <div class="tips">
        <p>密码用于其他设备登录</p>
        <p>请牢记您的密码</p>
      </div>

      <div style="margin: 16px;">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          确认设置
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { setPassword } from '../api/student';
import { useUserStore } from '../stores/user';
import { safeGetItem, safeReadJson, safeRemoveItem } from '../utils/storage';

const router = useRouter();
const userStore = useUserStore();

const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const validateConfirm = (val) => {
  return val === password.value;
};

const onSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    showToast('两次密码不一致');
    return;
  }

  if (!/^\d{6}$/.test(password.value)) {
    showToast('密码必须是6位数字');
    return;
  }

  const tempToken = safeGetItem('tempToken');
  if (!tempToken) {
    showToast('临时令牌已失效，请重新登录');
    router.push('/login');
    return;
  }

  loading.value = true;
  try {
    const res = await setPassword({
      password: password.value,
      confirmPassword: confirmPassword.value
    });

    const tempStudent = safeReadJson('tempStudent');
    const mergedStudent = {
      ...(tempStudent || {}),
      ...(res.student || {})
    };

    // 清除临时数据
    safeRemoveItem('tempToken');
    safeRemoveItem('tempStudent');

    // 保存正式token和用户信息
    userStore.login(res.token, mergedStudent);
    showToast('密码设置成功');
    router.push('/home');
  } catch (error) {
    showToast(error.response?.data?.error || '设置失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.set-password-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 40%, #BFDBFE 100%);
  padding: 60px 20px 20px;
  position: relative;
  overflow: hidden;
}

.set-password-page::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -60px;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.header {
  text-align: center;
  color: #1E3A8A;
  margin-bottom: 32px;
  position: relative;
  z-index: 1;
}

.header h1 {
  font-size: 28px;
  margin: 0 0 8px 0;
  color: #1E3A8A;
}

.header p {
  font-size: 15px;
  color: #3B82F6;
  margin: 0;
  font-weight: 500;
}

:deep(.van-cell-group--inset) {
  margin: 0 0 16px 0;
  border-radius: 20px !important;
  overflow: hidden;
  background: rgba(255,255,255,0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.6);
  box-shadow: 0 8px 32px rgba(31,38,135,0.12);
}

:deep(.van-cell) {
  background: transparent;
}

:deep(.van-cell::after) {
  border-color: rgba(59,130,246,0.1);
}

:deep(.van-field__label) {
  color: #1E3A8A;
  font-weight: 600;
}

:deep(.van-field__control) {
  color: #1E3A8A;
}

.tips {
  margin: 0 0 16px 0;
  padding: 16px;
  background: rgba(255,255,255,0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 16px;
  text-align: center;
}

.tips p {
  margin: 4px 0;
  font-size: 13px;
  color: #3B82F6;
}

:deep(.van-button--primary) {
  background: #22C55E !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(34,197,94,0.35);
}
</style>
