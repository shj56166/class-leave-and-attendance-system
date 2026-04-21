<template>
  <div class="schedules-page">
    <el-card class="glass-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>课表管理</h2>
            <p>统一维护周课表、节次时间和特殊日期，学生端会按这里的配置生成当天请假与课表展示。</p>
          </div>
          <div class="header-actions">
            <el-button class="teacher-action-button teacher-action-button--secondary" @click="applyImagePreset">套用图片预设</el-button>
            <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="saving" @click="handleSave">保存全部配置</el-button>
          </div>
        </div>
      </template>

      <section class="section-block">
        <div class="section-head">
          <div>
            <h3>周课表配置</h3>
            <p>在节次列中直接编辑时间、插入或删除课程。单元格留空表示该天该节无课，学生端将不再显示为空白宿舍时段。</p>
          </div>
          <div class="section-head__actions">
            <span class="section-badge">{{ periods.length }} / {{ MAX_PERIODS }} 节</span>
          </div>
        </div>

        <div class="schedule-table">
          <table>
            <thead>
              <tr>
                <th>节次</th>
                <th v-for="day in weekDays" :key="day.value">{{ day.label }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(period, index) in periods" :key="period.period">
                <tr>
                  <td class="period-cell">
                    <div class="period-cell__header">
                      <div class="period-cell__head-row">
                        <div class="period-cell__label">第{{ period.period }}节</div>
                        <el-button
                          link
                          type="danger"
                          size="small"
                          :disabled="periods.length <= 1"
                          @click="removePeriod(index)"
                        >
                          删除课程
                        </el-button>
                      </div>
                      <button
                        type="button"
                        class="period-cell__time"
                        @click="openPeriodDialog(period, index)"
                      >
                        {{ period.startTime }} - {{ period.endTime }}
                      </button>
                    </div>
                  </td>

                  <td v-for="day in weekDays" :key="`${day.value}-${period.period}`">
                    <div class="cell-stack">
                      <el-input
                        v-model="getScheduleCell(day.value, period.period).subject"
                        placeholder="科目"
                      />
                      <el-input
                        v-model="getScheduleCell(day.value, period.period).teacherName"
                        placeholder="任课老师"
                      />
                      <el-input
                        v-model="getScheduleCell(day.value, period.period).location"
                        placeholder="上课地点"
                      />
                    </div>
                  </td>
                </tr>

                <tr v-if="index < periods.length - 1 || periods.length < MAX_PERIODS" class="insert-row">
                  <td class="insert-row__cell insert-row__cell--period">
                    <button
                      type="button"
                      class="insert-row__button"
                      :disabled="periods.length >= MAX_PERIODS"
                      @click="insertPeriodAfter(index)"
                    >
                      +
                    </button>
                  </td>
                  <td :colspan="weekDays.length" class="insert-row__cell insert-row__cell--rest"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <h3>特殊日期维护</h3>
            <p>这里的修改会立即生效，不受“保存全部配置”按钮影响。补课按选定周几课表执行，假期按整日无课处理。</p>
          </div>
          <div class="section-head__actions">
            <el-button class="teacher-action-button teacher-action-button--secondary" :loading="specialDateSaving" @click="openSpecialDateDialog()">
              新增特殊日期
            </el-button>
          </div>
        </div>

        <div v-if="specialDateGroups.length" class="special-date-results">
          <article
            v-for="item in specialDateGroups"
            :key="item.key"
            class="special-result-card"
          >
            <div class="special-result-card__main">
              <el-tag
                :type="item.mode === 'holiday' ? 'success' : 'warning'"
                effect="plain"
              >
                {{ item.mode === 'holiday' ? '假期' : '补课/调课' }}
              </el-tag>
              <h4>{{ item.title }}</h4>
              <p>{{ item.description }}</p>
            </div>

            <div class="special-result-card__actions">
              <el-button link type="primary" @click="openEditSpecialDateDialog(item)">编辑</el-button>
              <el-button link type="danger" :loading="specialDateSaving" @click="requestDeleteSpecialDate(item)">删除</el-button>
            </div>
          </article>
        </div>

        <el-empty v-else description="暂未配置特殊日期" />
      </section>
    </el-card>

    <ProjectDialog
      v-model="periodDialogVisible"
      :title="periodDialogTitle"
      width="420px"
      @update:model-value="handlePeriodDialogVisibleChange"
    >
      <div class="period-time-form">
        <p class="period-time-form__hint">修改后会直接应用到当前草稿，最终仍需点击“保存全部配置”才会写入后端。</p>

        <label class="period-time-form__field">
          <span>开始时间</span>
          <input v-model="periodDialogForm.startTime" type="time" class="native-time-input" />
        </label>

        <label class="period-time-form__field">
          <span>结束时间</span>
          <input v-model="periodDialogForm.endTime" type="time" class="native-time-input" />
        </label>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="periodDialogVisible = false">取消</el-button>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="savePeriodDialog">保存时间</el-button>
        </div>
      </template>
    </ProjectDialog>

    <ProjectDialog
      v-model="specialDateDialogVisible"
      :title="specialDateDialogTitle"
      width="560px"
      @update:model-value="handleSpecialDateDialogVisibleChange"
    >
      <div class="special-date-dialog">
        <p class="special-date-dialog__hint">保存后立即生效，学生端和教师端会按新的特殊日期规则重新识别课表。</p>

        <div class="special-date-mode-switch">
          <button
            type="button"
            class="special-date-mode-switch__item"
            :class="{ 'special-date-mode-switch__item--active': specialDateForm.mode === 'override' }"
            @click="specialDateForm.mode = 'override'"
          >
            <strong>补课 / 调课</strong>
            <span>单天生效，按某个周几课表执行</span>
          </button>
          <button
            type="button"
            class="special-date-mode-switch__item"
            :class="{ 'special-date-mode-switch__item--active': specialDateForm.mode === 'holiday' }"
            @click="specialDateForm.mode = 'holiday'"
          >
            <strong>假期</strong>
            <span>连续日期范围内整段无课</span>
          </button>
        </div>

        <div v-if="specialDateForm.mode === 'override'" class="special-date-form-grid">
          <label class="special-date-form__field">
            <span>日期</span>
            <input v-model="specialDateForm.date" type="date" class="native-time-input native-time-input--date" />
          </label>

          <div class="special-date-form__field">
            <span>按周几课表</span>
            <div class="special-date-weekday-selector" role="radiogroup" aria-label="按周几课表">
              <button
                v-for="day in weekDays"
                :key="day.value"
                type="button"
                class="special-date-weekday-selector__item"
                :class="{ 'special-date-weekday-selector__item--active': specialDateForm.targetWeekday === day.value }"
                :aria-pressed="specialDateForm.targetWeekday === day.value"
                @click="specialDateForm.targetWeekday = day.value"
              >
                {{ day.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="special-date-form-grid">
          <label class="special-date-form__field">
            <span>开始日期</span>
            <input v-model="specialDateForm.startDate" type="date" class="native-time-input native-time-input--date" />
          </label>

          <label class="special-date-form__field">
            <span>结束日期</span>
            <input v-model="specialDateForm.endDate" type="date" class="native-time-input native-time-input--date" />
          </label>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="teacher-action-button teacher-action-button--secondary" @click="specialDateDialogVisible = false">取消</el-button>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="specialDateSaving" @click="saveSpecialDateDialog">
            保存并生效
          </el-button>
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
      :type="confirmDialog.type"
      @cancel="closeConfirmDialog"
      @confirm="confirmCurrentAction"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import ProjectConfirmDialog from '../components/ProjectConfirmDialog.vue';
import ProjectDialog from '../components/ProjectDialog.vue';
import { getSchedules, updateSchedules, updateSpecialDates } from '../api/teacher';
import { syncTeacherLocalReminderScheduleBundle } from '../services/teacherNotificationRuntime';

const MAX_PERIODS = 20;
const DEFAULT_PERIODS = [
  { period: 1, startTime: '08:00', endTime: '08:45' },
  { period: 2, startTime: '08:55', endTime: '09:40' },
  { period: 3, startTime: '10:00', endTime: '10:45' },
  { period: 4, startTime: '10:55', endTime: '11:40' },
  { period: 5, startTime: '14:00', endTime: '14:45' },
  { period: 6, startTime: '14:55', endTime: '15:40' },
  { period: 7, startTime: '16:00', endTime: '16:45' },
  { period: 8, startTime: '16:55', endTime: '17:40' }
];
const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const IMAGE_PRESET = {
  periods: [
    { period: 1, startTime: '08:00', endTime: '08:40' },
    { period: 2, startTime: '08:50', endTime: '09:30' },
    { period: 3, startTime: '09:50', endTime: '10:30' },
    { period: 4, startTime: '10:40', endTime: '11:20' },
    { period: 5, startTime: '14:50', endTime: '15:30' },
    { period: 6, startTime: '15:40', endTime: '16:20' },
    { period: 7, startTime: '16:30', endTime: '17:10' },
    { period: 8, startTime: '17:20', endTime: '18:00' }
  ],
  schedules: [
    { weekday: 1, period: 2, subject: '机器人基础', teacherName: '教师A', location: '实训楼A-201' },
    { weekday: 1, period: 3, subject: '机器人基础', teacherName: '教师A', location: '实训楼A-201' },
    { weekday: 1, period: 4, subject: '机器人基础', teacherName: '教师A', location: '实训楼A-201' },
    { weekday: 1, period: 5, subject: '公共英语', teacherName: '教师B', location: '教学楼B-101' },
    { weekday: 1, period: 6, subject: '公共英语', teacherName: '教师B', location: '教学楼B-101' },
    { weekday: 2, period: 1, subject: '语文基础', teacherName: '教师C', location: '教学楼B-101' },
    { weekday: 2, period: 2, subject: '语文基础', teacherName: '教师C', location: '教学楼B-101' },
    { weekday: 2, period: 3, subject: '数学基础', teacherName: '教师D', location: '教学楼B-101' },
    { weekday: 2, period: 4, subject: '数学基础', teacherName: '教师D', location: '教学楼B-101' },
    { weekday: 3, period: 1, subject: '信息技术', teacherName: '教师E', location: '机房C-301' },
    { weekday: 3, period: 2, subject: '信息技术', teacherName: '教师E', location: '机房C-301' },
    { weekday: 3, period: 3, subject: '电气控制入门', teacherName: '教师F', location: '实训楼A-202' },
    { weekday: 3, period: 4, subject: '电气控制入门', teacherName: '教师F', location: '实训楼A-202' },
    { weekday: 3, period: 5, subject: '机械基础', teacherName: '教师G', location: '教学楼B-102' },
    { weekday: 3, period: 6, subject: '机械基础', teacherName: '教师G', location: '教学楼B-102' },
    { weekday: 4, period: 1, subject: '职业英语', teacherName: '教师B', location: '教学楼B-101' },
    { weekday: 4, period: 2, subject: '职业英语', teacherName: '教师B', location: '教学楼B-101' },
    { weekday: 4, period: 3, subject: '职业素养', teacherName: '教师H', location: '教学楼B-103' },
    { weekday: 4, period: 4, subject: '实践活动', teacherName: '教师I', location: '综合楼D-201' },
    { weekday: 4, period: 6, subject: '自动化编程', teacherName: '教师A', location: '实训楼A-203' },
    { weekday: 4, period: 7, subject: '自动化编程', teacherName: '教师A', location: '实训楼A-203' },
    { weekday: 5, period: 1, subject: '体育与健康', teacherName: '教师J', location: '体育馆' },
    { weekday: 5, period: 2, subject: '体育与健康', teacherName: '教师J', location: '体育馆' },
    { weekday: 5, period: 3, subject: '应用写作', teacherName: '教师C', location: '教学楼B-101' },
    { weekday: 5, period: 4, subject: '应用写作', teacherName: '教师C', location: '教学楼B-101' },
    { weekday: 5, period: 5, subject: '班会与成长', teacherName: '教师K', location: '教学楼B-104' },
    { weekday: 5, period: 6, subject: '班会与成长', teacherName: '教师K', location: '教学楼B-104' }
  ]
};

const weekDays = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 }
];

const periods = ref([]);
const specialDates = ref([]);
const saving = ref(false);
const specialDateSaving = ref(false);
const scheduleMap = reactive({});
const periodDialogVisible = ref(false);
const specialDateDialogVisible = ref(false);
const editingPeriodIndex = ref(-1);
const editingSpecialDateDates = ref([]);
const confirmAction = ref('');
const confirmPayload = ref(null);
const confirmDialog = ref({
  visible: false,
  title: '确认操作',
  message: '',
  details: [],
  confirmText: '确定',
  confirmType: 'warning',
  type: 'warning'
});
const periodDialogForm = reactive({
  period: null,
  startTime: '',
  endTime: ''
});
const specialDateForm = reactive({
  mode: 'override',
  date: '',
  targetWeekday: 1,
  startDate: '',
  endDate: ''
});

const periodDialogTitle = computed(() => (
  periodDialogForm.period ? `编辑第 ${periodDialogForm.period} 节时间` : '编辑节次时间'
));
const specialDateDialogTitle = computed(() => (
  editingSpecialDateDates.value.length ? '编辑特殊日期' : '新增特殊日期'
));
const specialDateGroups = computed(() => buildSpecialDateGroups(specialDates.value));

function formatDateKey(date) {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function shiftDateKey(dateKey, days) {
  const date = createDateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function normalizeTargetWeekday(value) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return null;
  }

  return weekday;
}

function getWeekdayValue(dateKey) {
  return createDateFromKey(dateKey).getDay() || 7;
}

function getWeekdayLabel(weekday) {
  return WEEKDAY_LABELS[weekday] || `周${weekday}`;
}

function normalizeSpecialDateEntries(entries = []) {
  return entries
    .map((item) => {
      const targetWeekday = normalizeTargetWeekday(item.targetWeekday || item.target_weekday);
      return {
        id: item.id || null,
        date: item.date,
        targetWeekday: targetWeekday || (item.type === 'workday_override' ? getWeekdayValue(item.date) : null)
      };
    })
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function buildSpecialDateGroups(entries = []) {
  const normalized = normalizeSpecialDateEntries(entries);
  const groups = [];
  const holidayEntries = normalized.filter((item) => !item.targetWeekday);
  const overrideEntries = normalized.filter((item) => item.targetWeekday);

  overrideEntries.forEach((item) => {
    groups.push({
      key: `override-${item.date}`,
      mode: 'override',
      date: item.date,
      targetWeekday: item.targetWeekday,
      dates: [item.date],
      sortDate: item.date,
      title: `${item.date} 按${getWeekdayLabel(item.targetWeekday)}课表`,
      description: '当天所有课表识别、请假命中和统计都会按所选周几课程执行。'
    });
  });

  let currentHolidayGroup = null;
  holidayEntries.forEach((item) => {
    if (!currentHolidayGroup) {
      currentHolidayGroup = { startDate: item.date, endDate: item.date, dates: [item.date] };
      return;
    }

    if (shiftDateKey(currentHolidayGroup.endDate, 1) === item.date) {
      currentHolidayGroup.endDate = item.date;
      currentHolidayGroup.dates.push(item.date);
      return;
    }

    groups.push({
      key: `holiday-${currentHolidayGroup.startDate}-${currentHolidayGroup.endDate}`,
      mode: 'holiday',
      startDate: currentHolidayGroup.startDate,
      endDate: currentHolidayGroup.endDate,
      dates: [...currentHolidayGroup.dates],
      sortDate: currentHolidayGroup.startDate,
      title: currentHolidayGroup.startDate === currentHolidayGroup.endDate
        ? `${currentHolidayGroup.startDate} 假期`
        : `${currentHolidayGroup.startDate} 至 ${currentHolidayGroup.endDate} 假期`,
      description: `共 ${currentHolidayGroup.dates.length} 天，期间整日无课，学生端会按假期处理。`
    });

    currentHolidayGroup = { startDate: item.date, endDate: item.date, dates: [item.date] };
  });

  if (currentHolidayGroup) {
    groups.push({
      key: `holiday-${currentHolidayGroup.startDate}-${currentHolidayGroup.endDate}`,
      mode: 'holiday',
      startDate: currentHolidayGroup.startDate,
      endDate: currentHolidayGroup.endDate,
      dates: [...currentHolidayGroup.dates],
      sortDate: currentHolidayGroup.startDate,
      title: currentHolidayGroup.startDate === currentHolidayGroup.endDate
        ? `${currentHolidayGroup.startDate} 假期`
        : `${currentHolidayGroup.startDate} 至 ${currentHolidayGroup.endDate} 假期`,
      description: `共 ${currentHolidayGroup.dates.length} 天，期间整日无课，学生端会按假期处理。`
    });
  }

  return groups.sort((left, right) => left.sortDate.localeCompare(right.sortDate));
}

function createEmptySchedule() {
  return {
    subject: '',
    teacherName: '',
    location: ''
  };
}

function cloneSchedule(entry) {
  return {
    subject: entry?.subject || '',
    teacherName: entry?.teacherName || '',
    location: entry?.location || ''
  };
}

function createPeriodDraft({ period = 1, startTime = '', endTime = '' } = {}) {
  return {
    period,
    startTime,
    endTime
  };
}

function replaceScheduleMap(nextMap) {
  Object.keys(scheduleMap).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(nextMap, key)) {
      delete scheduleMap[key];
    }
  });

  Object.entries(nextMap).forEach(([key, value]) => {
    scheduleMap[key] = value;
  });
}

