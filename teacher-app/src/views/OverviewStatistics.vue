<template>
  <div class="overview-statistics-page">
    <el-card class="glass-card overview-hero">
      <template #header>
        <div class="card-header">
          <div>
            <h2>总览统计</h2>
            <p>按周、月、学期查看班级请假与旷课的综合风险，顶部摘要、排行和课程卡统一按联合口径展示。</p>
          </div>
          <div class="card-header__actions">
            <div class="period-switch">
              <button
                v-for="item in periodTabs"
                :key="item.value"
                type="button"
                class="period-switch__item"
                :class="{ 'period-switch__item--active': activePeriod === item.value }"
                @click="handlePeriodChange(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="exporting" @click="handleExport">导出 Excel</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <div class="overview-meta">
          <span class="overview-meta__label">统计窗口</span>
          <strong>{{ overviewData.windowLabel || '-' }}</strong>
        </div>

        <div class="summary-grid summary-grid--dense">
          <article v-for="card in summaryCards" :key="card.title" class="summary-card summary-card--dense">
            <div class="summary-card__title-row">
              <h3>{{ card.title }}</h3>
              <span>{{ card.subtitle }}</span>
            </div>
            <div class="summary-card__rows">
              <div v-for="row in card.rows" :key="row.label" class="summary-card__row">
                <span class="summary-card__row-label">{{ row.label }}</span>
                <div class="summary-card__row-values">
                  <strong>{{ row.primary }}</strong>
                  <span>{{ row.secondary }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </el-card>

    <div class="overview-main-grid">
      <el-card class="glass-card">
        <template #header>
          <div class="card-header">
            <div>
              <h2>趋势总览</h2>
              <p>统一观察请假节次、旷课次数和疑问次数的时间变化。</p>
            </div>
          </div>
        </template>
        <div ref="trendChartRef" class="chart-panel"></div>
      </el-card>

      <el-card class="glass-card ranking-card">
        <template #header>
          <div class="card-header">
            <div>
              <h2>风险排行</h2>
              <p>同一行同时展示请假和旷课指标，默认优先看旷课，再看请假。</p>
            </div>
          </div>
        </template>

        <div class="ranking-grid">
          <section v-for="group in rankingGroups" :key="group.title" class="ranking-block">
            <div class="ranking-block__head">
              <h3>{{ group.title }}</h3>
              <span>{{ group.items.length }} 项</span>
            </div>
            <ol class="ranking-list" :class="{ 'ranking-list--compact': group.compact }">
              <li v-for="item in group.items" :key="`${group.title}-${item.key}`">
                <div>
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.meta }}</span>
                </div>
                <span>{{ formatRiskText(item) }}</span>
              </li>
            </ol>
          </section>
        </div>
      </el-card>
    </div>

    <div class="overview-distribution-grid">
      <el-card class="glass-card">
        <template #header>
          <div class="card-header">
            <div>
              <h2>星期分布</h2>
              <p>对比每个工作日里的请假人/天和旷课节次。</p>
            </div>
          </div>
        </template>
        <div ref="weekdayChartRef" class="chart-panel chart-panel--short"></div>
      </el-card>

      <el-card class="glass-card">
        <template #header>
          <div class="card-header">
            <div>
              <h2>请假类型分布</h2>
              <p>这里只统计请假申请结构，作为综合风险的补充维度。</p>
            </div>
          </div>
        </template>
        <div ref="leaveTypeChartRef" class="chart-panel chart-panel--short"></div>
      </el-card>

      <el-card class="glass-card course-risk-card">
        <template #header>
          <div class="card-header">
            <div>
              <h2>课程风险</h2>
              <p>课程条同时显示请假概率/次数和旷课次数，不再拆成独立旷课卡。</p>
            </div>
            <div class="card-header__actions">
              <div class="period-switch period-switch--small">
                <button
                  v-for="item in probabilityTabs"
                  :key="item.value"
                  type="button"
                  class="period-switch__item"
                  :class="{ 'period-switch__item--active': courseProbabilityMode === item.value }"
                  @click="courseProbabilityMode = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <div ref="courseRiskChartRef" class="chart-panel chart-panel--short"></div>
        <div class="probability-list">
          <article v-for="item in displayedCourseRisk" :key="item.key" class="probability-row">
            <div>
              <strong>{{ item.label }}</strong>
              <p>{{ formatCourseLeaveText(item) }}</p>
            </div>
            <div class="probability-row__metrics">
              <span class="probability-row__metric">{{ formatCourseTruancyText(item) }}</span>
              <span class="probability-row__metric probability-row__metric--muted">{{ item.meta }}</span>
            </div>
          </article>
        </div>
      </el-card>
    </div>

    <el-card class="glass-card student-panel-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>学生视角</h2>
            <p>选择一个学生，独立查看他在周、月、学期维度下的请假与旷课情况。</p>
          </div>
          <div class="card-header__actions card-header__actions--stretch">
            <button
              type="button"
              class="student-picker-trigger"
              @click="openStudentPicker"
            >
              <span class="student-picker-trigger__label">选择学生</span>
              <strong>{{ selectedStudentOption?.label || '未选择' }}</strong>
            </button>
            <button
              v-if="selectedStudentId"
              type="button"
              class="student-picker-clear"
              @click="clearStudentSelection"
            >
              清空
            </button>

            <div class="period-switch period-switch--small">
              <button
                v-for="item in periodTabs"
                :key="`student-${item.value}`"
                type="button"
                class="period-switch__item"
                :class="{ 'period-switch__item--active': studentPeriod === item.value }"
                @click="studentPeriod = item.value"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <div v-if="!selectedStudentId" class="student-empty">
        先选择一个学生，这里会显示他的请假摘要、旷课摘要和趋势图，并提供跳转到记录/日志页的快捷入口。
      </div>

      <div v-else v-loading="studentLoading" class="student-panel">
        <div class="student-panel__top">
          <div>
            <h3>{{ studentOverview.student?.studentName || '-' }}</h3>
            <p>{{ studentOverview.student?.studentNumber || '未填写学号' }} · {{ studentOverview.student?.dormitoryName || '未分配宿舍' }}</p>
            <p v-if="studentOverview.student?.isReadonly" class="student-readonly-note">
              {{ studentOverview.student?.readonlyReason || '该学生已停用，当前仅提供历史只读视图。' }}
            </p>
          </div>
          <button type="button" class="student-link" @click="goToStudentRecords">查看该生记录/日志</button>
        </div>

        <div class="student-summary-grid">
          <article class="student-summary-card"><span>请假申请</span><strong>{{ studentOverview.summary?.leaveRequestCount ?? 0 }}</strong></article>
          <article class="student-summary-card"><span>请假天数</span><strong>{{ studentOverview.summary?.leaveDays ?? 0 }}</strong></article>
          <article class="student-summary-card"><span>请假节次</span><strong>{{ studentOverview.summary?.leavePeriods ?? 0 }}</strong></article>
          <article class="student-summary-card"><span>旷课次数</span><strong>{{ studentOverview.summary?.truancyCount ?? 0 }}</strong></article>
          <article class="student-summary-card"><span>疑问次数</span><strong>{{ studentOverview.summary?.questionCount ?? 0 }}</strong></article>
        </div>

        <div class="student-panel__meta">
          <span>学生统计窗口</span>
          <strong>{{ studentOverview.windowLabel || '-' }}</strong>
        </div>
        <div ref="studentTrendChartRef" class="chart-panel chart-panel--student"></div>
      </div>
    </el-card>

    <ProjectDialog
      v-model="studentPickerVisible"
      title="选择学生"
      width="620px"
      size="xl"
      overlay-class="student-picker-overlay"
      panel-class="student-picker-modal"
      body-class="student-picker-modal__body"
      @after-open="focusStudentSearch"
    >
      <div class="student-picker-search">
        <svg class="student-picker-search__icon" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <input
          ref="studentSearchInput"
          v-model="studentKeyword"
          type="text"
          inputmode="search"
          placeholder="搜索学生姓名、学号或宿舍"
          autocomplete="off"
        />
      </div>

      <button
        v-for="student in filteredStudentOptions"
        :key="student.id"
        type="button"
        class="student-option"
        :class="{ 'student-option--active': Number(selectedStudentId || 0) === Number(student.id) }"
        @click="selectStudent(student.id)"
      >
        <div class="student-option__body">
          <span class="student-option-name">{{ student.student_name }}</span>
          <span class="student-option-meta">
            {{ student.student_number || '未填写学号' }}
            ·
            {{ student.dormitoryName || '未分配宿舍' }}
            <template v-if="student.status === 'inactive'">
              · 已停用 · 只读历史
            </template>
          </span>
        </div>
        <span v-if="Number(selectedStudentId || 0) === Number(student.id)" class="student-option-check">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      <div v-if="filteredStudentOptions.length === 0" class="student-empty-state">
        <p class="student-empty-title">没有找到对应学生</p>
        <p class="student-empty-text">试试输入姓名、学号，或者宿舍号里的关键字</p>
      </div>

      <template #footer>
        <div class="student-picker-footer">
          <span class="student-picker-footer__summary">
            {{ selectedStudentOption ? `当前已选：${selectedStudentOption.label}` : '当前未选择学生' }}
          </span>
          <div class="student-picker-footer__actions">
            <el-button class="teacher-action-button teacher-action-button--secondary" @click="studentPickerVisible = false">关闭</el-button>
            <el-button v-if="selectedStudentId" class="teacher-action-button teacher-action-button--secondary" @click="clearStudentSelection">清空选择</el-button>
          </div>
        </div>
      </template>
    </ProjectDialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import { useRouter } from 'vue-router';
