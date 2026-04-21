<template>
  <div class="login-page">
    <div class="hero-section">
      <div class="logo-container">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h1 class="title">校园请假管理 Demo</h1>
      <p class="subtitle">学生端演示登录</p>
    </div>

    <div class="form-card">
      <van-form @submit="onSubmit">
        <div class="form-section">
          <label class="form-label">教室组代号</label>
          <van-field
            ref="classCodeField"
            v-model="classCode"
            name="classCode"
            placeholder="请输入教室组代号"
            :rules="[{ required: true, message: '请输入教室组代号' }]"
            class="custom-field"
            @keydown.enter.prevent="handleClassCodeEnter"
          >
            <template #left-icon>
              <svg class="field-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </van-field>

          <van-button
            type="primary"
            block
            native-type="button"
            @click="searchStudents"
            :loading="searching"
            class="search-button"
          >
            <svg v-if="!searching" class="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ searching ? '搜索中...' : '搜索学生' }}
          </van-button>
        </div>

        <div v-if="students.length > 0" class="form-section">
          <label class="form-label">选择名字</label>
          <van-field
            v-model="selectedStudentName"
            is-link
            readonly
            name="student"
            placeholder="点击选择你的名字"
            @click="openStudentModal"
            :rules="[{ required: true, message: '请选择你的名字' }]"
            class="custom-field"
          >
            <template #left-icon>
              <svg class="field-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </van-field>
        </div>

        <div v-if="needPassword" class="form-section">
          <label class="form-label">密码</label>
          <van-field
            ref="passwordField"
            v-model="password"
            type="digit"
            maxlength="6"
            name="password"
            placeholder="请输入 6 位数字密码"
            :rules="[{ required: true, message: '请输入密码' }]"
            class="custom-field"
            @keydown.enter.prevent="handlePasswordEnter"
          >
            <template #left-icon>
              <svg class="field-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </van-field>
        </div>

        <div class="form-section">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="loading"
            class="login-button"
          >
            {{ loading ? '登录中...' : '登录' }}
          </van-button>
        </div>
        <div class="form-section form-section--secondary">
          <van-button
            plain
            block
            type="default"
            native-type="button"
            class="back-home-button"
            @click="goToGuestHome"
          >
            返回主页
          </van-button>
        </div>
      </van-form>
    </div>

    <section v-if="showServerConnection" class="login-runtime">
      <ServerConnectionPanel compact />
    </section>

    <ProjectModal
      v-model="showStudentModal"
      title="选择名字"
      size="sm"
      overlay-class="student-picker-overlay"
      panel-class="student-picker-modal"
      body-class="student-picker-modal__body"
      @after-open="focusStudentSearch"
    >
      <button
        v-for="student in filteredStudents"
        :key="student.value"
        type="button"
        class="student-option"
        :class="{ 'student-option--active': student.value === selectedStudentId }"
        @click="selectStudent(student)"
      >
        <span class="student-option-name">{{ student.text }}</span>
        <span v-if="student.value === selectedStudentId" class="student-option-check">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      <div v-if="filteredStudents.length === 0" class="student-empty-state">
        <p class="student-empty-title">没有找到对应名字</p>
        <p class="student-empty-text">试试输入名字中的一个字</p>
      </div>

      <template #footer>
        <label class="student-search" for="student-search-input">
          <svg class="student-search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <input
            id="student-search-input"
            ref="studentSearchInput"
            v-model="studentKeyword"
            type="text"
            inputmode="search"
            placeholder="搜索自己的名字"
            autocomplete="off"
          />
        </label>
      </template>
    </ProjectModal>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getClassStudents, studentLogin } from '../api/student';
import ProjectModal from '../components/ProjectModal.vue';
import ServerConnectionPanel from '../components/ServerConnectionPanel.vue';
import { isNativeAndroidRuntime } from '../config/serverRuntime';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();
const showServerConnection = isNativeAndroidRuntime();

const classCode = ref('');
const students = ref([]);
const selectedStudentId = ref(null);
const selectedStudentName = ref('');
const password = ref('');
const needPassword = ref(false);
const showStudentModal = ref(false);
const studentKeyword = ref('');
const studentSearchInput = ref(null);
const classCodeField = ref(null);
const passwordField = ref(null);
const searching = ref(false);
const loading = ref(false);
const lastSearchedClassCode = ref('');
const shouldFocusStudentSearch = ref(true);

const filteredStudents = computed(() => {
  const keyword = studentKeyword.value.trim();

  if (!keyword) {
    return students.value;
  }

  return students.value.filter((student) => student.text.includes(keyword));
});

const resetSelectedStudent = () => {
  selectedStudentId.value = null;
  selectedStudentName.value = '';
};

const focusStudentSearch = async () => {
  await nextTick();
  if (!shouldFocusStudentSearch.value) {
    return;
  }
  studentSearchInput.value?.focus();
};