function getScheduleCell(weekday, period) {
  const key = `${weekday}-${period}`;
  if (!Object.prototype.hasOwnProperty.call(scheduleMap, key)) {
    scheduleMap[key] = createEmptySchedule();
  }
  return scheduleMap[key];
}

function normalizePeriods(periodList) {
  return periodList.map((item, index) => createPeriodDraft({
    period: index + 1,
    startTime: item.startTime,
    endTime: item.endTime
  }));
}

function createScheduleMapForPeriods(periodList, resolveSourcePeriod = () => null) {
  const nextMap = {};

  weekDays.forEach((day) => {
    periodList.forEach((period, index) => {
      const sourcePeriod = resolveSourcePeriod({ day, period, index });
      const nextKey = `${day.value}-${period.period}`;
      nextMap[nextKey] = sourcePeriod == null
        ? createEmptySchedule()
        : cloneSchedule(scheduleMap[`${day.value}-${sourcePeriod}`]);
    });
  });

  return nextMap;
}

function setPeriods(nextPeriodList) {
  const normalizedPeriods = normalizePeriods(nextPeriodList);
  replaceScheduleMap(createScheduleMapForPeriods(normalizedPeriods));
  periods.value = normalizedPeriods;
}

function setPeriodsWithRemappedSchedules(nextPeriodList, resolveSourcePeriod) {
  const normalizedPeriods = normalizePeriods(nextPeriodList);
  const nextMap = createScheduleMapForPeriods(normalizedPeriods, resolveSourcePeriod);
  replaceScheduleMap(nextMap);
  periods.value = normalizedPeriods;
}

