<template>
  <div class="records-and-logs-page">
    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>记录/日志</h2>
            <p>统一查看请假记录和旷课记录，支持按记录类型、学生和日期范围联动筛选。</p>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="recordFilters" class="search-form">
        <el-form-item label="记录类型">
          <el-select v-model="recordFilters.recordType" placeholder="全部" style="width: 140px">
            <el-option label="全部" value="all" />
            <el-option label="请假" value="leave" />
            <el-option label="旷课" value="truancy" />
          </el-select>
        </el-form-item>

        <el-form-item label="学生">
          <el-select v-model="recordFilters.studentId" clearable filterable placeholder="全部学生" style="width: 220px">
            <el-option v-for="student in studentOptions" :key="student.id" :label="student.label" :value="student.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="学生姓名">
          <el-input v-model="recordFilters.studentName" placeholder="模糊搜索学生姓名" clearable />
        </el-form-item>

        <el-form-item label="日期范围">
          <el-date-picker
            v-model="recordDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>

        <template v-if="showLeaveFilters">
          <el-form-item label="状态">
            <el-select v-model="recordFilters.status" placeholder="全部" clearable style="width: 120px">
              <el-option label="待审批" value="pending" />
              <el-option label="已同意" value="approved" />
              <el-option label="已拒绝" value="rejected" />
              <el-option label="已报备" value="recorded" />
            </el-select>
          </el-form-item>

          <el-form-item label="申请模式">
            <el-select v-model="recordFilters.requestMode" placeholder="全部" clearable style="width: 150px">
              <el-option label="当天请假" value="today" />
              <el-option label="其他请假" value="custom" />
              <el-option label="周末 / 节假日报备" value="weekend" />
            </el-select>
          </el-form-item>

          <el-form-item label="记录来源">
            <el-select v-model="recordFilters.sourceType" placeholder="全部" style="width: 160px">
              <el-option label="全部" value="all" />
              <el-option label="当前请假记录" value="request" />
              <el-option label="操作日志回补" value="audit_fallback" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="handleRecordSearch">查询</el-button>
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="resetRecordFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="recordRows" v-loading="recordsLoading" stripe>
        <el-table-column label="类型" width="92">
          <template #default="{ row }">
            <el-tag :type="row.recordType === 'leave' ? 'primary' : 'danger'" effect="plain">
              {{ row.recordType === 'leave' ? '请假' : '旷课' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="studentName" label="学生" min-width="130" />
        <el-table-column prop="studentNumber" label="学号" min-width="110" />
        <el-table-column prop="dormitoryName" label="宿舍" min-width="120" />
        <el-table-column label="时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.submittedAt || row.occurredAt) }}
          </template>
        </el-table-column>
        <el-table-column label="摘要" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getRecordSummary(row) }}
          </template>
        </el-table-column>
        <el-table-column label="状态/标签" min-width="140">
          <template #default="{ row }">
            <el-tag v-if="row.recordType === 'leave'" :type="getLeaveStatusTag(row.status)">
              {{ getLeaveStatusText(row.status) }}
            </el-tag>
            <el-tag v-else :type="row.isQuestion ? 'warning' : 'danger'" effect="plain">
              {{ row.isQuestion ? '疑问旷课' : '旷课' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="recordPage"
        v-model:page-size="recordPageSize"
        :total="recordTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="loadRecords"
        @current-change="loadRecords"
      />
    </el-card>

    <el-card v-if="isAdmin" class="glass-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>操作日志</h2>
            <p>查看教师端和学生端产生的关键操作审计记录。</p>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="search-form">
        <el-form-item label="操作类型">
          <el-select v-model="filters.action" placeholder="全部" clearable style="width: 180px">
            <el-option v-for="action in actionTypes" :key="action" :label="getActionLabel(action)" :value="action" />
          </el-select>
        </el-form-item>
        <el-form-item label="用户类型">
          <el-select v-model="filters.userType" placeholder="全部" clearable style="width: 120px">
            <el-option label="教师" value="teacher" />
            <el-option label="学生" value="student" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="loadLogs">查询</el-button>
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="logs" border stripe v-loading="logsLoading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="用户" width="150">
          <template #default="{ row }">
            <div v-if="row.user_type === 'teacher'">
              <el-tag type="success" size="small">教师</el-tag>
              <div>{{ row.user?.realName || row.user?.username || '-' }}</div>
            </div>
            <div v-else-if="row.user_type === 'student'">
              <el-tag type="info" size="small">学生</el-tag>
              <div>{{ row.user?.name || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="150">
          <template #default="{ row }">{{ getActionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column label="目标类型" width="120">
          <template #default="{ row }">{{ getTargetTypeLabel(row.target_type) }}</template>
        </el-table-column>
        <el-table-column label="详情" min-width="200">
          <template #default="{ row }">
            <el-popover placement="left" :width="400" trigger="click">
              <template #reference>
                <el-button link type="primary" size="small">查看详情</el-button>
              </template>
              <div class="details-content"><pre>{{ JSON.stringify(row.details, null, 2) }}</pre></div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination pagination--center"
        @current-change="loadLogs"
        @size-change="loadLogs"
      />
    </el-card>

    <ProjectDialog v-model="detailVisible" :title="detailTitle" width="720px">
      <div v-if="currentRecord" class="detail-panel">
        <template v-if="currentRecord.recordType === 'leave'">
          <el-alert
            v-if="currentRecord.sourceType === 'audit_fallback'"
            :title="currentRecord.historyNotice"
            type="warning"
            :closable="false"
            show-icon
            class="detail-alert"
          />
          <el-descriptions :column="1" border>
            <el-descriptions-item label="学生姓名">{{ currentRecord.studentName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="学号">{{ currentRecord.studentNumber || '-' }}</el-descriptions-item>
            <el-descriptions-item label="宿舍">{{ currentRecord.dormitoryName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="申请模式">{{ getRequestModeText(currentRecord.requestMode) }}</el-descriptions-item>
            <el-descriptions-item label="请假类型">{{ getLeaveTypeText(currentRecord.leaveType, currentRecord.requestMode) }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ getLeaveStatusText(currentRecord.status) }}</el-descriptions-item>
            <el-descriptions-item label="审批人">{{ currentRecord.reviewerName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(currentRecord.submittedAt) }}</el-descriptions-item>
            <el-descriptions-item label="审批时间">{{ formatDateTime(currentRecord.reviewedAt) }}</el-descriptions-item>
            <el-descriptions-item label="请假时间">{{ formatRange(currentRecord.startTime, currentRecord.endTime) }}</el-descriptions-item>
            <el-descriptions-item label="识别地点">{{ getLocationText(currentRecord.currentLocation) }}</el-descriptions-item>
            <el-descriptions-item label="请假原因">{{ currentRecord.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审批意见">{{ currentRecord.teacherComment || '-' }}</el-descriptions-item>
          </el-descriptions>
        </template>

        <template v-else>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="学生姓名">{{ currentRecord.studentName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="学号">{{ currentRecord.studentNumber || '-' }}</el-descriptions-item>
            <el-descriptions-item label="宿舍">{{ currentRecord.dormitoryName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="核对日期">{{ currentRecord.checkDate || '-' }}</el-descriptions-item>
            <el-descriptions-item label="时段">{{ currentRecord.slotLabel || '-' }}</el-descriptions-item>
            <el-descriptions-item label="课程">{{ currentRecord.subject || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交班干">{{ currentRecord.submittedByName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(currentRecord.submittedAt) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="currentRecord.isQuestion ? 'warning' : 'danger'" effect="plain">
                {{ currentRecord.isQuestion ? '疑问旷课' : '旷课' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="未到名单">{{ formatStudentSnapshotList(currentRecord.selectedStudents) }}</el-descriptions-item>
            <el-descriptions-item label="旷课名单">{{ formatStudentSnapshotList(currentRecord.truancyStudents) }}</el-descriptions-item>
            <el-descriptions-item label="疑问名单">{{ formatStudentSnapshotList(currentRecord.questionStudents) }}</el-descriptions-item>
          </el-descriptions>
        </template>
      </div>
    </ProjectDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute } from 'vue-router';
import ProjectDialog from '../components/ProjectDialog.vue';
import {
  getAuditActions,
  getAuditLogs,
  getIntegratedRecords,
  getStudents
} from '../api/teacher';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const studentOptions = ref([]);
const recordsLoading = ref(false);
const recordRows = ref([]);
const recordTotal = ref(0);
const recordPage = ref(1);
const recordPageSize = ref(20);
const recordDateRange = ref([]);
const detailVisible = ref(false);
const currentRecord = ref(null);
const recordFilters = ref({
  recordType: 'all',
  studentId: '',
  studentName: '',
  status: '',
  requestMode: '',
  sourceType: 'all'
});

const logsLoading = ref(false);
const logs = ref([]);
const actionTypes = ref([]);
const dateRange = ref([]);
const filters = ref({ action: '', userType: '' });
const pagination = ref({ page: 1, limit: 50, total: 0 });

const detailTitle = computed(() => currentRecord.value?.recordType === 'truancy' ? '旷课详情' : '请假详情');
const showLeaveFilters = computed(() => recordFilters.value.recordType !== 'truancy');

const actionLabels = {
  login: '登录', approve_leave: '审批请假', create_student: '新增学生', update_student: '编辑学生', archive_student: '归档学生', export_database: '导出数据库', preview_restore_database: '预览恢复数据库', replace_database: '覆盖恢复数据库', clear_preview_database: '清理预览库', update_backup_settings: '更新备份设置', deactivate_student: '停用学生', update_schedule: '更新课表', update_special_dates: '更新特殊日期', reset_password: '重置密码', submit_classroom_check: '提交教室核对'
};
const targetTypeLabels = { teacher: '教师', student: '学生', leave_request: '请假申请', schedule: '课表', backup: '备份', classroom_check: '教室核对' };

function getLeaveTypeText(type, requestMode) {
  if (requestMode === 'weekend') return '周末 / 节假日报备';
  return { sick: '病假', personal: '事假', other: '其他' }[type] || type || '-';
}
function getLeaveStatusText(status) {
  return { pending: '待审批', approved: '已同意', rejected: '已拒绝', recorded: '已报备' }[status] || status || '-';
}
function getLeaveStatusTag(status) {
  return { pending: 'warning', approved: 'success', rejected: 'danger', recorded: 'primary' }[status] || 'info';
}
function getRequestModeText(mode) {
  return { today: '当天请假', custom: '其他请假', weekend: '周末 / 节假日报备' }[mode] || mode || '-';
}
function getLocationText(location) {
  return { dormitory: '宿舍', classroom: '教室', home: '家中', other: '其他' }[location] || (location || '-');
}
function getActionLabel(action) {
  return actionLabels[action] || action;
}
function getTargetTypeLabel(type) {
  return targetTypeLabels[type] || type;
}
function formatStudentSnapshotList(items = []) {
  return items.length ? items.map((item) => item.studentName).join('、') : '无';
}
function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}
function formatRange(startTime, endTime) {
  if (!startTime && !endTime) return '-';
  return `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`;
}
function getRecordSummary(row) {
  if (row.recordType === 'leave') {
    const modeText = getRequestModeText(row.requestMode);
    const typeText = getLeaveTypeText(row.leaveType, row.requestMode);
    return `${modeText} · ${typeText} · ${row.reason || '无请假原因'}`;
  }
  return `${row.checkDate || '-'} · ${row.slotLabel || '-'} · ${row.submittedByName || '-'} 提交`;
}

async function loadStudents() {
  try {
    const students = await getStudents();
    studentOptions.value = (students || []).map((student) => ({
      id: student.id,
      label: `${student.student_name}${student.student_number ? ` · ${student.student_number}` : ''}`
    }));
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '加载学生列表失败');
  }
}

async function loadRecords() {
  recordsLoading.value = true;
  try {
    const params = {
      page: recordPage.value,
      limit: recordPageSize.value,
      recordType: recordFilters.value.recordType,
      studentId: recordFilters.value.studentId || undefined,
      studentName: recordFilters.value.studentName || undefined,
      status: showLeaveFilters.value ? recordFilters.value.status || undefined : undefined,
      requestMode: showLeaveFilters.value ? recordFilters.value.requestMode || undefined : undefined,
      sourceType: showLeaveFilters.value ? recordFilters.value.sourceType || undefined : undefined
    };
    if (recordDateRange.value?.length === 2) {
      params.startDate = recordDateRange.value[0];
      params.endDate = recordDateRange.value[1];
    }
    const response = await getIntegratedRecords(params);
    recordRows.value = response.data || [];
    recordTotal.value = Number(response.total || 0);
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '加载记录失败');
  } finally {
    recordsLoading.value = false;
  }
}

function handleRecordSearch() {
  recordPage.value = 1;
  loadRecords();
}

function resetRecordFilters() {
  recordFilters.value = { recordType: 'all', studentId: '', studentName: '', status: '', requestMode: '', sourceType: 'all' };
  recordDateRange.value = [];
  recordPage.value = 1;
  loadRecords();
}

function showDetail(row) {
  currentRecord.value = row;
  detailVisible.value = true;
}

function applyRouteFilters(query) {
  if (!query || Object.keys(query).length === 0) return;
  if (query.studentId) recordFilters.value.studentId = Number(query.studentId);
  if (query.studentName) recordFilters.value.studentName = String(query.studentName);
  if (query.recordType && ['all', 'leave', 'truancy'].includes(query.recordType)) recordFilters.value.recordType = String(query.recordType);
  recordPage.value = 1;
  loadRecords();
}

async function loadLogs() {
  if (!isAdmin.value) return;
  logsLoading.value = true;
  try {
    const params = { page: pagination.value.page, limit: pagination.value.limit };
    if (filters.value.action) params.action = filters.value.action;
    if (filters.value.userType) params.userType = filters.value.userType;
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }
    const res = await getAuditLogs(params);
    logs.value = res.logs;
    pagination.value.total = res.total;
  } catch (error) {
    ElMessage.error('加载操作日志失败');
  } finally {
    logsLoading.value = false;
  }
}

async function loadActionTypes() {
  if (!isAdmin.value) return;
  try {
    actionTypes.value = await getAuditActions();
  } catch (error) {
    console.error('加载操作类型失败:', error);
  }
}

function resetFilters() {
  filters.value = { action: '', userType: '' };
  dateRange.value = [];
  pagination.value.page = 1;
  loadLogs();
}

watch(() => route.query, (query) => {
  applyRouteFilters(query);
}, { immediate: true });

onMounted(() => {
  loadStudents();
  loadRecords();
  if (isAdmin.value) {
    loadLogs();
    loadActionTypes();
  }
});
</script>

<style scoped>
.records-and-logs-page { display: flex; flex-direction: column; gap: 20px; min-height: 100%; }
.glass-card { background: rgba(255, 255, 255, 0.45) !important; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.6) !important; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important; border-radius: 20px !important; }
:deep(.glass-card .el-card__header) { border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.card-header h2 { margin: 0; font-size: 20px; color: #12316f; }
.card-header p { margin: 6px 0 0; font-size: 13px; line-height: 1.6; color: #5c739e; }
.search-form { margin-bottom: 20px; }
.pagination { margin-top: 20px; justify-content: flex-end; }
.pagination--center { justify-content: center; }
.detail-panel { display: flex; flex-direction: column; gap: 16px; }
.detail-alert { margin-bottom: 4px; }
.details-content { max-height: 400px; overflow-y: auto; }
.details-content pre { margin: 0; font-size: 12px; line-height: 1.5; color: #1e3a8a; }
:deep(.el-table) { background: transparent !important; --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-header-bg-color: rgba(219, 234, 254, 0.5); --el-table-row-hover-bg-color: rgba(59, 130, 246, 0.06); --el-table-border-color: rgba(59, 130, 246, 0.1); }
:deep(.el-table__header th) { color: #1e3a8a !important; font-weight: 600; }
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) { background: rgba(59, 130, 246, 0.03) !important; }
@media (max-width: 900px) { .card-header { flex-direction: column; } }
</style>
