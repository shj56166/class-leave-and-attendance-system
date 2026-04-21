<template>
  <div class="statistics-page">
    <el-card class="glass-card counselor-card">
      <template #header>
        <div class="card-header">
          <div class="card-header__main">
            <div class="card-header__title-row">
              <h2>今日统计</h2>
              <el-popover
                placement="bottom-end"
                trigger="click"
                :width="260"
                popper-class="teacher-page-popover"
              >
                <template #reference>
                  <button type="button" class="info-trigger" aria-label="查看今日统计说明">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                      <circle cx="12" cy="8" r="1.1" fill="currentColor" />
                      <path d="M12 11.2V16.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </template>
                <div class="info-popover">
                  <strong class="info-popover__title">今日统计说明</strong>
                  <p class="info-popover__text">
                    这里会集中查看今日请假、周末回家与当前宿舍态势，并支持一键复制关键信息给教官，方便快速汇总和转发。
                  </p>
                </div>
              </el-popover>
            </div>
          </div>
        </div>
      </template>

      <div v-loading="panelLoading">
        <div
          class="panel-switch"
          :style="{ '--panel-switch-count': panelTabs.length }"
        >
          <span class="panel-switch__track" aria-hidden="true">
            <span class="panel-switch__indicator" :style="panelSwitchIndicatorStyle" />
          </span>
          <button
            v-for="item in panelTabs"
            :key="item.value"
            type="button"
            class="panel-switch__item"
            :class="{ 'panel-switch__item--active': activePanel === item.value }"
            @click="activePanel = item.value"
          >
            {{ item.label }}
          </button>
        </div>

        <div v-if="activePanel === 'weekend' && counselorPanel.availableTargets?.length" class="target-switch">
          <button
            v-for="target in counselorPanel.availableTargets"
            :key="target.id"
            type="button"
            class="target-switch__item"
            :class="{ 'target-switch__item--active': selectedTargetId === target.id }"
            @click="handleTargetChange(target.id)"
          >
            <span class="target-switch__title">{{ target.label }}</span>
            <span class="target-switch__meta">{{ target.startDate }} 至 {{ target.endDate }}</span>
          </button>
        </div>

        <template v-if="activePanel === 'today'">
          <section class="panel-section">
            <div class="panel-section__head">
              <div>
                <h3>当前在宿舍</h3>
                <p>复制给教官的名单只会取这里的学生，并自动带上宿舍号。</p>
              </div>
              <div class="panel-section__actions panel-section__actions--emphasis">
                <el-tag class="panel-count-tag" type="success" effect="plain">{{ inDormitory.length }} 人</el-tag>
                <el-button
                  class="teacher-action-button teacher-action-button--primary"
                  type="primary"
                  size="small"
                  :disabled="!activeCopyText"
                  @click="copyCounselorText"
                >
                  一键复制给教官
                </el-button>
              </div>
            </div>

            <div v-if="inDormitory.length" class="student-list">
              <article
                v-for="student in inDormitory"
                :key="`dorm-${student.leaveRequestId}-${student.studentId}`"
                class="student-card student-card--highlight"
              >
                <div>
                  <div class="student-card__title">{{ student.studentName }}</div>
                  <div v-if="student.metaText" class="student-card__meta">{{ student.metaText }}</div>
                </div>
                <div class="student-card__side">
                  <div class="student-card__dorm">{{ student.dormitoryName || '未分配宿舍' }}</div>
                </div>
              </article>
            </div>
            <el-empty v-else description="当前没有宿舍内请假学生" />
          </section>

          <section class="panel-section">
            <div class="panel-section__head">
              <div>
                <h3>教室学生核对</h3>
                <p>显示今天最新一条班干提交结果；只展示未到、旷课和待审批疑问名单。</p>
              </div>
            </div>

            <article v-if="todayClassroomCheck" class="classroom-check-card">
              <div class="classroom-check-card__top">
                <div>
                  <h4>{{ todayClassroomCheck.submittedByName }} · {{ formatDateTime(todayClassroomCheck.submittedAt) }}</h4>
                  <p>{{ todayClassroomCheck.slotLabel || '非课节时段提交' }}</p>
                </div>
                <el-button
                  class="teacher-action-button teacher-action-button--primary"
                  type="primary"
                  size="small"
                  @click="copyText(todayClassroomCheck.teacherCopyText, '已复制教室核对结果')"
                >
                  一键复制
                </el-button>
              </div>

              <div class="classroom-check-row">
                <span class="classroom-check-row__label">未到名单</span>
                <p>{{ joinStudentNames(todayClassroomCheck.selectedStudents) }}</p>
              </div>

              <div class="classroom-check-row">
                <span class="classroom-check-row__label classroom-check-row__label--danger">旷课名单</span>
                <p class="classroom-check-row__value--danger">{{ joinStudentNames(todayClassroomCheck.truancyStudents) }}</p>
              </div>

              <div v-if="todayClassroomCheck.questionStudents?.length" class="classroom-check-row">
                <span class="classroom-check-row__label classroom-check-row__label--warning">疑问名单</span>
                <p>{{ joinStudentNames(todayClassroomCheck.questionStudents) }}</p>
              </div>
            </article>
            <el-empty v-else description="今天还没有班干提交教室核对" />
          </section>

          <section class="panel-section">
            <div class="panel-section__head">
              <div>
                <h3>当前请假</h3>
                <p>按宿舍查看当前请假情况，点击宿舍卡片可在下方直接展开详细学生信息。</p>
              </div>
              <div class="panel-section__actions panel-section__actions--emphasis">
                <button
                  type="button"
                  class="panel-action-link"
                  :class="{ 'panel-action-link--active': todayDetailMode === 'all' }"
                  :disabled="!todayLeaves.length"
                  @click="showAllTodayLeaves"
                >
                  查看全部 {{ todayLeaves.length }} 人
                </button>
              </div>
            </div>

            <div v-if="todayLeaveDormSummary.length" class="dorm-grid">
              <article
                v-for="dorm in todayLeaveDormSummary"
                :key="`today-${dorm.dormitoryId ?? 'none'}`"
                class="dorm-card dorm-card--interactive"
                :class="{ 'dorm-card--active': isSelectedTodayDorm(dorm) }"
                role="button"
                tabindex="0"
                @click="toggleDormDetail(dorm)"
                @keydown.enter.prevent="toggleDormDetail(dorm)"
                @keydown.space.prevent="toggleDormDetail(dorm)"
              >
                <div class="dorm-card__top">
                  <div>
                    <h4>{{ dorm.dormitoryName }}</h4>
                    <p>宿舍总人数 {{ dorm.totalMembers }} 人</p>
                  </div>
                  <el-tag :type="dorm.matchCount ? 'danger' : 'info'" effect="plain">
                    请假 {{ dorm.matchCount }} 人
                  </el-tag>
                </div>
                <div class="dorm-card__students">
                  <span v-if="dorm.students.length">{{ dorm.students.map((student) => student.studentName).join('、') }}</span>
                  <span v-else>当前无命中学生</span>
                </div>
                <div class="dorm-card__hint">点击查看详细信息</div>
              </article>
            </div>
            <el-empty v-else description="当前没有正在请假的学生" />

            <div v-if="todayLeaveDormSummary.length" class="today-detail">
              <div class="today-detail__head">
                <div>
                  <h4>{{ todayDetailTitle }}</h4>
                  <p>{{ todayDetailDescription }}</p>
                </div>
                <el-tag v-if="todayDetailMode" type="primary" effect="plain">{{ selectedTodayDetailStudents.length }} 人</el-tag>
              </div>

              <div v-if="todayDetailMode && selectedTodayDetailStudents.length" class="student-list">
                <article
                  v-for="student in selectedTodayDetailStudents"
                  :key="`detail-${todayDetailMode}-${selectedTodayDetailDormKey}-${student.leaveRequestId}-${student.studentId}`"
                  class="student-card"
                >
                  <div>
                    <div class="student-card__title">{{ student.studentName }}</div>
                    <div v-if="student.metaText" class="student-card__meta">{{ student.metaText }}</div>
                  </div>
                  <div class="student-card__side">
                    <div class="student-card__time">{{ formatTimeRange(student.startTime, student.endTime) }}</div>
                    <div class="student-card__dorm">{{ student.dormitoryName || '未分配宿舍' }}</div>
                  </div>
                </article>
              </div>
              <el-empty
                v-else-if="todayDetailMode"
                :description="todayDetailMode === 'all' ? '当前没有正在请假的学生' : `${todayDetailTitle}暂无请假学生`"
              />
              <div v-else class="today-detail__placeholder">
                点击上方宿舍卡片查看该宿舍当前请假详情，或使用“查看全部”浏览完整名单。
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="panel-section">
            <div class="panel-section__head">
              <div>
                <h3>周末 / 节假日回家</h3>
                <p>这里只统计已经提交的回家报备，并按所选目标聚合。</p>
              </div>
              <div class="panel-section__actions panel-section__actions--emphasis">
                <el-tag class="panel-count-tag" type="warning" effect="plain">{{ weekendStudents.length }} 人</el-tag>
                <el-button
                  class="teacher-action-button teacher-action-button--primary"
                  type="primary"
                  size="small"
                  :disabled="!activeCopyText"
                  @click="copyCounselorText"
                >
                  一键复制给教官
                </el-button>
              </div>
            </div>

            <div v-if="weekendStudents.length" class="student-list">
              <article v-for="student in weekendStudents" :key="`${student.leaveRequestId}-${student.studentId}`" class="student-card">
                <div>
                  <div class="student-card__title">{{ student.studentName }}</div>
                  <div v-if="student.metaText" class="student-card__meta">{{ student.metaText }}</div>
                </div>
                <div class="student-card__side">
                  <div class="student-card__time">{{ student.startDate }} 至 {{ student.endDate }}</div>
                  <div class="student-card__dorm">{{ student.dormitoryName || '未分配宿舍' }}</div>
                </div>
              </article>
            </div>
            <el-empty v-else description="当前目标下还没有回家报备学生" />
          </section>

          <section class="panel-section">
            <div class="panel-section__head">
              <div>
                <h3>宿舍回家态势</h3>
                <p>按宿舍查看回家人数和对应名单，未分配宿舍会单独显示。</p>
              </div>
            </div>

            <div v-if="weekendDormSummary.length" class="dorm-grid">
              <article v-for="dorm in weekendDormSummary" :key="`weekend-${dorm.dormitoryId ?? 'none'}`" class="dorm-card">
                <div class="dorm-card__top">
                  <div>
                    <h4>{{ dorm.dormitoryName }}</h4>
                    <p>宿舍总人数 {{ dorm.totalMembers }} 人</p>
                  </div>
                  <el-tag :type="dorm.matchCount ? 'success' : 'info'" effect="plain">
                    回家 {{ dorm.matchCount }} 人
                  </el-tag>
                </div>
                <div class="dorm-card__students">
                  <span v-if="dorm.students.length">{{ dorm.students.map((student) => student.studentName).join('、') }}</span>
                  <span v-else>当前无命中学生</span>
                </div>
              </article>
            </div>
            <el-empty v-else description="暂无宿舍回家统计数据" />
          </section>
        </template>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getCounselorPanel } from '../api/teacher';