function applySchedules(schedules = []) {
  const nextMap = {};

  weekDays.forEach((day) => {
    periods.value.forEach((period) => {
      nextMap[`${day.value}-${period.period}`] = createEmptySchedule();
    });
  });

  schedules.forEach((item) => {
    const key = `${item.weekday}-${item.period}`;
    if (Object.prototype.hasOwnProperty.call(nextMap, key)) {
      nextMap[key] = {
        subject: item.subject || '',
        teacherName: item.teacherName || '',
        location: item.location || ''
      };
    }
  });

  replaceScheduleMap(nextMap);
}

function shiftTime(timeValue, minutes) {
  const [hours, mins] = String(timeValue || '19:00').split(':').map(Number);
  const totalMinutes = Math.max(0, Math.min((hours * 60) + mins + minutes, (23 * 60) + 59));
  const nextHours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const nextMins = String(totalMinutes % 60).padStart(2, '0');
  return `${nextHours}:${nextMins}`;
}

function hasScheduleOnPeriod(periodNumber) {
  return weekDays.some((day) => {
    const key = `${day.value}-${periodNumber}`;
    return Boolean(scheduleMap[key]?.subject?.trim());
  });
}

function openPeriodDialog(period, index) {
  editingPeriodIndex.value = index;
  periodDialogForm.period = period.period;
  periodDialogForm.startTime = period.startTime;
  periodDialogForm.endTime = period.endTime;
  periodDialogVisible.value = true;
}