import ProjectDialog from '../components/ProjectDialog.vue';
import {
  exportStats,
  getOverviewStatistics,
  getStudentOverviewStatistics,
  getStudentsEnhanced
} from '../api/teacher';
import { parseRequestErrorMessage } from '../utils/request';

const router = useRouter();
const periodTabs = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'semester', label: '学期' }
];
const probabilityTabs = [
  { value: 'slot', label: '按课程时段' },
  { value: 'subject', label: '按课程名称' }
];

const loading = ref(false);
const studentLoading = ref(false);
const exporting = ref(false);
const activePeriod = ref('week');
const studentPeriod = ref('week');
const courseProbabilityMode = ref('slot');
const selectedStudentId = ref('');
const studentPickerVisible = ref(false);
const studentKeyword = ref('');
const students = ref([]);
const overviewData = ref({
  windowLabel: '',
  summary: {},
  trend: [],
  studentRanking: [],
  dormitoryRanking: [],
  weekdayDistribution: [],
  leaveTypeDistribution: [],
  courseProbability: { bySlot: [], bySubject: [] },
  classroomCheck: { summary: {}, trend: [], studentRanking: [], dormitoryRanking: [], weekdayDistribution: [], slotRanking: [], subjectRanking: [] }
});
const studentOverview = ref({ windowLabel: '', student: null, summary: {}, trend: [] });