import { copyText as copyTextWithFallback } from '../utils/copyText';

const activePanel = ref('today');
const selectedTargetId = ref('');
const todayDetailMode = ref('');
const selectedDormitoryId = ref('');
const panelLoading = ref(false);
const counselorPanel = ref({
  defaultView: 'today',
  availableTargets: [],
  today: {
    dayPart: 'morning',
    currentLeaves: [],
    inDormitory: [],
    dormSummary: [],
    copyText: '',
    classroomCheck: null
  },
  weekend: {
    selectedTarget: null,
    students: [],
    dormSummary: [],
    copyText: ''
  }
});

const panelTabs = [
  { value: 'today', label: '今日请假' },
  { value: 'weekend', label: '周末回家' }
];

const activePanelIndex = computed(() => {
  const currentIndex = panelTabs.findIndex((item) => item.value === activePanel.value);
  return currentIndex >= 0 ? currentIndex : 0;
});

const panelSwitchIndicatorStyle = computed(() => ({
  width: `calc((100% - ${(panelTabs.length - 1) * 6}px) / ${panelTabs.length})`,
  transform: `translateX(calc(${activePanelIndex.value} * (100% + 6px)))`
}));

const todayLeaves = computed(() => {
  const modeTextMap = {
    today: '当天请假',
    custom: '其他请假'
  };
  const locationTextMap = {
    dormitory: '宿舍',
    classroom: '教室',
    home: '家中',
    other: '其他'
  };

  return (counselorPanel.value.today?.currentLeaves || []).map((item) => ({
    ...item,
    requestModeLabel: modeTextMap[item.requestMode] || item.requestMode || '',
    currentLocationLabel: locationTextMap[item.currentLocation] || '',
    metaText: [modeTextMap[item.requestMode] || item.requestMode || '', locationTextMap[item.currentLocation] || '']
      .filter(Boolean)
      .join(' · ')
  }));
});