function handlePeriodDialogVisibleChange(visible) {
  periodDialogVisible.value = visible;
  if (!visible) {
    editingPeriodIndex.value = -1;
  }
}

function savePeriodDialog() {
  if (editingPeriodIndex.value < 0 || !periods.value[editingPeriodIndex.value]) {
    periodDialogVisible.value = false;
    return;
  }

  if (!periodDialogForm.startTime || !periodDialogForm.endTime || periodDialogForm.startTime >= periodDialogForm.endTime) {
    ElMessage.warning('节次时间配置不正确');
    return;
  }

  periods.value[editingPeriodIndex.value] = {
    ...periods.value[editingPeriodIndex.value],
    startTime: periodDialogForm.startTime,
    endTime: periodDialogForm.endTime
  };
  periodDialogVisible.value = false;
}

function insertPeriodAfter(index) {
  if (periods.value.length >= MAX_PERIODS) {
    ElMessage.warning(`最多只能配置 ${MAX_PERIODS} 节`);
    return;
  }

  const current = periods.value[index];
  const next = periods.value[index + 1];
  const startTime = current?.endTime || '19:00';
  const endTime = next?.startTime && next.startTime > startTime
    ? next.startTime
    : shiftTime(startTime, 40);

  const insertedIndex = index + 1;
  const nextPeriods = periods.value.map((item) => ({ ...item }));
  nextPeriods.splice(insertedIndex, 0, createPeriodDraft({ startTime, endTime }));
  setPeriodsWithRemappedSchedules(nextPeriods, ({ index: nextIndex }) => {
    if (nextIndex < insertedIndex) {
      return nextIndex + 1;
    }

    if (nextIndex === insertedIndex) {
      return null;
    }

    return nextIndex;
  });
  openPeriodDialog(periods.value[insertedIndex], insertedIndex);
}

