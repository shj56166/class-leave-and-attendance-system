<template>
  <div class="approval-page">
    <el-card class="glass-card approval-shell">
      <template #header>
        <div class="card-header">
          <div class="card-header__main">
            <div class="card-header__title-row">
              <h2>待审批列表</h2>
              <el-popover
                placement="bottom-end"
                trigger="click"
                :width="260"
                popper-class="teacher-page-popover"
              >
                <template #reference>
                  <button type="button" class="info-trigger" aria-label="查看待审批列表说明">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                      <circle cx="12" cy="8" r="1.1" fill="currentColor" />
                      <path d="M12 11.2V16.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </template>
                <div class="info-popover">
                  <strong class="info-popover__title">待审批列表说明</strong>
                  <p class="info-popover__text">
                    这里只展示需要教师审批的当天请假和其他请假。学生提交后状态为待审批时会进入这里；
                    周末 / 节假日报备属于备案记录，不需要教师审批，因此不会出现在此列表中。
                  </p>
                </div>
              </el-popover>
            </div>
            <button type="button" class="quick-statistics-link" @click="goToStatistics">
              跳转今日统计
            </button>
            <div v-if="approvalSyncStatusText" class="approval-sync-status" :class="{ 'approval-sync-status--warning': approvalSyncHasWarning }">
              <span>{{ approvalSyncStatusText }}</span>
              <button
                v-if="showManualSyncAction"
                type="button"
                class="approval-sync-status__action"
                :disabled="loading"
                @click="handleManualRefresh"
              >
                立即同步
              </button>
            </div>
          </div>
          <div class="card-header__actions">
            <el-tag class="pending-count-tag" effect="plain" round type="primary">
              当前待审批 {{ tableData.length }} 项
            </el-tag>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="loading" @click="handleManualRefresh">刷新</el-button>
          </div>
        </div>
      </template>

      <div class="approval-list" v-loading="loading">
        <div v-if="tableData.length" class="approval-list__items">
          <article
            v-for="row in tableData"
            :key="row.id"
            class="approval-item"
          >
            <div class="approval-item__top">
              <div class="approval-item__identity">
                <div class="approval-item__name">{{ row.student?.student_name || '未命名学生' }}</div>
                <p class="approval-item__submitted">提交于 {{ formatDate(row.submitted_at) }}</p>
              </div>

              <div class="approval-item__tags">
                <el-tag effect="plain" round type="primary">
                  {{ getRequestModeText(row.request_mode) }}
                </el-tag>
                <el-tag round :type="getLeaveTypeTag(row.leave_type)">
                  {{ getLeaveTypeText(row.leave_type) }}
                </el-tag>
              </div>
            </div>

            <div class="approval-item__body">
              <section class="approval-item__hero">
                <span class="approval-item__label">请假时间</span>
                <strong class="approval-item__hero-text">
                  {{ getTimeSummaryText(row) }}
                </strong>
              </section>

              <div class="approval-item__meta-grid">
                <div class="approval-item__meta">
                  <span class="approval-item__meta-label">识别地点</span>
                  <span class="approval-item__meta-value">{{ getLocationText(row.current_location) }}</span>
                </div>
                <div class="approval-item__meta">
                  <span class="approval-item__meta-label">命中课程</span>
                  <span class="approval-item__meta-value">{{ getCourseDisplayText(row) }}</span>
                </div>
              </div>

              <section class="approval-item__reason">
                <span class="approval-item__label">请假原因</span>
                <p>{{ row.reason || '未填写请假原因' }}</p>
              </section>
            </div>

            <div class="action-buttons approval-item__actions">
              <el-button
                class="teacher-action-button teacher-action-button--success"
                type="success"
                size="small"
                :loading="submitting && currentLeave?.id === row.id && pendingStatus === 'approved'"
                @click="approveWithoutComment(row)"
              >
                同意
              </el-button>
              <el-button class="teacher-action-button teacher-action-button--primary" type="primary" size="small" @click="openApprovalDialog(row, 'approve-with-comment')">
                同意并备注
              </el-button>
              <el-button class="teacher-action-button teacher-action-button--danger" type="danger" size="small" @click="openApprovalDialog(row, 'reject-with-comment')">
                不同意
              </el-button>
            </div>
          </article>
        </div>

        <el-empty v-else-if="!loading" description="暂无待审批申请" />
      </div>
    </el-card>

    <ProjectDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      @update:model-value="handleDialogVisibleChange"
    >
      <el-form :model="approvalForm" label-width="84px">
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="4"
            placeholder="可选备注，不填写则按无意见处理"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="dialogVisible = false">取消</el-button>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="submitting" @click="confirmApproval">确定</el-button>
        </div>
      </template>
    </ProjectDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import ProjectDialog from '../components/ProjectDialog.vue';