const blurActiveElement = () => {
  if (typeof document === 'undefined') {
    return;
  }

  document.activeElement?.blur?.();
};

const openStudentModal = ({ focusSearch = true } = {}) => {
  if (!students.value.length) {
    return;
  }

  shouldFocusStudentSearch.value = focusSearch;
  studentKeyword.value = '';
  showStudentModal.value = true;
};

const closeStudentModal = () => {
  showStudentModal.value = false;
  shouldFocusStudentSearch.value = true;
};

const selectStudent = (student) => {
  selectedStudentName.value = student.text;
  selectedStudentId.value = student.value;
  password.value = '';
  needPassword.value = false;
  closeStudentModal();
};

const searchStudents = async (options = {}) => {
  const { openModalOnSuccess = false, focusSearch = true } = options;
  const normalizedClassCode = classCode.value.trim();

  if (!normalizedClassCode) {
    showToast('请输入教室组代号');
    return;
  }

  searching.value = true;

  try {
    const res = await getClassStudents(normalizedClassCode);
    students.value = res.students.map((student) => ({
      text: student.student_name,
      value: student.id
    }));
    lastSearchedClassCode.value = normalizedClassCode;

    studentKeyword.value = '';
    showStudentModal.value = false;

    if (!students.value.some((student) => student.value === selectedStudentId.value)) {
      resetSelectedStudent();
    }

    if (students.value.length === 0) {
      showToast('该班级暂无学生');
    } else {
      showToast(`找到 ${students.value.length} 名学生`);
    }
    if (openModalOnSuccess && students.value.length > 0) {
      blurActiveElement();
      await nextTick();
      openStudentModal({ focusSearch });
    }
  } catch (error) {
    lastSearchedClassCode.value = '';
    showToast(error.response?.data?.error || '搜索失败');
  } finally {
    searching.value = false;
  }
};

const handleClassCodeEnter = async () => {
  if (searching.value || loading.value) {
    return;
  }

  const normalizedClassCode = classCode.value.trim();
  if (!normalizedClassCode) {
    showToast('\u8bf7\u8f93\u5165\u6559\u5ba4\u7ec4\u4ee3\u53f7');
    return;
  }

  if (students.value.length && normalizedClassCode === lastSearchedClassCode.value) {
    blurActiveElement();
    await nextTick();
    openStudentModal({ focusSearch: false });
    return;
  }

  await searchStudents({
    openModalOnSuccess: true,
    focusSearch: false
  });
};

const handlePasswordEnter = () => {
  if (loading.value) {
    return;
  }

  onSubmit();
};

const goToGuestHome = () => {
  router.push('/app/home');
};