async function removePeriod(index) {
  if (periods.value.length <= 1) {
    ElMessage.warning('至少需要保留 1 节');
    return;
  }

  const target = periods.value[index];
  if (hasScheduleOnPeriod(target.period)) {
    openConfirmDialog({
      action: 'remove-period',
      title: '确认删除节次',
      message: `删除第 ${target.period} 节后，该节次上的课程会一起删除。`,
      details: ['后续节次会自动重排。'],
      confirmText: '删除',
      confirmType: 'danger',
      type: 'danger'
    }, index);
    return;
  }

  applyPeriodRemoval(index);
}

function resetSpecialDateForm() {
  specialDateForm.mode = 'override';
  specialDateForm.date = '';
  specialDateForm.targetWeekday = 1;
  specialDateForm.startDate = '';
  specialDateForm.endDate = '';
  editingSpecialDateDates.value = [];
}

function openSpecialDateDialog(mode = 'override') {
  resetSpecialDateForm();
  specialDateForm.mode = mode;
  specialDateDialogVisible.value = true;
}

function openEditSpecialDateDialog(group) {
  resetSpecialDateForm();
  editingSpecialDateDates.value = [...group.dates];
  specialDateForm.mode = group.mode;

  if (group.mode === 'override') {
    specialDateForm.date = group.date;
    specialDateForm.targetWeekday = group.targetWeekday;
  } else {
    specialDateForm.startDate = group.startDate;
    specialDateForm.endDate = group.endDate;
  }

  specialDateDialogVisible.value = true;
}