const trendChartRef = ref(null);
const weekdayChartRef = ref(null);
const leaveTypeChartRef = ref(null);
const courseRiskChartRef = ref(null);
const studentTrendChartRef = ref(null);
const studentSearchInput = ref(null);
let trendChart = null;
let weekdayChart = null;
let leaveTypeChart = null;
let courseRiskChart = null;
let studentTrendChart = null;

const studentOptions = computed(() => (students.value || []).map((student) => ({
  id: student.id,
  label: `${student.student_name}${student.student_number ? ` · ${student.student_number}` : ''}${student.status === 'inactive' ? ' · 已停用' : ''}`
})));
const selectedStudentOption = computed(() => studentOptions.value.find((student) => Number(student.id) === Number(selectedStudentId.value)) || null);
const filteredStudentOptions = computed(() => {
  const keyword = String(studentKeyword.value || '').trim().toLowerCase();
  if (!keyword) {
    return students.value || [];
  }
  return (students.value || []).filter((student) => (
    String(student.student_name || '').toLowerCase().includes(keyword)
    || String(student.student_number || '').toLowerCase().includes(keyword)
    || String(student.dormitoryName || '').toLowerCase().includes(keyword)
  ));
});

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildCourseSlotRiskKey(item = {}) {
  return [
    normalizeKey(item.subject || item.label),
    item.weekday ?? '',
    item.period ?? '',
    normalizeKey(item.timeRange || item.timeSummary || ''),
    normalizeKey(item.slotKey || '')
  ].join('|');
}

function createMergedRiskItems({ leaveItems = [], truancyItems = [], leaveKey, truancyKey, buildLeave, buildTruancy, sortBy }) {
  const map = new Map();
  leaveItems.forEach((item) => {
    const key = leaveKey(item);
    const current = map.get(key) || { key, leave: null, truancy: null };
    current.leave = buildLeave(item);
    map.set(key, current);
  });
  truancyItems.forEach((item) => {
    const key = truancyKey(item);
    const current = map.get(key) || { key, leave: null, truancy: null };
    current.truancy = buildTruancy(item);
    map.set(key, current);
  });
  return Array.from(map.values()).map((item) => {
    const leave = item.leave || {};
    const truancy = item.truancy || {};
    return {
      key: item.key,
      label: leave.label || truancy.label || '-',
      meta: leave.meta || truancy.meta || '',
      leaveCount: leave.leaveCount || 0,
      leaveProbability: leave.leaveProbability || 0,
      truancyCount: truancy.truancyCount || 0,
      leaveUnit: leave.leaveUnit || '',
      truancyUnit: truancy.truancyUnit || ''
    };
  }).sort(sortBy);
}

