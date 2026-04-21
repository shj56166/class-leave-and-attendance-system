<template>
  <div class="change-password-page">
    <van-nav-bar
      title="修改密码"
      left-arrow
      @click-left="onBack"
    />

    <div class="content">
      <van-form @submit="onSubmit">
        <van-cell-group inset>
          <van-field
            v-model="oldPassword"
            type="digit"
            maxlength="6"
            name="oldPassword"
            label="旧密码"
            placeholder="请输入旧密码"
            :rules="[{ required: true, message: '请输入旧密码' }]"
          />
          <van-field
            v-model="newPassword"
            type="digit"
            maxlength="6"
            name="newPassword"
            label="新密码"
            placeholder="请输入6位数字密码"
            :rules="[
              { required: true, message: '请输入新密码' },
              { pattern: /^\d{6}$/, message: '密码必须是6位数字' }
            ]"
          />
          <van-field
            v-model="confirmPassword"
            type="digit"
            maxlength="6"
            name="confirmPassword"
            label="确认密码"
            placeholder="请再次输入新密码"
            :rules="[
              { required: true, message: '请再次输入新密码' },
              { validator: validateConfirm, message: '两次密码不一致' }
            ]"
          />
        </van-cell-group>

        <div style="margin: 16px;">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            确认修改
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { changePassword } from '../api/student';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const validateConfirm = () => {
  return newPassword.value === confirmPassword.value;
};

const onSubmit = async () => {
  if (newPassword.value !== confirmPassword.value) {
    showToast('两次密码输入不一致');
    return;
  }

  loading.value = true;
  try {
    const response = await changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    });
    if (response?.token) {
      userStore.setToken(response.token);
    }
    showToast('密码修改成功');
    router.push('/home');
  } catch (error) {
    showToast(error.response?.data?.error || '修改失败');
  } finally {
    loading.value = false;
  }
};

const onBack = () => {
  router.back();
};
</script>

<style scoped>
.change-password-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 40%, #BFDBFE 100%);
}

:deep(.van-nav-bar) {
  background: rgba(255,255,255,0.6) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

:deep(.van-nav-bar__title) {
  color: #1E3A8A !important;
  font-weight: 600;
}

:deep(.van-nav-bar .van-icon) {
  color: #3B82F6 !important;
}

.content {
  padding: 24px 16px 20px;
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

:deep(.van-button--primary) {
  background: #22C55E !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(34,197,94,0.35);
}
</style>