const inDormitory = computed(() => (counselorPanel.value.today?.inDormitory || []).map((item) => ({
  ...item,
  metaText: item.currentLocation === 'dormitory' ? '宿舍内请假' : ''
})));

const todayDormSummary = computed(() => counselorPanel.value.today?.dormSummary || []);
const todayLeaveDormSummary = computed(() => todayDormSummary.value.map((dorm) => {
  const dormitoryKey = dorm.dormitoryId ?? '';
  const students = todayLeaves.value.filter((student) => (student.dormitoryId ?? '') === dormitoryKey);
  return {
    ...dorm,
    matchCount: students.length,
    students
  };
}));

const weekendStudents = computed(() => (counselorPanel.value.weekend?.students || []).map((item) => ({
  ...item,
  metaText: ''
})));
const weekendDormSummary = computed(() => counselorPanel.value.weekend?.dormSummary || []);
const todayClassroomCheck = computed(() => counselorPanel.value.today?.classroomCheck || null);

const activeCopyText = computed(() => (
  activePanel.value === 'today'
    ? counselorPanel.value.today?.copyText || ''
    : counselorPanel.value.weekend?.copyText || ''
));

const selectedTodayDorm = computed(() => (
  todayDetailMode.value === 'dorm'
    ? todayLeaveDormSummary.value.find((dorm) => (dorm.dormitoryId ?? '') === selectedDormitoryId.value) || null
    : null
));