const studentRiskTop = computed(() => createMergedRiskItems({
  leaveItems: overviewData.value.studentRanking || [],
  truancyItems: overviewData.value.classroomCheck?.studentRanking || [],
  leaveKey: (item) => item.studentId || `name:${item.studentName}`,
  truancyKey: (item) => item.studentId || `name:${item.studentName}`,
  buildLeave: (item) => ({ label: item.studentName, meta: item.dormitoryName || '未分配宿舍', leaveCount: item.totalPeriods || 0, leaveUnit: '节' }),
  buildTruancy: (item) => ({ label: item.studentName, meta: item.dormitoryName || '未分配宿舍', truancyCount: item.truancyCount || 0, truancyUnit: '节' }),
  sortBy: (left, right) => right.truancyCount - left.truancyCount || right.leaveCount - left.leaveCount
}).slice(0, 5));

const dormitoryRiskTop = computed(() => createMergedRiskItems({
  leaveItems: overviewData.value.dormitoryRanking || [],
  truancyItems: overviewData.value.classroomCheck?.dormitoryRanking || [],
  leaveKey: (item) => item.dormitoryId ?? `name:${item.dormitoryName}`,
  truancyKey: (item) => item.dormitoryId ?? `name:${item.dormitoryName}`,
  buildLeave: (item) => ({ label: item.dormitoryName, meta: `${item.impactedStudents || 0} 人涉及`, leaveCount: item.leavePersonDays || 0, leaveUnit: '人/天' }),
  buildTruancy: (item) => ({ label: item.dormitoryName, meta: `${item.impactedStudents || 0} 人涉及`, truancyCount: item.truancyCount || 0, truancyUnit: '节' }),
  sortBy: (left, right) => right.truancyCount - left.truancyCount || right.leaveCount - left.leaveCount
}).slice(0, 5));

const weekdayRiskTop = computed(() => createMergedRiskItems({
  leaveItems: overviewData.value.weekdayDistribution || [],
  truancyItems: overviewData.value.classroomCheck?.weekdayDistribution || [],
  leaveKey: (item) => item.weekday,
  truancyKey: (item) => item.weekday,
  buildLeave: (item) => ({ label: item.label, meta: '按请假人/天统计', leaveCount: item.leavePersonDays || 0, leaveUnit: '人/天' }),
  buildTruancy: (item) => ({ label: item.label, meta: '按旷课节次统计', truancyCount: item.truancyCount || 0, truancyUnit: '节' }),
  sortBy: (left, right) => right.truancyCount - left.truancyCount || right.leaveCount - left.leaveCount
}).slice(0, 5));

const displayedCourseRisk = computed(() => {
  if (courseProbabilityMode.value === 'subject') {
    return createMergedRiskItems({
      leaveItems: overviewData.value.courseProbability?.bySubject || [],
      truancyItems: overviewData.value.classroomCheck?.subjectRanking || [],
      leaveKey: (item) => normalizeKey(item.subject),
      truancyKey: (item) => normalizeKey(item.subject),
      buildLeave: (item) => ({ label: item.subject, meta: item.timeSummary || '', leaveCount: item.leaveCount || 0, leaveProbability: item.probability || 0, leaveUnit: '人次' }),
      buildTruancy: (item) => ({ label: item.subject, meta: item.timeSummary || '', truancyCount: item.truancyCount || 0, truancyUnit: '人次' }),
      sortBy: (left, right) => right.truancyCount - left.truancyCount || right.leaveProbability - left.leaveProbability || right.leaveCount - left.leaveCount
    }).slice(0, 8);
  }
  return createMergedRiskItems({
    leaveItems: overviewData.value.courseProbability?.bySlot || [],
    truancyItems: overviewData.value.classroomCheck?.slotRanking || [],
    leaveKey: (item) => buildCourseSlotRiskKey(item),
    truancyKey: (item) => buildCourseSlotRiskKey(item),
    buildLeave: (item) => ({ label: item.subject || item.label, meta: item.timeSummary || '', leaveCount: item.leaveCount || 0, leaveProbability: item.probability || 0, leaveUnit: '人次' }),
    buildTruancy: (item) => ({ label: item.subject || item.label, meta: item.timeSummary || '', truancyCount: item.truancyCount || 0, truancyUnit: '人次' }),
    sortBy: (left, right) => right.truancyCount - left.truancyCount || right.leaveProbability - left.leaveProbability || right.leaveCount - left.leaveCount
  }).slice(0, 8);
});