const onSubmit = async () => {
  if (!selectedStudentId.value) {
    showToast('请选择你的名字');
    return;
  }

  loading.value = true;

  try {
    const loginData = {
      classCode: classCode.value,
      studentId: selectedStudentId.value
    };

    if (needPassword.value && password.value) {
      loginData.password = password.value;
    }

    const res = await studentLogin(loginData);

    if (res.needSetPassword) {
      localStorage.setItem('tempToken', res.tempToken);
      localStorage.setItem('tempStudent', JSON.stringify(res.student));
      showToast('首次登录，请设置密码');

      setTimeout(() => {
        router.push('/set-password');
      }, 500);

      return;
    }

    localStorage.removeItem('tempToken');
    localStorage.removeItem('tempStudent');
    userStore.login(res.token, res.student);
    showToast('登录成功');
    router.push('/home');
  } catch (error) {
    const errorMsg = error.response?.data?.error || '登录失败';

    if (errorMsg.includes('请输入密码') || errorMsg.includes('密码错误')) {
      needPassword.value = true;
      showToast(errorMsg);
    } else if (errorMsg.includes('登录窗口未开启')) {
      showToast('登录窗口未开启，请联系老师');
    } else if (errorMsg.includes('账号已锁定')) {
      showToast('账号已锁定，请联系老师重置');
    } else {
      showToast(errorMsg);
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 40%, #bfdbfe 100%);
  padding: 60px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -80px;
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.login-page::after {
  content: '';
  position: absolute;
  bottom: -100px;
  left: -60px;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-section {
  text-align: center;
  margin-bottom: 32px;
  animation: fadeInDown 0.6s ease-out;
  position: relative;
  z-index: 1;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-icon {
  width: 56px;
  height: 56px;
  color: #1e40af;
  filter: drop-shadow(0 4px 12px rgba(30, 64, 175, 0.25));
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #1e3a8a;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 15px;
  color: #3b82f6;
  font-weight: 500;
  margin: 0;
}

.form-card {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 24px;
  padding: 28px 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.04);
  animation: fadeInUp 0.6s ease-out;
  position: relative;
  z-index: 1;
}

.login-runtime {
  width: 100%;
  max-width: 380px;
  position: relative;
  z-index: 1;
}

.form-section {
  margin-bottom: 20px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section--secondary {
  margin-top: -6px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1e3a8a;
  margin-bottom: 8px;
  padding-left: 2px;
}

.custom-field {
  border-radius: 14px !important;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85) !important;
  border: 1px solid rgba(59, 130, 246, 0.15) !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.custom-field:focus-within {
  border-color: rgba(59, 130, 246, 0.4) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.custom-field :deep(.van-cell) {
  background: transparent;
  padding: 12px 16px;
}

.custom-field :deep(.van-cell::after) {
  display: none;
}

.custom-field :deep(.van-field__control) {
  font-size: 15px;
  color: #1e3a8a;
}

.custom-field :deep(.van-field__control::placeholder) {
  color: #94a3b8;
}

.field-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
  margin-right: 8px;
  flex-shrink: 0;
}

.search-button {
  margin-top: 12px;
  height: 46px;
  font-weight: 600;
  font-size: 15px;
  border-radius: 14px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  background: #3b82f6 !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
}

.search-button:active {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  opacity: 0.92;
}

.login-button {
  height: 50px;
  font-weight: 600;
  font-size: 16px;
  border-radius: 14px !important;
  transition: all 0.2s ease;
  background: #22c55e !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.35);
}

.login-button:active {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  opacity: 0.92;
}

.back-home-button {
  height: 44px;
  border-radius: 14px !important;
  border-color: rgba(148, 163, 184, 0.34) !important;
  background: rgba(255, 255, 255, 0.72) !important;
  color: #41618f !important;
  font-size: 14px;
  font-weight: 600;
}

.button-icon {
  width: 18px;
  height: 18px;
  color: #fff;
}

.student-option {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
  color: #12316f;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.42) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 10px 22px rgba(148, 163, 184, 0.09);
  appearance: none;
}

.student-option:active {
  transform: scale(0.988);
}

.student-option-name {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.student-option-check {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
  flex-shrink: 0;
}

.student-option-check svg {
  width: 16px;
  height: 16px;
}

.student-option--active {
  border-color: rgba(59, 130, 246, 0.3);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(219, 234, 254, 0.55) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 14px 28px rgba(59, 130, 246, 0.16);
}

.student-empty-state {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #55719c;
  padding: 12px 20px 28px;
}

.student-empty-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #183b82;
}

.student-empty-text {
  margin: 0;
  font-size: 14px;
}

.student-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 0 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(148, 163, 184, 0.08);
}

.student-search-icon {
  width: 18px;
  height: 18px;
  color: #4f75b8;
  flex-shrink: 0;
}

.student-search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 15px;
  color: #16377b;
  outline: none;
  width: auto;
}

.student-search input::placeholder {
  color: #86a0c8;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 375px) {
  .login-page {
    padding: 40px 16px 32px;
  }

  .form-card {
    padding: 24px 20px;
  }

  .title {
    font-size: 24px;
  }

  .student-option {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-section,
  .form-card {
    animation: none;
  }
}
</style>

<style>
.student-picker-overlay {
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0%, rgba(191, 219, 254, 0.14) 22%, rgba(15, 23, 42, 0.3) 68%),
    rgba(224, 242, 254, 0.16);
}

.ui-can-blur .student-picker-overlay {
  backdrop-filter: blur(22px) saturate(135%);
  -webkit-backdrop-filter: blur(22px) saturate(135%);
}

.student-picker-overlay .project-modal-shell {
  width: 100%;
  max-width: 430px;
}

.student-picker-overlay .project-modal-bloom {
  width: 62%;
  height: auto;
  aspect-ratio: 1;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.86) 0%, rgba(191, 219, 254, 0.55) 38%, rgba(96, 165, 250, 0.18) 62%, transparent 82%);
  filter: blur(38px);
  transform: scale(0.8);
  opacity: 0.92;
}

.student-picker-modal {
  max-height: min(78vh, 620px);
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.56) 100%);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    0 35px 80px rgba(15, 23, 42, 0.16),
    0 20px 44px rgba(59, 130, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.ui-can-blur .student-picker-modal {
  backdrop-filter: blur(30px) saturate(145%);
  -webkit-backdrop-filter: blur(30px) saturate(145%);
}

.student-picker-modal .project-modal-header {
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 12px;
}

.student-picker-modal .project-modal-title {
  flex: 1 1 auto;
}

.student-picker-modal .project-modal-close {
  border: none;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.ui-can-blur .student-picker-modal .project-modal-close {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.student-picker-modal .project-modal-title {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: #102a74;
}

.student-picker-modal__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 14px 16px;
}

.student-picker-modal .project-modal-footer {
  padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.58);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.34) 100%);
}

@media (max-width: 375px) {
  .student-picker-overlay {
    padding: 18px;
  }

  .student-picker-modal {
    max-height: min(82vh, 620px);
    border-radius: 28px;
  }
}
</style>