function handleSpecialDateDialogVisibleChange(visible) {
  specialDateDialogVisible.value = visible;
  if (!visible) {
    resetSpecialDateForm();
  }
}

function serializeSpecialDatesForApi(entries = []) {
  return normalizeSpecialDateEntries(entries).map((item) => ({
    date: item.date,
    targetWeekday: item.targetWeekday
  }));
}

function createHolidayEntries(startDate, endDate) {
  const entries = [];
  for (let cursor = startDate; cursor <= endDate; cursor = shiftDateKey(cursor, 1)) {
    entries.push({
      date: cursor,
      targetWeekday: null
    });
  }
  return entries;
}

function validateNextSpecialDates(entries = []) {
  const dateSeen = new Set();

  for (const item of entries) {
    if (!item.date) {
      return '特殊日期不能为空';
    }

    if (dateSeen.has(item.date)) {
      return `存在重复特殊日期：${item.date}`;
    }

    dateSeen.add(item.date);
  }

  return '';
}

async function persistSpecialDates(entries, successMessage) {
  const validationError = validateNextSpecialDates(entries);
  if (validationError) {
    ElMessage.warning(validationError);
    return false;
  }

  specialDateSaving.value = true;
  try {
    const response = await updateSpecialDates({
      specialDates: serializeSpecialDatesForApi(entries)
    });
    specialDates.value = normalizeSpecialDateEntries(response.specialDates || entries);
    await syncTeacherLocalReminderScheduleBundle({
      bundle: buildLocalReminderBundle({
        specialDates: response.specialDates || entries
      })
    });
    ElMessage.success(successMessage);
    return true;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '特殊日期保存失败');
    return false;
  } finally {
    specialDateSaving.value = false;
  }
}

async function saveSpecialDateDialog() {
  const preservedEntries = normalizeSpecialDateEntries(specialDates.value)
    .filter((item) => !editingSpecialDateDates.value.includes(item.date));

  let nextEntries = [...preservedEntries];

  if (specialDateForm.mode === 'override') {
    if (!specialDateForm.date) {
      ElMessage.warning('请选择日期');
      return;
    }

    if (!specialDateForm.targetWeekday) {
      ElMessage.warning('请选择要执行的周几课表');
      return;
    }

    nextEntries.push({
      date: specialDateForm.date,
      targetWeekday: Number(specialDateForm.targetWeekday)
    });
  } else {
    if (!specialDateForm.startDate || !specialDateForm.endDate) {
      ElMessage.warning('请选择完整的假期范围');
      return;
    }

    if (specialDateForm.endDate < specialDateForm.startDate) {
      ElMessage.warning('结束日期不能早于开始日期');
      return;
    }

    nextEntries = [
      ...nextEntries,
      ...createHolidayEntries(specialDateForm.startDate, specialDateForm.endDate)
    ];
  }

  const success = await persistSpecialDates(
    nextEntries,
    editingSpecialDateDates.value.length ? '特殊日期已更新并生效' : '特殊日期已新增并生效'
  );

  if (success) {
    specialDateDialogVisible.value = false;
  }
}

function requestDeleteSpecialDate(group) {
  openConfirmDialog({
    action: 'delete-special-date',
    title: '确认删除特殊日期',
    message: `删除后，${group.mode === 'holiday' ? '这段假期' : '这个补课日期'}会立即失效。`,
    details: [group.title],
    confirmText: '删除',
    confirmType: 'danger',
    type: 'danger'
  }, group);
}

async function deleteSpecialDateGroup(group) {
  const nextEntries = normalizeSpecialDateEntries(specialDates.value)
    .filter((item) => !group.dates.includes(item.date));

  await persistSpecialDates(nextEntries, '特殊日期已删除并生效');
}

function applyPresetData(preset) {
  setPeriods(
    preset.periods.map((item) => createPeriodDraft({
      period: item.period,
      startTime: item.startTime,
      endTime: item.endTime
    }))
  );
  applySchedules(preset.schedules);
}