const selectedTodayDetailStudents = computed(() => {
  if (todayDetailMode.value === 'all') {
    return todayLeaves.value;
  }

  if (todayDetailMode.value === 'dorm') {
    return todayLeaves.value.filter((student) => (student.dormitoryId ?? '') === selectedDormitoryId.value);
  }

  return [];
});

const selectedTodayDetailDormKey = computed(() => (
  todayDetailMode.value === 'dorm'
    ? selectedDormitoryId.value || 'none'
    : 'all'
));

const todayDetailTitle = computed(() => {
  if (todayDetailMode.value === 'all') {
    return '全部当前请假';
  }

  if (todayDetailMode.value === 'dorm') {
    return `${selectedTodayDorm.value?.dormitoryName || '未分配宿舍'} · 当前请假详情`;
  }

  return '请假详情';
});

const todayDetailDescription = computed(() => {
  if (todayDetailMode.value === 'all') {
    return '当前为全部请假视图，可快速查看所有正在请假的学生。';
  }

  if (todayDetailMode.value === 'dorm') {
    return '已切换为宿舍详情视图，点击其他宿舍卡片可直接替换内容。';
  }

  return '点击宿舍卡片后，这里会显示该宿舍当前请假的详细学生信息。';
});

function syncTodayDetailState() {
  if (todayDetailMode.value === 'all') {
    return;
  }

  const hasSelectedDorm = todayLeaveDormSummary.value.some((dorm) => (dorm.dormitoryId ?? '') === selectedDormitoryId.value);
  if (todayDetailMode.value === 'dorm' && hasSelectedDorm) {
    return;
  }

  todayDetailMode.value = '';
  selectedDormitoryId.value = '';
}