const courseRiskTop = computed(() => displayedCourseRisk.value.slice(0, 5));
const rankingGroups = computed(() => ([
  { title: '学生 Top', items: studentRiskTop.value, compact: false },
  { title: '宿舍 Top', items: dormitoryRiskTop.value, compact: false },
  { title: '星期 Top', items: weekdayRiskTop.value, compact: false },
  { title: '课程 Top', items: courseRiskTop.value, compact: true }
]));

const summaryCards = computed(() => {
  const leaveSummary = overviewData.value.summary || {};
  const truancySummary = overviewData.value.classroomCheck?.summary || {};
  const topStudent = studentRiskTop.value[0] || null;
  const topDormitory = dormitoryRiskTop.value[0] || null;
  const topWeekday = weekdayRiskTop.value[0] || null;
  const topCourse = courseRiskTop.value[0] || null;
  return [
    {
      title: '综合态势', subtitle: '请假与旷课并排看', rows: [
        { label: '请假申请 / 涉及学生', primary: `${leaveSummary.leaveRequestCount ?? 0}`, secondary: `${leaveSummary.impactedStudents ?? 0} 人` },
        { label: '旷课次数 / 疑问次数', primary: `${truancySummary.totalTruancyCount ?? 0}`, secondary: `${truancySummary.totalQuestionCount ?? 0} 次疑问` }
      ]
    },
    {
      title: '重点对象', subtitle: '学生与宿舍', rows: [
        { label: topStudent ? `学生 · ${topStudent.label}` : '学生', primary: topStudent ? formatTaggedMetric('请假', topStudent.leaveCount, topStudent.leaveUnit) : '-', secondary: topStudent ? formatTaggedMetric('旷课', topStudent.truancyCount, topStudent.truancyUnit) : '暂无数据' },
        { label: topDormitory ? `宿舍 · ${topDormitory.label}` : '宿舍', primary: topDormitory ? formatTaggedMetric('请假', topDormitory.leaveCount, topDormitory.leaveUnit) : '-', secondary: topDormitory ? formatTaggedMetric('旷课', topDormitory.truancyCount, topDormitory.truancyUnit) : '暂无数据' }
      ]
    },
    {
      title: '高发规律', subtitle: '星期与课程', rows: [
        { label: topWeekday ? `星期 · ${topWeekday.label}` : '星期', primary: topWeekday ? formatTaggedMetric('请假', topWeekday.leaveCount, topWeekday.leaveUnit) : '-', secondary: topWeekday ? formatTaggedMetric('旷课', topWeekday.truancyCount, topWeekday.truancyUnit) : '暂无数据' },
        { label: topCourse ? `课程 · ${topCourse.label}` : '课程', primary: topCourse ? formatTaggedMetric('请假', topCourse.leaveCount, topCourse.leaveUnit) : '-', secondary: topCourse ? formatTaggedMetric('旷课', topCourse.truancyCount, topCourse.truancyUnit) : '暂无数据' }
      ]
    }
  ];
});