function openConfirmDialog(config, payload = null) {
  confirmAction.value = config.action;
  confirmPayload.value = payload;
  confirmDialog.value = {
    visible: true,
    title: config.title,
    message: config.message,
    details: config.details || [],
    confirmText: config.confirmText || '确定',
    confirmType: config.confirmType || 'warning',
    type: config.type || 'warning'
  };
}

function closeConfirmDialog() {
  confirmDialog.value.visible = false;
  confirmAction.value = '';
  confirmPayload.value = null;
}

function applyPeriodRemoval(index) {
  const remaining = periods.value
    .filter((_, currentIndex) => currentIndex !== index)
    .map((item) => ({ ...item }));

  setPeriodsWithRemappedSchedules(remaining, ({ index: nextIndex }) => (
    nextIndex < index ? nextIndex + 1 : nextIndex + 2
  ));
}

function confirmCurrentAction() {
  const action = confirmAction.value;
  const payload = confirmPayload.value;

  if (!action) {
    closeConfirmDialog();
    return;
  }

  closeConfirmDialog();

  if (action === 'remove-period') {
    applyPeriodRemoval(payload);
  }

  if (action === 'apply-image-preset') {
    applyPresetData(IMAGE_PRESET);
    ElMessage.success('已套用图片预设，请检查后保存');
  }

  if (action === 'delete-special-date') {
    deleteSpecialDateGroup(payload);
  }
}

async function applyImagePreset() {
  openConfirmDialog({
    action: 'apply-image-preset',
    title: '套用图片预设',
    message: '将按你提供的课表图片覆盖当前编辑区内容。',
    details: ['此操作不会立即保存到后端，点击“保存全部配置”后才会真正写入。'],
    confirmText: '套用',
    confirmType: 'warning',
    type: 'warning'
  });
}

async function loadSchedules() {
  try {
    const response = await getSchedules();
    setPeriods(response.periods?.length ? response.periods : DEFAULT_PERIODS);
    applySchedules(response.schedules || []);
    specialDates.value = normalizeSpecialDateEntries(response.specialDates || []);
    await syncTeacherLocalReminderScheduleBundle({
      bundle: {
        periods: response.periods?.length ? response.periods : DEFAULT_PERIODS,
        schedules: response.schedules || [],
        specialDates: response.specialDates || [],
        syncedAt: Date.now()
      }
    });
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '加载课表失败');
  }
}

function buildPayload() {
  const schedules = [];

  Object.entries(scheduleMap).forEach(([key, value]) => {
    const subject = String(value.subject || '').trim();
    const teacherName = String(value.teacherName || '').trim();
    const location = String(value.location || '').trim();

    if (!subject) {
      return;
    }

    const [weekday, period] = key.split('-').map(Number);
    schedules.push({
      weekday,
      period,
      subject,
      teacherName,
      location
    });
  });

  return {
    periods: periods.value.map((item) => ({
      period: Number(item.period),
      startTime: item.startTime,
      endTime: item.endTime
    })),
    schedules
  };
}

function buildLocalReminderBundle(overrides = {}) {
  const payload = buildPayload();
  return {
    periods: Array.isArray(overrides.periods) ? overrides.periods : payload.periods,
    schedules: Array.isArray(overrides.schedules) ? overrides.schedules : payload.schedules,
    specialDates: Array.isArray(overrides.specialDates) ? overrides.specialDates : specialDates.value,
    syncedAt: Date.now()
  };
}

async function handleSave() {
  const invalidPeriod = periods.value.find((item) => !item.startTime || !item.endTime || item.startTime >= item.endTime);
  if (invalidPeriod) {
    ElMessage.warning(`第 ${invalidPeriod.period} 节时间配置不正确`);
    return;
  }

  saving.value = true;
  try {
    await updateSchedules(buildPayload());
    await syncTeacherLocalReminderScheduleBundle({
      bundle: buildLocalReminderBundle()
    });
    ElMessage.success('周课表已保存');
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '保存失败');
  } finally {
    saving.value = false;
  }
}

setPeriods(DEFAULT_PERIODS);

onMounted(() => {
  loadSchedules();
});
</script>

<style scoped>
.schedules-page {
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

.card-header,
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.header-actions,
.section-head__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header h2,
.section-head h3 {
  margin: 0;
  color: #12316f;
}

.card-header h2 {
  font-size: 20px;
}

.section-head h3 {
  font-size: 15px;
  font-weight: 700;
}

.card-header p,
.section-head p {
  margin: 6px 0 0;
  line-height: 1.6;
  color: #5c739e;
}

.card-header p {
  font-size: 13px;
}

.section-badge {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #315a95;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.86);
}

.section-block + .section-block {
  margin-top: 28px;
}

.schedule-table {
  margin-top: 16px;
  overflow-x: auto;
}

.schedule-table table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}