async function loadCounselorPanel(targetId = '') {
  panelLoading.value = true;
  try {
    const response = await getCounselorPanel(targetId ? { targetId } : undefined);
    counselorPanel.value = response;
    selectedTargetId.value = response.weekend?.selectedTarget?.id || response.availableTargets?.[0]?.id || '';
    syncTodayDetailState();
    if (!targetId) {
      activePanel.value = response.defaultView || 'today';
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '加载今日统计失败');
  } finally {
    panelLoading.value = false;
  }
}

async function handleTargetChange(targetId) {
  if (!targetId || targetId === selectedTargetId.value) {
    return;
  }
  selectedTargetId.value = targetId;
  await loadCounselorPanel(targetId);
}

function joinStudentNames(items = []) {
  return items.length ? items.map((item) => item.studentName).join('、') : '无';
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('zh-CN');
}

async function copyText(text, successMessage = '已复制') {
  if (!text) {
    return;
  }

  try {
    const copied = await copyTextWithFallback(text);
    if (!copied) {
      return;
    }
    ElMessage.success(successMessage);
  } catch (error) {
    ElMessage.error('复制失败，请手动复制');
  }
}

async function copyCounselorText() {
  await copyText(activeCopyText.value, '已复制给教官');
}

function isSelectedTodayDorm(dorm) {
  return todayDetailMode.value === 'dorm' && (dorm.dormitoryId ?? '') === selectedDormitoryId.value;
}

function toggleDormDetail(dorm) {
  const dormitoryKey = dorm.dormitoryId ?? '';
  if (todayDetailMode.value === 'dorm' && selectedDormitoryId.value === dormitoryKey) {
    todayDetailMode.value = '';
    selectedDormitoryId.value = '';
    return;
  }

  todayDetailMode.value = 'dorm';
  selectedDormitoryId.value = dormitoryKey;
}

function showAllTodayLeaves() {
  if (!todayLeaves.value.length) {
    return;
  }

  todayDetailMode.value = 'all';
  selectedDormitoryId.value = '';
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return '-';
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  return `${start.toLocaleString('zh-CN')} 至 ${end.toLocaleString('zh-CN')}`;
}

onMounted(() => {
  loadCounselorPanel();
});
</script>

<style scoped>
.statistics-page {
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
  justify-content: space-between;
  align-items: flex-start;
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
  line-height: 1.65;
  color: #5c739e;
  font-size: 12px;
}

.card-header h2 {
  margin: 0;
  color: #12316f;
  font-size: 20px;
}

.panel-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0 0 8px;
  gap: 6px;
  border-radius: 0;
  background: transparent;
  border: none;
  isolation: isolate;
}

.panel-switch__track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 999px;
  background: rgba(191, 219, 254, 0.92);
  overflow: hidden;
  pointer-events: none;
}

.panel-switch__indicator {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22), 0 8px 18px rgba(37, 99, 235, 0.3);
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.panel-switch__item {
  position: relative;
  z-index: 1;
  min-width: 98px;
  min-height: 34px;
  border: none;
  border-radius: 10px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #6b7f9f;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
}

.panel-switch__item:hover {
  color: #315a95;
}

.panel-switch__item--active {
  color: #1d4ed8;
}

.panel-switch__item:focus-visible {
  outline: none;
  color: #12316f;
}

@media (prefers-reduced-motion: reduce) {
  .panel-switch__indicator,
  .panel-switch__item {
    transition-duration: 0.01ms !important;
  }
}