function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(numeric >= 0.1 ? 1 : 2)}%`;
}

function formatMetricValue(value, unit = '') {
  return unit ? `${value} ${unit}` : `${value}`;
}

function formatTaggedMetric(prefix, value, unit = '') {
  return `${prefix} ${formatMetricValue(value, unit)}`;
}

function formatRiskText(item) {
  return `${formatTaggedMetric('请假', item.leaveCount, item.leaveUnit)} / ${formatTaggedMetric('旷课', item.truancyCount, item.truancyUnit)}`;
}

function formatCourseLeaveText(item) {
  return `${formatTaggedMetric('请假', item.leaveCount, item.leaveUnit)} / 概率 ${formatPercent(item.leaveProbability)}`;
}

function formatCourseTruancyText(item) {
  return formatTaggedMetric('旷课', item.truancyCount, item.truancyUnit);
}

function initChart(existingChart, elementRef) {
  if (!elementRef.value) return existingChart;
  return existingChart || echarts.init(elementRef.value);
}

function renderTrendChart() {
  trendChart = initChart(trendChart, trendChartRef);
  if (!trendChart) return;
  trendChart.setOption({
    color: ['#2563eb', '#f97316', '#10b981'],
    legend: { top: 0, textStyle: { color: '#58729c' }, selected: { 疑问次数: false } },
    grid: { left: 36, right: 18, top: 50, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (overviewData.value.trend || []).map((item) => item.label), axisTick: { show: false }, axisLine: { lineStyle: { color: '#bfd6ff' } }, axisLabel: { color: '#58729c' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(191, 214, 255, 0.45)' } }, axisLabel: { color: '#58729c' } },
    series: [
      { name: '请假节次', type: activePeriod.value === 'month' ? 'line' : 'bar', smooth: activePeriod.value === 'month', barMaxWidth: 28, data: (overviewData.value.trend || []).map((item) => item.leavePeriods || 0) },
      { name: '旷课次数', type: 'line', smooth: true, data: (overviewData.value.classroomCheck?.trend || []).map((item) => item.truancyCount || 0) },
      { name: '疑问次数', type: 'line', smooth: true, data: (overviewData.value.classroomCheck?.trend || []).map((item) => item.questionCount || 0) }
    ]
  });
}

function renderWeekdayChart() {
  weekdayChart = initChart(weekdayChart, weekdayChartRef);
  if (!weekdayChart) return;
  weekdayChart.setOption({
    color: ['#3b82f6', '#f97316'],
    legend: { top: 0, textStyle: { color: '#58729c' } },
    grid: { left: 28, right: 18, top: 52, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (overviewData.value.weekdayDistribution || []).map((item) => item.label), axisTick: { show: false }, axisLine: { lineStyle: { color: '#bfd6ff' } }, axisLabel: { color: '#58729c' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(191, 214, 255, 0.45)' } }, axisLabel: { color: '#58729c' } },
    series: [
      { name: '请假人/天', type: 'bar', barMaxWidth: 24, data: (overviewData.value.weekdayDistribution || []).map((item) => item.leavePersonDays || 0), itemStyle: { borderRadius: [10, 10, 0, 0] } },
      { name: '旷课节次', type: 'bar', barMaxWidth: 24, data: (overviewData.value.classroomCheck?.weekdayDistribution || []).map((item) => item.truancyCount || 0), itemStyle: { borderRadius: [10, 10, 0, 0] } }
    ]
  });
}

function renderLeaveTypeChart() {
  leaveTypeChart = initChart(leaveTypeChart, leaveTypeChartRef);
  if (!leaveTypeChart) return;
  leaveTypeChart.setOption({
    color: ['#2563eb', '#f59e0b', '#10b981'],
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['48%', '72%'], label: { color: '#58729c' }, data: (overviewData.value.leaveTypeDistribution || []).map((item) => ({ name: item.label, value: item.totalRequests })) }]
  });
}

function renderCourseRiskChart() {
  courseRiskChart = initChart(courseRiskChart, courseRiskChartRef);
  if (!courseRiskChart) return;
  const rows = displayedCourseRisk.value;
  courseRiskChart.setOption({
    color: ['#1d4ed8', '#f97316'],
    legend: { top: 0, textStyle: { color: '#58729c' } },
    grid: { left: 120, right: 18, top: 48, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', axisLabel: { color: '#58729c', formatter: (value) => `${Math.round(value * 100)}%` }, splitLine: { lineStyle: { color: 'rgba(191, 214, 255, 0.45)' } } },
    yAxis: { type: 'category', axisLabel: { color: '#58729c', width: 108, overflow: 'truncate' }, data: rows.map((item) => item.label) },
    series: [
      { name: '请假概率', type: 'bar', barMaxWidth: 18, data: rows.map((item) => item.leaveProbability || 0), itemStyle: { borderRadius: [0, 10, 10, 0] } },
      { name: '旷课人次', type: 'bar', barMaxWidth: 18, data: rows.map((item) => item.truancyCount || 0), itemStyle: { borderRadius: [0, 10, 10, 0] } }
    ]
  });
}

function renderStudentTrendChart() {
  studentTrendChart = initChart(studentTrendChart, studentTrendChartRef);
  if (!studentTrendChart) return;
  studentTrendChart.setOption({
    color: ['#2563eb', '#f97316', '#10b981'],
    legend: { top: 0, textStyle: { color: '#58729c' }, selected: { 疑问次数: false } },
    grid: { left: 36, right: 18, top: 50, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (studentOverview.value.trend || []).map((item) => item.label), axisTick: { show: false }, axisLine: { lineStyle: { color: '#bfd6ff' } }, axisLabel: { color: '#58729c' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(191, 214, 255, 0.45)' } }, axisLabel: { color: '#58729c' } },
    series: [
      { name: '请假节次', type: 'bar', barMaxWidth: 26, data: (studentOverview.value.trend || []).map((item) => item.leavePeriods || 0) },
      { name: '旷课次数', type: 'line', smooth: true, data: (studentOverview.value.trend || []).map((item) => item.truancyCount || 0) },
      { name: '疑问次数', type: 'line', smooth: true, data: (studentOverview.value.trend || []).map((item) => item.questionCount || 0) }
    ]
  });
}

function renderAllCharts() {
  renderTrendChart();
  renderWeekdayChart();
  renderLeaveTypeChart();
  renderCourseRiskChart();
}

async function loadStudents() {
  try {
    const res = await getStudentsEnhanced();
    students.value = [...(res.students || res || [])].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }
      return String(left.student_name || '').localeCompare(String(right.student_name || ''), 'zh-CN');
    });
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '加载学生列表失败'));
  }
}

async function loadOverview() {
  loading.value = true;
  try {
    overviewData.value = await getOverviewStatistics({ period: activePeriod.value });
    await nextTick();
    renderAllCharts();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '加载总览统计失败'));
  } finally {
    loading.value = false;
  }
}

async function loadStudentOverview() {
  if (!selectedStudentId.value) {
    studentOverview.value = { windowLabel: '', student: null, summary: {}, trend: [] };
    return;
  }
  studentLoading.value = true;
  try {
    studentOverview.value = await getStudentOverviewStatistics({ studentId: selectedStudentId.value, period: studentPeriod.value });
    await nextTick();
    renderStudentTrendChart();
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '加载学生统计失败'));
  } finally {
    studentLoading.value = false;
  }
}

function openStudentPicker() {
  studentPickerVisible.value = true;
}

function selectStudent(studentId) {
  selectedStudentId.value = studentId;
  studentPickerVisible.value = false;
}

function clearStudentSelection() {
  selectedStudentId.value = '';
  studentPickerVisible.value = false;
}

async function focusStudentSearch() {
  await nextTick();
  studentSearchInput.value?.focus();
}

function handlePeriodChange(period) {
  if (period !== activePeriod.value) activePeriod.value = period;
}

async function handleExport() {
  exporting.value = true;
  try {
    const blob = await exportStats({ period: activePeriod.value, studentId: selectedStudentId.value || undefined, studentPeriod: selectedStudentId.value ? studentPeriod.value : undefined });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `总览统计-${activePeriod.value}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error(await parseRequestErrorMessage(error, '导出失败'));
  } finally {
    exporting.value = false;
  }
}