import { approveLeave, getPendingLeaves } from '../api/teacher';
import { useTeacherNotificationsStore } from '../stores/notifications';

const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const dialogTitle = ref('');
const submitting = ref(false);
const currentLeave = ref(null);
const approvalAction = ref('');
const pendingStatus = ref('');
const approvalForm = ref({
  comment: ''
});
const queuedRealtimeRefresh = ref(false);
const realtimeRefreshRetrying = ref(false);
const approvalSyncErrorMessage = ref('');
const notificationStore = useTeacherNotificationsStore();
const router = useRouter();

const approvalSyncStatusText = computed(() => {
  if (approvalSyncErrorMessage.value) {
    return approvalSyncErrorMessage.value;
  }

  if (realtimeRefreshRetrying.value) {
    return '检测到新审批，正在进行第 2 次同步重试。';
  }

  if (notificationStore.needsApprovalRefresh) {
    return '检测到新审批，列表正在自动同步。';
  }

  return '';
});

const approvalSyncHasWarning = computed(() => Boolean(approvalSyncErrorMessage.value));
const showManualSyncAction = computed(() => (
  Boolean(approvalSyncErrorMessage.value) || notificationStore.needsApprovalRefresh
));

function getLeaveTypeTag(type) {
  return { sick: 'danger', personal: 'warning', other: 'info' }[type] || 'info';
}

function getLeaveTypeText(type) {
  return { sick: '病假', personal: '事假', other: '其他' }[type] || '请假';
}

function getRequestModeText(mode) {
  return { today: '当天请假', custom: '其他请假', weekend: '周末报备' }[mode] || mode;
}

function getLocationText(location) {
  return {
    dormitory: '宿舍',
    classroom: '教室',
    home: '家中',
    other: '其他'
  }[location] || '未识别';
}