.target-switch {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.target-switch__item {
  border: 1px solid rgba(191, 219, 254, 0.96);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  padding: 12px 14px;
  min-width: 180px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.target-switch__item--active {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(240, 253, 244, 0.88);
}

.target-switch__title {
  display: block;
  font-weight: 700;
  color: #12316f;
  font-size: 13px;
}

.target-switch__meta {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #64748b;
}

.panel-section {
  margin-top: 20px;
}

.panel-section__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 12px;
}

.panel-section__head h3 {
  margin: 0;
  color: #12316f;
  font-size: 17px;
}

.panel-section__head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.panel-section__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.panel-section__actions--emphasis {
  gap: 12px;
}

.panel-action-link {
  border: none;
  background: transparent;
  padding: 0;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

.panel-action-link:hover:not(:disabled) {
  color: #1d4ed8;
  transform: translateY(-1px);
}

.panel-action-link:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.panel-action-link--active {
  color: #12316f;
}

:deep(.panel-count-tag.el-tag) {
  font-size: 13px;
  padding: 0 12px;
  min-height: 30px;
}

.classroom-check-card {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 248, 233, 0.92) 0%, rgba(255, 255, 255, 0.82) 100%);
  border: 1px solid rgba(255, 214, 153, 0.68);
  box-shadow: 0 14px 28px rgba(245, 158, 11, 0.12);
}

.classroom-check-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.classroom-check-card__top h4 {
  margin: 0;
  font-size: 16px;
  color: #8a4311;
}

.classroom-check-card__top p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #a16207;
}

.classroom-check-row {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(217, 119, 6, 0.22);
}

.classroom-check-row__label {
  display: inline-flex;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #8a4311;
  background: rgba(255, 255, 255, 0.72);
}

.classroom-check-row__label--danger {
  color: #b42318;
}

.classroom-check-row__label--warning {
  color: #b45309;
}

.classroom-check-row p {
  margin: 10px 0 0;
  color: #6b3f14;
  line-height: 1.7;
  font-size: 14px;
}

.classroom-check-row__value--danger {
  color: #b42318 !important;
}

.student-list {
  display: grid;
  gap: 12px;
}

.student-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(219, 234, 254, 0.9);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
}

.student-card--highlight {
  background: rgba(240, 253, 244, 0.8);
  border-color: rgba(187, 247, 208, 0.95);
}

.student-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #12316f;
}

.student-card__meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.student-card__side {
  text-align: right;
  min-width: 200px;
}

.student-card__time {
  color: #315a95;
  font-size: 12px;
  line-height: 1.5;
}

.student-card__dorm {
  margin-top: 8px;
  font-weight: 700;
  font-size: 13px;
  color: #1d4ed8;
}

.dorm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.dorm-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(219, 234, 254, 0.92);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
}

.dorm-card--interactive {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.dorm-card--interactive:hover {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.95);
  box-shadow: 0 14px 30px rgba(96, 165, 250, 0.14);
}

.dorm-card--interactive:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.45);
  outline-offset: 2px;
}

.dorm-card--active {
  border-color: rgba(37, 99, 235, 0.85);
  background: rgba(239, 246, 255, 0.92);
  box-shadow: 0 16px 32px rgba(59, 130, 246, 0.18);
}

.dorm-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.dorm-card__top h4 {
  margin: 0;
  color: #12316f;
  font-size: 15px;
}

.dorm-card__top p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}

.dorm-card__students {
  margin-top: 14px;
  color: #315a95;
  font-size: 13px;
  line-height: 1.7;
  min-height: 48px;
}

.dorm-card__hint {
  margin-top: 12px;
  color: #64748b;
  font-size: 12px;
}

.today-detail {
  margin-top: 16px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.82);
  border: 1px solid rgba(191, 219, 254, 0.72);
}

.today-detail__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.today-detail__head h4 {
  margin: 0;
  color: #12316f;
  font-size: 15px;
}

.today-detail__head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.today-detail__placeholder {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .panel-switch {
    width: 100%;
  }

  .panel-switch__item {
    min-width: 0;
    flex: 1 1 0;
    justify-content: center;
  }

  .card-header,
  .panel-section__head,
  .classroom-check-card__top,
  .student-card,
  .today-detail__head {
    flex-direction: column;
  }

  .panel-section__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .student-card__side {
    min-width: 0;
    text-align: left;
  }
}
</style>