function goToStudentRecords() {
  if (!selectedStudentId.value || !studentOverview.value.student) return;
  router.push({ name: 'AuditLogs', query: { studentId: String(selectedStudentId.value), recordType: 'leave' } });
}

function handleResize() {
  trendChart?.resize();
  weekdayChart?.resize();
  leaveTypeChart?.resize();
  courseRiskChart?.resize();
  studentTrendChart?.resize();
}

watch(activePeriod, loadOverview);
watch(courseProbabilityMode, async () => { await nextTick(); renderCourseRiskChart(); });
watch([selectedStudentId, studentPeriod], loadStudentOverview);
watch(studentPickerVisible, (visible) => {
  if (visible) {
    studentKeyword.value = '';
  }
});

onMounted(async () => {
  await Promise.all([loadStudents(), loadOverview()]);
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  weekdayChart?.dispose();
  leaveTypeChart?.dispose();
  courseRiskChart?.dispose();
  studentTrendChart?.dispose();
});
</script>

<style scoped>
.overview-statistics-page { display: grid; gap: 20px; }
.glass-card { background: rgba(255, 255, 255, 0.45) !important; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.6) !important; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12) !important; border-radius: 20px !important; }
:deep(.glass-card .el-card__header) { border-bottom: 1px solid rgba(59, 130, 246, 0.1) !important; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.card-header__actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
.card-header__actions--stretch { width: min(100%, 520px); }
.card-header h2 { margin: 0; color: #12316f; font-size: 20px; }
.card-header p { margin: 6px 0 0; color: #5c739e; font-size: 13px; line-height: 1.6; }
.period-switch { display: inline-flex; padding: 6px; gap: 6px; border-radius: 18px; background: rgba(219, 234, 254, 0.46); border: 1px solid rgba(191, 219, 254, 0.9); }
.period-switch--small { padding: 4px; border-radius: 16px; }
.period-switch__item { min-width: 72px; min-height: 38px; border: none; border-radius: 14px; padding: 0 16px; background: transparent; color: #5a73a0; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
.period-switch--small .period-switch__item { min-width: 94px; min-height: 34px; }
.period-switch__item--active { background: rgba(255, 255, 255, 0.92); color: #1d4ed8; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12); }
.overview-meta, .student-panel__meta { display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px; color: #12316f; }
.overview-meta__label, .student-panel__meta span { color: #64748b; font-size: 12px; }
.summary-grid { display: grid; gap: 14px; }
.summary-grid--dense { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.summary-card { padding: 16px; border-radius: 18px; background: rgba(255, 255, 255, 0.76); border: 1px solid rgba(219, 234, 254, 0.92); box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08); }
.summary-card--dense { display: grid; gap: 14px; }
.summary-card__title-row, .ranking-block__head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.summary-card__title-row h3, .ranking-block__head h3 { margin: 0; color: #12316f; font-size: 15px; }
.summary-card__title-row span, .ranking-block__head span { color: #64748b; font-size: 12px; }
.summary-card__rows, .ranking-grid, .probability-list { display: grid; gap: 10px; }
.summary-card__row { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.summary-card__row-label { color: #5f769d; font-size: 12px; line-height: 1.5; }
.summary-card__row-values { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.summary-card__row-values strong { color: #12316f; font-size: 18px; }
.summary-card__row-values span { color: #64748b; font-size: 12px; }
.overview-main-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: 20px; }
.overview-distribution-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.chart-panel { height: 360px; }
.chart-panel--short { height: 300px; }
.chart-panel--student { height: 320px; }
.ranking-block, .probability-row, .student-summary-card { padding: 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.72); border: 1px solid rgba(219, 234, 254, 0.9); }
.ranking-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ranking-list li, .probability-row, .student-panel__top { display: flex; justify-content: space-between; gap: 12px; }
.ranking-list li strong, .probability-row strong { display: block; color: #12316f; font-size: 13px; }
.ranking-list li span, .probability-row p, .student-panel__top p { color: #64748b; font-size: 12px; }
.probability-row__metrics { display: grid; gap: 4px; text-align: right; }
.probability-row__metric { color: #1d4ed8; font-size: 13px; font-weight: 700; }
.probability-row__metric--muted { color: #64748b; font-size: 12px; font-weight: 500; }
.student-picker-trigger { min-width: 220px; max-width: 280px; border: 1px solid rgba(191, 219, 254, 0.95); border-radius: 18px; padding: 10px 14px; background: rgba(255, 255, 255, 0.82); color: #12316f; text-align: left; cursor: pointer; box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08); }
.student-picker-trigger__label { display: block; color: #64748b; font-size: 12px; margin-bottom: 4px; }
.student-picker-trigger strong { display: block; font-size: 14px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.student-picker-clear { border: none; background: transparent; color: #64748b; font-size: 13px; cursor: pointer; padding: 0 4px; }
.student-empty { color: #64748b; font-size: 14px; line-height: 1.8; padding: 10px 0 2px; }
.student-panel { display: grid; gap: 18px; }
.student-panel__top h3 { margin: 0; color: #12316f; font-size: 18px; }
.student-readonly-note { margin: 8px 0 0; color: #b45309 !important; font-size: 12px; font-weight: 600; }
.student-link { border: none; background: transparent; color: #1d4ed8; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0; }
.student-summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.student-summary-card { display: grid; gap: 8px; }
.student-summary-card span { color: #5f769d; font-size: 12px; }
.student-summary-card strong { color: #12316f; font-size: 22px; }
@media (max-width: 1200px) { .overview-main-grid, .overview-distribution-grid, .summary-grid--dense { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .card-header, .student-panel__top { flex-direction: column; } .card-header__actions, .card-header__actions--stretch { width: 100%; justify-content: flex-start; } .student-summary-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .period-switch { flex-wrap: wrap; } .student-summary-grid { grid-template-columns: 1fr; } .student-picker-trigger { width: 100%; max-width: none; } }
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
  max-width: 620px;
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
  max-height: min(82vh, 720px);
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
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: #102a74;
}

.student-picker-modal__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 16px;
  overflow-y: auto;
}

.student-picker-modal .project-modal-footer {
  padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.58);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.34) 100%);
}

.student-picker-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  color: #5a73a0;
}

.student-picker-search__icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.student-picker-search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #12316f;
  font-size: 14px;
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
  cursor: pointer;
}

.student-option--active {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 16px 28px rgba(59, 130, 246, 0.16);
}

.student-option__body {
  display: grid;
  gap: 4px;
}

.student-option-name {
  font-size: 15px;
  font-weight: 700;
}

.student-option-meta {
  color: #64748b;
  font-size: 12px;
}

.student-option-check {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1d4ed8;
  color: #fff;
}

.student-option-check svg {
  width: 16px;
  height: 16px;
}

.student-empty-state {
  padding: 22px 10px 10px;
  text-align: center;
}

.student-empty-title {
  margin: 0;
  color: #12316f;
  font-size: 15px;
  font-weight: 700;
}

.student-empty-text {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.student-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.student-picker-footer__summary {
  color: #5f769d;
  font-size: 13px;
}

.student-picker-footer__actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 640px) {
  .student-picker-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .student-picker-footer__actions {
    justify-content: flex-end;
  }
}
</style>