function getCourseRangeText(records = []) {
  if (!records.length) {
    return '未命中课程';
  }

  const sorted = [...records].sort((left, right) => {
    if (left.leave_date !== right.leave_date) {
      return String(left.leave_date).localeCompare(String(right.leave_date));
    }
    return left.period - right.period;
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (sorted.length === 1) {
    return `第 ${first.period} 节 · ${first.subject || '未命名课程'}`;
  }

  return `第 ${first.period} - ${last.period} 节`;
}

function getTimeSummaryText(row) {
  const weekdayLabel = row.timeSummary?.weekdayLabel || '';
  const dayCount = Number(row.timeSummary?.dayCount || 1);
  const timeRange = `${formatDate(row.start_time)} 至 ${formatDate(row.end_time)}`;
  return [weekdayLabel, timeRange, `共 ${dayCount} 天`].filter(Boolean).join(' · ');
}

function getCourseDisplayText(row) {
  const rangeText = row.courseSummary?.rangeText || getCourseRangeText(row.records);
  const totalPeriods = Number(row.courseSummary?.totalPeriods ?? row.records?.length ?? 0);
  const coverageLabel = row.courseSummary?.coverageLabel || '';
  const parts = [rangeText];

  if (totalPeriods > 0) {
    parts.push(`共 ${totalPeriods} 节`);
  }

  if (coverageLabel) {
    parts.push(coverageLabel);
  }

  return parts.filter(Boolean).join(' · ');
}

function formatDate(dateStr) {
  if (!dateStr) {
    return '-';
  }

  return new Date(dateStr).toLocaleString('zh-CN');
}

function goToStatistics() {
  router.push({ name: 'Statistics' });
}

async function loadData(options = {}) {
  const silent = options.silent === true;

  loading.value = true;
  try {
    tableData.value = await getPendingLeaves({
      silentError: silent
    });
    approvalSyncErrorMessage.value = '';
    notificationStore.markApprovalRefreshed();
    return true;
  } catch (error) {
    if (!silent && error.response?.status !== 401) {
      ElMessage.error(error.response?.data?.error || '加载待审批列表失败');
    }
    return false;
  } finally {
    loading.value = false;

    if (queuedRealtimeRefresh.value) {
      queuedRealtimeRefresh.value = false;
      Promise.resolve().then(() => handleRealtimeRefresh());
    }
  }
}

async function handleManualRefresh() {
  realtimeRefreshRetrying.value = false;
  approvalSyncErrorMessage.value = '';
  await loadData();
}

function resetApprovalState() {
  approvalAction.value = '';
  pendingStatus.value = '';
  dialogTitle.value = '';
  approvalForm.value.comment = '';
}

function handleDialogVisibleChange(visible) {
  dialogVisible.value = visible;
  if (!visible) {
    resetApprovalState();
  }
}

function openApprovalDialog(row, action) {
  currentLeave.value = row;
  approvalForm.value.comment = '';
  approvalAction.value = action;
  pendingStatus.value = action === 'approve-with-comment' ? 'approved' : 'rejected';
  dialogTitle.value = action === 'approve-with-comment' ? '同意并备注' : '不同意请假';
  dialogVisible.value = true;
}

async function submitApproval({ leave, status, comment, successMessage, closeDialog = false }) {
  submitting.value = true;
  pendingStatus.value = status;

  try {
    const payload = { status };
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    if (trimmedComment) {
      payload.comment = trimmedComment;
    }

    await approveLeave(leave.id, payload);
    ElMessage.success(successMessage);

    if (closeDialog) {
      dialogVisible.value = false;
      resetApprovalState();
    }

    await loadData();
  } catch (error) {
    if (error.response?.status !== 401) {
      ElMessage.error(error.response?.data?.error || '审批失败');
    }
  } finally {
    submitting.value = false;
    pendingStatus.value = '';
  }
}

async function approveWithoutComment(row) {
  currentLeave.value = row;
  await submitApproval({
    leave: row,
    status: 'approved',
    comment: '',
    successMessage: '已同意请假'
  });
}

async function confirmApproval() {
  if (!currentLeave.value) {
    return;
  }

  const approveWithComment = approvalAction.value === 'approve-with-comment';
  await submitApproval({
    leave: currentLeave.value,
    status: approveWithComment ? 'approved' : 'rejected',
    comment: approvalForm.value.comment,
    successMessage: approveWithComment ? '已同意并备注' : '已处理为不同意',
    closeDialog: true
  });
}

async function handleRealtimeRefresh() {
  if (!notificationStore.needsApprovalRefresh) {
    return;
  }

  if (loading.value) {
    queuedRealtimeRefresh.value = true;
    return;
  }

  approvalSyncErrorMessage.value = '';

  const refreshed = await loadData({ silent: true });
  if (!refreshed) {
    realtimeRefreshRetrying.value = true;
    const retried = await loadData({ silent: true });
    realtimeRefreshRetrying.value = false;

    if (!retried) {
      approvalSyncErrorMessage.value = '检测到新审批，但自动刷新未完成，请手动刷新同步。';

      if (notificationStore.latestSummary) {
        ElMessage.warning(`${notificationStore.latestSummary}，列表同步失败，请手动刷新`);
      } else {
        ElMessage.warning('待审批列表自动刷新失败，请手动刷新');
      }
      return;
    }
  }

  if (notificationStore.latestSummary) {
    ElMessage.info(notificationStore.latestSummary);
  }
}

watch(
  () => notificationStore.lastLeaveRequestId,
  async (currentId, previousId) => {
    if (!currentId || currentId === previousId) {
      return;
    }

    await handleRealtimeRefresh();
  }
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped>
.approval-page {
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

.approval-shell {
  min-height: 100%;
}

:deep(.glass-card .el-card__header) {
  border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important;
}

.card-header,
.dialog-footer,
.action-buttons {
  display: flex;
}

.card-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.card-header__main {
  min-width: 0;
  flex: 1 1 auto;
}

.card-header__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.info-trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6b7fa5;
  background: transparent;
  flex: 0 0 auto;
}

.info-trigger svg {
  width: 18px;
  height: 18px;
}

.info-popover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-popover__title {
  color: #12316f;
  font-size: 13px;
  font-weight: 700;
}

.info-popover__text {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: #5c739e;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  color: #12316f;
}

.quick-statistics-link {
  margin: 8px 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.approval-sync-status {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.5;
}

.approval-sync-status--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.approval-sync-status__action {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.approval-sync-status__action:disabled {
  cursor: default;
  opacity: 0.55;
}

:deep(.pending-count-tag.el-tag) {
  min-height: 30px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.approval-list {
  min-height: 240px;
}

.approval-list__items {
  display: grid;
  gap: 16px;
}

.approval-item {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(219, 234, 254, 0.92);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(239, 246, 255, 0.86) 100%);
  box-shadow:
    0 16px 34px rgba(148, 163, 184, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.approval-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.approval-item__identity {
  min-width: 0;
}

.approval-item__name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: #12316f;
}

.approval-item__submitted {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6a80a6;
}

.approval-item__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.approval-item__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}

.approval-item__hero,
.approval-item__reason {
  padding: 14px 15px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(191, 219, 254, 0.72);
}

.approval-item__label {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #6d83aa;
}

.approval-item__hero-text {
  display: block;
  font-size: 15px;
  line-height: 1.55;
  color: #173b7a;
}

.approval-item__meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.approval-item__meta {
  min-width: 0;
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(219, 234, 254, 0.34);
  border: 1px solid rgba(191, 219, 254, 0.7);
}

.approval-item__meta-label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #7186ab;
}

.approval-item__meta-value {
  display: block;
  font-size: 13px;
  line-height: 1.5;
  color: #173b7a;
  word-break: break-word;
}

.approval-item__reason p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #234376;
  white-space: pre-wrap;
  word-break: break-word;
}

.approval-item__actions {
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-footer {
  justify-content: flex-end;
  gap: 12px;
}

:deep(.approval-item__tags .el-tag) {
  font-size: 13px;
}

@media (max-width: 900px) {
  .approval-item {
    padding: 16px;
    border-radius: 20px;
  }
}

@media (max-width: 640px) {
  .card-header {
    position: relative;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding-right: 82px;
  }

  .card-header__main {
    width: 100%;
  }

  .card-header__title-row {
    justify-content: flex-start;
    gap: 8px;
  }

  .quick-statistics-link {
    align-self: flex-start;
  }

  .card-header__actions {
    width: auto;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0;
  }

  .card-header__actions :deep(.pending-count-tag.el-tag) {
    margin-right: 0;
  }

  .card-header__actions :deep(.el-button) {
    flex: 0 0 auto;
    position: absolute;
    top: 50%;
    right: 0;
    margin-left: 0;
    transform: translateY(-50%);
  }

  .approval-item__top {
    flex-direction: column;
  }

  .approval-item__tags {
    justify-content: flex-start;
  }

  .approval-item__meta-grid {
    grid-template-columns: 1fr;
  }

  .approval-item__actions {
    justify-content: stretch;
  }

  .approval-item__actions :deep(.el-button) {
    flex: 1 1 calc(50% - 8px);
    min-width: 116px;
    margin-left: 0;
  }
}
</style>
