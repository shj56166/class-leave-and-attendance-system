<template>
  <div class="records-page">
    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>请假历史</h2>
            <p>统一查看当前请假记录与由操作日志回补出的历史审批记录。</p>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="学生姓名">
          <el-input
            v-model="searchForm.studentName"
            placeholder="请输入学生姓名"
            clearable
          />
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="待审批" value="pending" />
            <el-option label="已同意" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已报备" value="recorded" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请模式">
          <el-select v-model="searchForm.requestMode" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="当天请假" value="today" />
            <el-option label="其他请假" value="custom" />
            <el-option label="周末 / 节假日报备" value="weekend" />
          </el-select>
        </el-form-item>
        <el-form-item label="记录来源">
          <el-select v-model="searchForm.sourceType" placeholder="全部">
            <el-option label="全部" value="all" />
            <el-option label="当前请假记录" value="request" />
            <el-option label="操作日志回补" value="audit_fallback" />
          </el-select>
        </el-form-item>
        <el-form-item label="提交日期">
          <el-date-picker
            v-model="submittedDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="审批日期">
          <el-date-picker
            v-model="reviewedDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="handleSearch">查询</el-button>
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="studentName" label="学生" min-width="130" />
        <el-table-column label="来源" min-width="130">
          <template #default="{ row }">
            <el-tag :type="getSourceTagType(row.sourceType)" effect="plain">
              {{ getSourceTypeText(row.sourceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请模式" min-width="130">
          <template #default="{ row }">
            <el-tag plain type="primary">{{ getRequestModeText(row.requestMode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="请假类型" min-width="120">
          <template #default="{ row }">
            <el-tag :type="getLeaveTypeTag(row.leaveType)">
              {{ getLeaveTypeText(row.leaveType, row.requestMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewerName" label="审批人" min-width="120" />
        <el-table-column label="提交时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="审批时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.reviewedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="识别地点" min-width="120">
          <template #default="{ row }">
            {{ getLocationText(row.currentLocation) }}
          </template>
        </el-table-column>
        <el-table-column label="课程摘要" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getCourseSummaryText(row) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <ProjectDialog v-model="detailVisible" title="请假详情" width="720px">
      <div v-if="currentRecord" class="detail-panel">
        <el-alert
          v-if="currentRecord.sourceType === 'audit_fallback'"
          :title="currentRecord.historyNotice"
          type="warning"
          :closable="false"
          show-icon
          class="detail-alert"
        />

        <el-descriptions :column="1" border>
          <el-descriptions-item label="学生姓名">
            {{ currentRecord.studentName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="学号">
            {{ currentRecord.studentNumber || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="班级">
            {{ TEACHER_DISPLAY_CLASS_NAME }}
          </el-descriptions-item>
          <el-descriptions-item label="记录来源">
            {{ getSourceTypeText(currentRecord.sourceType) }}
          </el-descriptions-item>
          <el-descriptions-item label="申请模式">
            {{ getRequestModeText(currentRecord.requestMode) }}
          </el-descriptions-item>
          <el-descriptions-item label="请假类型">
            {{ getLeaveTypeText(currentRecord.leaveType, currentRecord.requestMode) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ getStatusText(currentRecord.status) }}
          </el-descriptions-item>
          <el-descriptions-item label="审批人">
            {{ currentRecord.reviewerName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ formatDateTime(currentRecord.submittedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="审批时间">
            {{ formatDateTime(currentRecord.reviewedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="请假时间">
            {{ formatRange(currentRecord.startTime, currentRecord.endTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="识别地点">
            {{ getLocationText(currentRecord.currentLocation) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentRecord.requestMode === 'weekend'" label="回家状态">
            {{ currentRecord.goHome ? '回家' : '留校' }}
          </el-descriptions-item>
          <el-descriptions-item label="请假原因">
            {{ currentRecord.reason || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="审批意见">
            {{ currentRecord.teacherComment || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="课程摘要">
            {{ getCourseSummaryText(currentRecord) }}
          </el-descriptions-item>
          <el-descriptions-item label="课程明细">
            <div class="record-list">
              <template v-if="currentRecord.records?.length">
                <div
                  v-for="(record, index) in currentRecord.records"
                  :key="`${currentRecord.id}-${index}`"
                  class="record-list__item"
                >
                  {{ formatRecord(record) }}
                </div>
              </template>
              <span v-else>{{ getEmptyRecordText(currentRecord) }}</span>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </ProjectDialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import ProjectDialog from '../components/ProjectDialog.vue';
import { TEACHER_DISPLAY_CLASS_NAME } from '../constants/display';
import { getLeaveHistory } from '../api/teacher';

const tableData = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const detailVisible = ref(false);
const currentRecord = ref(null);

const searchForm = ref({
  studentName: '',
  status: '',
  requestMode: '',
  sourceType: 'all'
});

const submittedDateRange = ref([]);
const reviewedDateRange = ref([]);

function getLeaveTypeTag(type) {
  return { sick: 'danger', personal: 'warning', other: 'info' }[type] || 'info';
}

function getLeaveTypeText(type, requestMode) {
  if (requestMode === 'weekend') {
    return '周末 / 节假日报备';
  }

  return {
    sick: '病假',
    personal: '事假',
    other: '其他'
  }[type] || type || '-';
}

function getStatusTag(status) {
  return {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    recorded: 'primary'
  }[status] || 'info';
}

function getStatusText(status) {
  return {
    pending: '待审批',
    approved: '已同意',
    rejected: '已拒绝',
    recorded: '已报备'
  }[status] || status || '-';
}

function getRequestModeText(mode) {
  return {
    today: '当天请假',
    custom: '其他请假',
    weekend: '周末 / 节假日报备'
  }[mode] || mode || '-';
}

function getSourceTypeText(type) {
  return {
    request: '当前请假记录',
    audit_fallback: '操作日志回补'
  }[type] || type || '-';
}

function getSourceTagType(type) {
  return type === 'audit_fallback' ? 'warning' : 'success';
}

function getLocationText(location) {
  return {
    dormitory: '宿舍',
    classroom: '教室',
    home: '家中',
    other: '其他'
  }[location] || (location || '-');
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('zh-CN');
}

function formatRange(startTime, endTime) {
  if (!startTime && !endTime) {
    return '-';
  }

  return `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`;
}

function sortRecords(records = []) {
  return [...records].sort((left, right) => {
    const leftDate = String(left.leaveDate || '');
    const rightDate = String(right.leaveDate || '');

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    return Number(left.period || 0) - Number(right.period || 0);
  });
}

function formatRecord(record) {
  const parts = [];

  if (record.leaveDate) {
    parts.push(record.leaveDate);
  }

  if (record.period) {
    parts.push(`第${record.period}节`);
  }

  parts.push(record.subject || '未命名课程');

  return parts.join(' ');
}

function getCourseSummaryText(row) {
  const records = sortRecords(row.records || []);

  if (records.length > 0) {
    if (records.length === 1) {
      return formatRecord(records[0]);
    }

    const first = records[0];
    const last = records[records.length - 1];
    const dateText = first.leaveDate && first.leaveDate === last.leaveDate
      ? first.leaveDate
      : `${first.leaveDate || '-'} 至 ${last.leaveDate || '-'}`;

    return `${dateText} 第${first.period || '-'}节 - 第${last.period || '-'}节，共 ${records.length} 节`;
  }

  if (row.requestMode === 'weekend') {
    return row.goHome ? '周末 / 节假日回家备案' : '周末 / 节假日留校备案';
  }

  if (row.sourceType === 'audit_fallback') {
    return '该历史记录由操作日志回补，课程明细缺失';
  }

  return '未命中课程';
}

function getEmptyRecordText(row) {
  if (row.sourceType === 'audit_fallback') {
    return '操作日志中没有保存课程明细。';
  }

  if (row.requestMode === 'weekend') {
    return row.goHome ? '该记录为回家报备，无课程明细。' : '该记录为留校报备，无课程明细。';
  }

  return '暂无课程明细。';
}

async function loadData() {
  loading.value = true;

  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      sourceType: searchForm.value.sourceType,
      studentName: searchForm.value.studentName,
      status: searchForm.value.status,
      requestMode: searchForm.value.requestMode
    };

    if (!params.studentName) {
      delete params.studentName;
    }

    if (!params.status) {
      delete params.status;
    }

    if (!params.requestMode) {
      delete params.requestMode;
    }

    if (!params.sourceType || params.sourceType === 'all') {
      delete params.sourceType;
    }

    if (submittedDateRange.value?.length === 2) {
      params.startDate = submittedDateRange.value[0];
      params.endDate = submittedDateRange.value[1];
    }

    if (reviewedDateRange.value?.length === 2) {
      params.reviewedStartDate = reviewedDateRange.value[0];
      params.reviewedEndDate = reviewedDateRange.value[1];
    }

    const response = await getLeaveHistory(params);
    tableData.value = response.data || [];
    total.value = Number(response.total || 0);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadData();
}

function handleReset() {
  searchForm.value = {
    studentName: '',
    status: '',
    requestMode: '',
    sourceType: 'all'
  };
  submittedDateRange.value = [];
  reviewedDateRange.value = [];
  currentPage.value = 1;
  loadData();
}

function showDetail(row) {
  currentRecord.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.records-page {
  height: 100%;
}

.glass-card {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important;
  border-radius: 20px !important;
}

:deep(.glass-card .el-card__header) {
  border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  color: #12316f;
}

.card-header p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #5c739e;
}

.search-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-alert {
  margin-bottom: 4px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-list__item {
  color: #315a95;
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

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.85) !important;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15) !important;
  border-radius: 10px !important;
}

:deep(.el-pagination .el-pager li.is-active) {
  color: #3b82f6 !important;
}
</style>
