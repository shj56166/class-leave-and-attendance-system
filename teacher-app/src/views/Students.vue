<template>
  <div class="students-page">
    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <span>登录窗口控制</span>
        </div>
      </template>

      <div class="login-window-control">
        <el-switch
          v-model="loginWindowOpen"
          :loading="switchLoading"
          active-text="已开启"
          inactive-text="已关闭"
          @change="handleToggleLoginWindow"
        />
        <p class="hint">开启后学生可以登录，关闭后学生无法登录。</p>
      </div>
    </el-card>

    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <span>学生管理</span>
          <div class="header-actions">
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="showAddDialog">添加学生</el-button>
            <el-button class="teacher-action-button teacher-action-button--success" type="success">批量导入</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="student_name" label="学生姓名" min-width="120" />
        <el-table-column label="宿舍" min-width="140">
          <template #default="{ row }">
            {{ row.dormitoryName || '未分配宿舍' }}
          </template>
        </el-table-column>
        <el-table-column label="认证状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_authenticated" type="success">已认证</el-tag>
            <el-tag v-else type="info">未认证</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.role === 'cadre'" type="warning">班干</el-tag>
            <el-tag v-else type="info">学生</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="锁定状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_locked" type="danger">已锁定</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="登录设备" width="100">
          <template #default="{ row }">
            {{ row.deviceCount || 0 }} 台
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
          <template #default="{ row }">
            {{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button type="primary" link @click="showEditDialog(row)">编辑</el-button>
            <el-button type="info" link @click="showLoginLogs(row)">登录记录</el-button>
            <el-button type="warning" link @click="handleReset(row)">重置为新用户</el-button>
            <el-button type="danger" link @click="handleDelete(row)">归档</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <div>
            <span>宿舍管理</span>
            <p class="subtle-copy">按宿舍维护学生归属，统计页会按这里的分组展示请假和回家情况。</p>
          </div>
          <div class="header-actions">
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="openDormitoryModal()">新建宿舍</el-button>
          </div>
        </div>
      </template>

      <div v-if="dormitories.length" class="dormitory-grid">
        <article v-for="dormitory in dormitories" :key="dormitory.id" class="dormitory-card">
          <div class="dormitory-card__head">
            <div>
              <h3>{{ dormitory.name }}</h3>
              <p>{{ dormitory.studentCount }} 人</p>
            </div>
            <div class="dormitory-card__actions">
              <el-button type="primary" link @click="openDormitoryModal(dormitory, 'edit')">编辑</el-button>
              <el-button type="success" link @click="openDormitoryModal(dormitory, 'assign')">分配学生</el-button>
              <el-button type="danger" link @click="handleDormitoryDelete(dormitory)">删除</el-button>
            </div>
          </div>

          <div class="dormitory-card__members">
            <span v-if="dormitory.students.length">
              {{ dormitory.students.map((student) => student.studentName).join('、') }}
            </span>
            <span v-else>当前还没有分配学生</span>
          </div>
        </article>
      </div>
      <el-empty v-else description="还没有创建宿舍组" />
    </el-card>

    <ProjectDialog v-model="showLogsDialog" title="登录记录" width="900px" size="xl">
      <div v-if="currentStudent" class="student-info">
        <p><strong>学生：</strong>{{ currentStudent.student_name }}</p>
        <p>
          <strong>认证状态：</strong>
          <el-tag v-if="currentStudent.is_authenticated" type="success">已认证</el-tag>
          <el-tag v-else type="info">未认证</el-tag>
        </p>
        <p><strong>当前 JWT 版本：</strong>{{ currentStudent.jwt_version }}</p>
      </div>

      <el-table :data="loginLogs" v-loading="logsLoading" stripe style="margin-top: 20px;">
        <el-table-column prop="deviceInfo" label="设备信息" width="300" />
        <el-table-column prop="ipAddress" label="IP 地址" width="150" />
        <el-table-column label="登录时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.loginAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.isCurrentVersion" type="success">当前有效</el-tag>
            <el-tag v-else type="info">已失效</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="logsTotalCount > 20"
        :current-page="logsPage"
        :page-size="20"
        :total="logsTotalCount"
        layout="total, prev, pager, next"
        style="margin-top: 20px; text-align: center;"
        @current-change="handleLogsPageChange"
      />
    </ProjectDialog>

    <ProjectDialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="学生姓名" prop="studentName">
          <el-input v-model="form.studentName" placeholder="请输入学生姓名" />
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="form.role">
            <el-radio label="student">普通学生</el-radio>
            <el-radio label="cadre">班干</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="dialogVisible = false">取消</el-button>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
        </div>
      </template>
    </ProjectDialog>

    <ProjectDialog
      v-model="dormitoryModalVisible"
      :title="dormitoryModalTitle"
      width="620px"
      size="xl"
      overlay-class="dorm-picker-overlay"
      panel-class="dorm-picker-modal"
      body-class="dorm-picker-modal__body"
      @after-open="focusDormitorySearch"
    >
      <div class="dormitory-modal-form">
        <label class="dormitory-form__label" for="dormitory-name-input">宿舍名称</label>
        <el-input
          id="dormitory-name-input"
          v-model="dormitoryForm.name"
          maxlength="50"
          placeholder="例如 A101 / 女生 202"
        />
      </div>

      <button
        v-for="student in filteredAssignableStudents"
        :key="student.id"
        type="button"
        class="student-option"
        :class="{ 'student-option--active': dormitoryForm.selectedStudentIds.includes(student.id) }"
        @click="toggleDormStudent(student.id)"
      >
        <div class="student-option__body">
          <span class="student-option-name">{{ student.student_name }}</span>
          <span
            class="student-option-current"
            :class="{ 'student-option-current--empty': !student.dormitoryName }"
          >
            {{ student.dormitoryName ? `当前宿舍 ${student.dormitoryName}` : '未分配宿舍' }}
          </span>
        </div>
        <span v-if="dormitoryForm.selectedStudentIds.includes(student.id)" class="student-option-check">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      <div v-if="filteredAssignableStudents.length === 0" class="student-empty-state">
        <p class="student-empty-title">没有找到对应学生</p>
        <p class="student-empty-text">试试输入姓名中的一个字</p>
      </div>

      <template #footer>
        <div class="dorm-picker-footer">
          <label class="student-search" for="dorm-student-search-input">
            <svg class="student-search-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input
              id="dorm-student-search-input"
              ref="assignSearchInput"
              v-model="assignKeyword"
              type="text"
              inputmode="search"
              placeholder="搜索要分配的学生"
              autocomplete="off"
            />
          </label>

          <div class="dorm-picker-footer__actions">
            <span class="dorm-picker-footer__count">已选 {{ dormitoryForm.selectedStudentIds.length }} 人</span>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="dormitorySubmitting" @click="saveDormitoryModal">
              {{ dormitoryModalSubmitText }}
            </el-button>
          </div>
        </div>
      </template>
    </ProjectDialog>

    <ProjectConfirmDialog
      v-model="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :details="confirmDialog.details"
      :confirm-text="confirmDialog.confirmText"
      :confirm-type="confirmDialog.confirmType"
      :type="confirmDialog.confirmType === 'danger' ? 'danger' : 'warning'"
      :loading="confirmLoading"
      @cancel="closeConfirmDialog"
      @confirm="confirmCurrentAction"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import ProjectConfirmDialog from '../components/ProjectConfirmDialog.vue';
import ProjectDialog from '../components/ProjectDialog.vue';
import {
  addStudent,
  assignDormitoryStudents,
  createDormitory,
  deleteDormitory,
  deleteStudent,
  getDormitories,
  getLoginWindowStatus,
  getStudentLoginLogs,
  getStudentsEnhanced,
  resetStudent,
  toggleLoginWindow,
  updateDormitory,
  updateStudent
} from '../api/teacher';

const tableData = ref([]);
const dormitories = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const isEdit = ref(false);
const submitting = ref(false);
const currentStudent = ref(null);
const formRef = ref(null);

const loginWindowOpen = ref(true);
const switchLoading = ref(false);

const showLogsDialog = ref(false);
const loginLogs = ref([]);
const logsLoading = ref(false);
const logsPage = ref(1);
const logsTotalCount = ref(0);

const dormitoryModalVisible = ref(false);
const dormitoryModalMode = ref('create');
const dormitorySubmitting = ref(false);
const currentDormitory = ref(null);
const dormitoryForm = ref({
  name: '',
  selectedStudentIds: []
});

const assignKeyword = ref('');
const assignSearchInput = ref(null);

const confirmLoading = ref(false);
const confirmAction = ref('');
const confirmTarget = ref(null);
const confirmDialog = ref({
  visible: false,
  title: '',
  message: '',
  details: [],
  confirmText: '确定',
  confirmType: 'warning'
});

const form = ref({
  studentName: '',
  status: 'active',
  role: 'student'
});

const rules = {
  studentName: [{ required: true, message: '请输入学生姓名', trigger: 'blur' }]
};

const filteredAssignableStudents = computed(() => {
  const keyword = assignKeyword.value.trim();
  const activeStudents = tableData.value.filter((student) => student.status === 'active');

  if (!keyword) {
    return activeStudents;
  }

  return activeStudents.filter((student) => (
    student.student_name.includes(keyword)
    || String(student.dormitoryName || '').includes(keyword)
  ));
});

const dormitoryModalTitle = computed(() => {
  if (dormitoryModalMode.value === 'create') {
    return '新建宿舍';
  }

  if (dormitoryModalMode.value === 'assign') {
    return '分配学生';
  }

  return '编辑宿舍';
});

const dormitoryModalSubmitText = computed(() => (
  dormitoryModalMode.value === 'create' ? '创建宿舍' : '保存宿舍'
));

const formatDate = (dateStr) => new Date(dateStr).toLocaleString('zh-CN');

const loadLoginWindowStatus = async () => {
  try {
    const res = await getLoginWindowStatus();
    loginWindowOpen.value = res.loginWindowOpen;
  } catch (error) {
    console.error('加载登录窗口状态失败:', error);
  }
};

const handleToggleLoginWindow = async (value) => {
  switchLoading.value = true;

  try {
    await toggleLoginWindow(value);
    ElMessage.success(value ? '登录窗口已开启' : '登录窗口已关闭');
  } catch (error) {
    loginWindowOpen.value = !value;
  } finally {
    switchLoading.value = false;
  }
};

const loadStudents = async () => {
  const res = await getStudentsEnhanced();
  tableData.value = (res.students || res).sort((left, right) => (
    String(left.student_name || '').localeCompare(String(right.student_name || ''), 'zh-CN')
  ));
};

const loadDormitoryData = async () => {
  const res = await getDormitories();
  dormitories.value = res.dormitories || [];
};

const loadData = async () => {
  loading.value = true;

  try {
    await Promise.all([loadStudents(), loadDormitoryData()]);
  } finally {
    loading.value = false;
  }
};

const showAddDialog = () => {
  isEdit.value = false;
  dialogTitle.value = '添加学生';
  form.value = {
    studentName: '',
    status: 'active',
    role: 'student'
  };
  dialogVisible.value = true;
};

const showEditDialog = (row) => {
  isEdit.value = true;
  dialogTitle.value = '编辑学生';
  currentStudent.value = row;
  form.value = {
    studentName: row.student_name,
    status: row.status,
    role: row.role || 'student'
  };
  dialogVisible.value = true;
};

const showLoginLogs = async (row) => {
  currentStudent.value = row;
  showLogsDialog.value = true;
  logsPage.value = 1;
  await loadLoginLogs();
};

const loadLoginLogs = async () => {
  if (!currentStudent.value) {
    return;
  }

  logsLoading.value = true;

  try {
    const offset = (logsPage.value - 1) * 20;
    const res = await getStudentLoginLogs(currentStudent.value.id, {
      limit: 20,
      offset
    });
    loginLogs.value = res.logs;
    logsTotalCount.value = res.total;
  } finally {
    logsLoading.value = false;
  }
};

const handleLogsPageChange = (page) => {
  logsPage.value = page;
  loadLoginLogs();
};

const openConfirmDialog = (config, target) => {
  confirmTarget.value = target;
  confirmAction.value = config.action;
  confirmDialog.value = {
    visible: true,
    title: config.title,
    message: config.message,
    details: config.details || [],
    confirmText: config.confirmText || '确定',
    confirmType: config.confirmType || 'warning'
  };
};

const handleReset = (row) => {
  openConfirmDialog(
    {
      action: 'reset-student',
      title: '重置确认',
      message: `确定要重置 ${row.student_name} 的账户吗？`,
      details: [
        '该学生的密码将被清除',
        '所有已登录设备都会被踢出',
        '需要重新等待登录窗口开启后再设置密码'
      ],
      confirmText: '确认重置',
      confirmType: 'warning'
    },
    row
  );
};

const handleDelete = (row) => {
  openConfirmDialog(
    {
      action: 'delete-student',
      title: '归档学生确认',
      message: `确定要归档 ${row.student_name} 吗？`,
      details: [
        '归档后学生账号会停用，并清空登录凭据。',
        '请假记录、请假明细和登录日志都会保留，后续仍可在“记录/日志”页查看。'
      ],
      confirmText: '确认归档',
      confirmType: 'warning'
    },
    row
  );
};

const handleDormitoryDelete = (row) => {
  openConfirmDialog(
    {
      action: 'delete-dormitory',
      title: '删除宿舍确认',
      message: `确定要删除宿舍 ${row.name} 吗？`,
      details: ['只有空宿舍才能删除。如果还有学生，请先移出后再删除。'],
      confirmText: '确认删除',
      confirmType: 'danger'
    },
    row
  );
};

const closeConfirmDialog = () => {
  confirmDialog.value.visible = false;
  confirmAction.value = '';
  confirmTarget.value = null;
};

const confirmCurrentAction = async () => {
  if (!confirmTarget.value || !confirmAction.value) {
    closeConfirmDialog();
    return;
  }

  confirmLoading.value = true;

  try {
    if (confirmAction.value === 'reset-student') {
      await resetStudent(confirmTarget.value.id);
      ElMessage.success('重置成功');
    }

    if (confirmAction.value === 'delete-student') {
      await deleteStudent(confirmTarget.value.id);
      ElMessage.success('归档成功，历史记录已保留');
    }

    if (confirmAction.value === 'delete-dormitory') {
      await deleteDormitory(confirmTarget.value.id);
      ElMessage.success('宿舍删除成功');
    }

    closeConfirmDialog();
    await loadData();
  } finally {
    confirmLoading.value = false;
  }
};

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false);

  if (!valid) {
    return;
  }

  submitting.value = true;

  try {
    if (isEdit.value) {
      await updateStudent(currentStudent.value.id, form.value);
      ElMessage.success('更新成功');
    } else {
      await addStudent(form.value);
      ElMessage.success('添加成功');
    }

    dialogVisible.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
};

const openDormitoryModal = (row = null, mode = 'create') => {
  currentDormitory.value = row;
  dormitoryModalMode.value = row ? mode : 'create';
  dormitoryForm.value = {
    name: row?.name || '',
    selectedStudentIds: row?.students?.map((student) => student.id) || []
  };
  assignKeyword.value = '';
  dormitoryModalVisible.value = true;
};

const saveDormitoryModal = async () => {
  const name = dormitoryForm.value.name.trim();
  if (!name) {
    ElMessage.warning('请输入宿舍名称');
    return;
  }

  dormitorySubmitting.value = true;

  try {
    let dormitoryId = currentDormitory.value?.id || null;

    if (currentDormitory.value) {
      await updateDormitory(dormitoryId, { name });
      ElMessage.success('宿舍更新成功');
    } else {
      const res = await createDormitory({ name });
      dormitoryId = res.dormitory?.id || null;
      ElMessage.success('宿舍创建成功');
    }

    if (dormitoryId) {
      await assignDormitoryStudents(dormitoryId, {
        studentIds: dormitoryForm.value.selectedStudentIds
      });
    }

    dormitoryModalVisible.value = false;
    await loadData();
  } finally {
    dormitorySubmitting.value = false;
  }
};

const focusDormitorySearch = async () => {
  await nextTick();
  assignSearchInput.value?.focus();
};

const toggleDormStudent = (studentId) => {
  if (dormitoryForm.value.selectedStudentIds.includes(studentId)) {
    dormitoryForm.value = {
      ...dormitoryForm.value,
      selectedStudentIds: dormitoryForm.value.selectedStudentIds.filter((id) => id !== studentId)
    };
    return;
  }

  dormitoryForm.value = {
    ...dormitoryForm.value,
    selectedStudentIds: [...dormitoryForm.value.selectedStudentIds, studentId]
  };
};

onMounted(async () => {
  await Promise.all([loadLoginWindowStatus(), loadData()]);
});
</script>

<style scoped>
.students-page {
  height: 100%;
}

.glass-card {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important;
  border-radius: 20px !important;
  margin-bottom: 20px;
}

:deep(.glass-card .el-card__header) {
  border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important;
  color: #1e3a8a;
  font-weight: 600;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.subtle-copy {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.login-window-control {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hint {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.student-info {
  padding: 16px;
  background: rgba(219, 234, 254, 0.4);
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.student-info p {
  margin: 8px 0;
  font-size: 14px;
  color: #1e3a8a;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dormitory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.dormitory-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(219, 234, 254, 0.9);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
}

.dormitory-card__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.dormitory-card__head h3 {
  margin: 0;
  color: #12316f;
}

.dormitory-card__head p {
  margin: 6px 0 0;
  color: #64748b;
}

.dormitory-card__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.dormitory-card__members {
  margin-top: 14px;
  line-height: 1.7;
  color: #315a95;
  min-height: 48px;
}

.dormitory-form__label {
  display: block;
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #1e3a8a;
}

.dormitory-modal-form {
  position: sticky;
  top: -8px;
  z-index: 3;
  margin: -8px -14px 4px;
  padding: 14px 16px 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(244, 248, 255, 0.92) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 20px rgba(148, 163, 184, 0.08);
}

:deep(.el-table) {
  background: transparent !important;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(219, 234, 254, 0.5);
  --el-table-row-hover-bg-color: rgba(59, 130, 246, 0.06);
  --el-table-border-color: rgba(59, 130, 246, 0.1);
}

:deep(.el-table__header th) {
  color: #1e3a8a !important;
  font-weight: 600;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(59, 130, 246, 0.03) !important;
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: #22c55e !important;
  border-color: #22c55e !important;
}

:deep(.el-pagination .el-pager li.is-active) {
  color: #3b82f6 !important;
}
</style>

<style>
.dorm-picker-overlay {
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0%, rgba(191, 219, 254, 0.14) 22%, rgba(15, 23, 42, 0.3) 68%),
    rgba(224, 242, 254, 0.16);
}

.ui-can-blur .dorm-picker-overlay {
  backdrop-filter: blur(22px) saturate(135%);
  -webkit-backdrop-filter: blur(22px) saturate(135%);
}

.dorm-picker-overlay .project-modal-shell {
  width: 100%;
  max-width: 620px;
}

.dorm-picker-overlay .project-modal-bloom {
  width: 62%;
  height: auto;
  aspect-ratio: 1;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.86) 0%, rgba(191, 219, 254, 0.55) 38%, rgba(96, 165, 250, 0.18) 62%, transparent 82%);
  filter: blur(38px);
  transform: scale(0.8);
  opacity: 0.92;
}

.dorm-picker-modal {
  max-height: min(82vh, 720px);
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.56) 100%);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    0 35px 80px rgba(15, 23, 42, 0.16),
    0 20px 44px rgba(59, 130, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.ui-can-blur .dorm-picker-modal {
  backdrop-filter: blur(30px) saturate(145%);
  -webkit-backdrop-filter: blur(30px) saturate(145%);
}

.dorm-picker-modal .project-modal-header {
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 12px;
}

.dorm-picker-modal .project-modal-title {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: #102a74;
}

.dorm-picker-modal__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 14px 16px;
  overflow-y: auto;
}

.dorm-picker-modal .project-modal-footer {
  padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.58);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.34) 100%);
}

.student-option {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.student-option--active {
  border-color: rgba(59, 130, 246, 0.3);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(219, 234, 254, 0.55) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 14px 28px rgba(59, 130, 246, 0.16);
}

.student-option__body {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.student-option-name {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.student-option-current {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #5f79a4;
  text-align: right;
}

.student-option-current--empty {
  color: #7c93b8;
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

.dorm-picker-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dorm-picker-footer__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.dorm-picker-footer__count {
  color: #315a95;
  font-size: 13px;
  font-weight: 700;
}

.student-search {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
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

@media (max-width: 900px) {
  .dorm-picker-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .dorm-picker-footer__actions {
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .student-option__body {
    align-items: flex-start;
    flex-direction: column;
  }

  .student-option-current {
    margin-left: 0;
    text-align: left;
  }
}
</style>