.schedule-table th,
.schedule-table td {
  border: 1px solid rgba(59, 130, 246, 0.1);
  padding: 12px;
  vertical-align: top;
}

.schedule-table th {
  background: rgba(219, 234, 254, 0.5);
  color: #1e3a8a;
  font-weight: 700;
}

.period-cell {
  min-width: 188px;
  background: rgba(239, 246, 255, 0.75);
  color: #12316f;
}

.period-cell__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.period-cell__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.period-cell__label {
  font-size: 15px;
  font-weight: 700;
  color: #12316f;
}

.period-cell__time {
  width: 100%;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: rgba(255, 255, 255, 0.94);
  color: #2450a4;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.period-cell__time:hover {
  border-color: rgba(59, 130, 246, 0.34);
  box-shadow: 0 10px 18px rgba(59, 130, 246, 0.1);
}

.period-cell__time:active {
  transform: scale(0.985);
}

.insert-row__cell {
  padding: 0 !important;
  background: transparent;
}

.insert-row__cell::before {
  content: '';
  display: block;
  width: 100%;
  border-top: 1px dashed rgba(59, 130, 246, 0.2);
}

.insert-row__cell--period {
  position: relative;
  min-width: 188px;
  border-right: 1px solid rgba(59, 130, 246, 0.1) !important;
}

.insert-row__cell--rest {
  border-left: 0 !important;
  border-right: 0 !important;
}

.insert-row__button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin: -15px auto;
  border: 1px solid rgba(59, 130, 246, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #2450a4;
  font-size: 20px;
  font-weight: 500;
  line-height: 1;
  box-shadow: 0 10px 18px rgba(59, 130, 246, 0.12);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.insert-row__button:hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.38);
  box-shadow: 0 12px 22px rgba(59, 130, 246, 0.16);
}

.insert-row__button:active:not(:disabled) {
  transform: scale(0.97);
}

.insert-row__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cell-stack {
  display: grid;
  gap: 8px;
}

.special-date-results {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.special-result-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.76),
    0 14px 32px rgba(148, 163, 184, 0.08);
}

.special-result-card__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.special-result-card__main h4 {
  margin: 0;
  font-size: 16px;
  color: #12316f;
}

.special-result-card__main p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #5c739e;
}

.special-result-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.period-time-form,
.special-date-dialog {
  display: grid;
  gap: 14px;
}

.period-time-form__hint,
.special-date-dialog__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #5c739e;
}

.special-date-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.special-date-mode-switch__item {
  min-height: 96px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(214, 225, 240, 0.96);
  background: rgba(255, 255, 255, 0.9);
  text-align: left;
  color: #5c739e;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.special-date-mode-switch__item strong {
  display: block;
  font-size: 15px;
  color: #12316f;
}

.special-date-mode-switch__item span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
}

.special-date-mode-switch__item--active {
  border-color: rgba(96, 165, 250, 0.46);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(219, 234, 254, 0.96) 100%);
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.special-date-mode-switch__item--active strong {
  color: #1e40af;
}

.special-date-mode-switch__item--active span {
  color: #2563eb;
}

.special-date-form-grid {
  display: grid;
  gap: 14px;
}

.special-date-form__field,
.period-time-form__field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #5c739e;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.special-date-weekday-selector {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.special-date-weekday-selector__item {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(191, 219, 254, 0.96);
  background: rgba(255, 255, 255, 0.92);
  color: #35507d;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.special-date-weekday-selector__item:hover {
  border-color: rgba(96, 165, 250, 0.58);
  color: #1d4ed8;
}

.special-date-weekday-selector__item--active {
  border-color: rgba(96, 165, 250, 0.7);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(219, 234, 254, 0.98) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 10px 18px rgba(59, 130, 246, 0.12);
  color: #1e40af;
}

.special-date-weekday-selector__item:focus-visible,
.special-date-mode-switch__item:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.34);
  outline-offset: 2px;
}

.native-time-input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(214, 225, 240, 0.96);
  background: rgba(255, 255, 255, 0.92);
  color: #12316f;
}

.native-time-input--date {
  min-width: 148px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.88) !important;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12) !important;
  border-radius: 12px !important;
}

@media (max-width: 900px) {
  .card-header,
  .section-head,
  .special-result-card {
    flex-direction: column;
  }

  .header-actions,
  .section-head__actions,
  .special-result-card__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .period-cell {
    min-width: 172px;
  }

  .insert-row__cell--period {
    min-width: 172px;
  }

  .special-date-mode-switch {
    grid-template-columns: 1fr;
  }

  .special-date-weekday-selector {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
