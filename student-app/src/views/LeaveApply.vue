<template>
  <div class="leave-apply-page">
    <header class="page-nav" :class="{ 'page-nav--compact': isPageHeadCompact }">
      <div class="page-nav__surface" aria-hidden="true"></div>
      <div class="page-nav__center" aria-hidden="true">
        <div ref="pageNavTitleTargetRef" class="page-nav__title page-nav__title--target">请假申请</div>
      </div>

      <div class="page-nav__shared-title" :style="sharedTitleStyle" aria-hidden="true">
        <div class="page-nav__shared-text">请假申请</div>
      </div>

      <button type="button" class="page-nav__back" aria-label="返回" @click="router.back()">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 6L9 12L15 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>

    <section class="page-head">
      <div class="page-head__content">
        <div class="page-head__heading">
          <p class="page-head__eyebrow">学生端申请</p>
          <h1 ref="pageHeadTitleRef" class="page-head__title" :style="pageHeadTitleStyle">请假申请</h1>
          <p class="page-head__meta" :style="pageHeadMetaStyle">{{ pageMetaText }}</p>
        </div>
      </div>
    </section>

    <section ref="modeSwitchRef" class="mode-panel" aria-label="请假模式切换">
      <div class="panel-switch panel-switch--modes" :style="getSwitchStyle(modeOptions)">
        <span class="panel-switch__track" aria-hidden="true">
          <span class="panel-switch__indicator" :style="getSwitchIndicatorStyle(modeOptions, form.mode)" />
        </span>
        <button
          v-for="item in modeOptions"
          :key="item.value"
          type="button"
          class="panel-switch__item"
          :class="{ 'panel-switch__item--active': form.mode === item.value }"
          @click="switchMode(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <div class="leave-apply-content">
      <van-loading v-if="contextLoading" size="24px" vertical class="loading-block">加载中...</van-loading>

      <template v-else>
        <section v-if="form.mode === 'today'" class="apply-ticket apply-ticket--today">
          <header class="apply-ticket__header">
            <div class="apply-ticket__heading">
              <p class="apply-ticket__eyebrow">当天请假</p>
              <h2 class="apply-ticket__title">当前课程与请假范围</h2>
              <p class="apply-ticket__subtitle">{{ todaySummaryText }}</p>
            </div>
          </header>

          <section class="apply-ticket__hero">
            <div v-if="todayContext.currentCourse" class="context-strip">
              <div class="context-strip__row">
                <span>当前课程</span>
                <strong>{{ todayContext.currentCourse.subject }}</strong>
              </div>
              <div class="context-strip__row">
                <span>识别地点</span>
                <strong>{{ todayLocationLabel }}</strong>
              </div>
              <div class="context-strip__row">
                <span>时间范围</span>
                <strong>第{{ todayContext.currentCourse.period }}节 · {{ todayContext.currentCourse.startTime }} - {{ todayContext.currentCourse.endTime }}</strong>
              </div>
              <div v-if="todayContext.currentCourse.location" class="context-strip__row context-strip__row--muted">
                <span>课程地点</span>
                <strong>{{ todayContext.currentCourse.location }}</strong>
              </div>
            </div>

            <p v-else class="inline-note">
              {{ todayContext.copyText || '系统会结合当前上下文生成快捷节次，你可以直接选择剩余课程或手动选择节次范围。' }}
            </p>

            <p class="inline-note inline-note--accent">
              当前范围：<strong>{{ todaySelectionSummaryText }}</strong>
            </p>

            <p v-if="!todayContext.available" class="inline-note inline-note--warn">
              {{ todayContext.reason || '今天没有可请假的课程。' }}
            </p>
          </section>

          <template v-if="todayContext.available">
            <section class="apply-section">
              <div class="apply-section__label">快捷选择</div>
              <div class="chip-list">
                <button
                  v-for="preset in todayContext.presets"
                  :key="preset.id"
                  type="button"
                  class="chip-pill"
                  :class="{ 'chip-pill--active': form.selectionKind === 'preset' && form.presetId === preset.id }"
                  @click="selectPreset(preset.id)"
                >
                  {{ preset.label }}
                </button>

                <button
                  type="button"
                  class="chip-pill"
                  :class="{ 'chip-pill--active': form.selectionKind === 'range' }"
                  @click="selectRangeMode"
                >
                  其他选择
                </button>
              </div>
            </section>

            <section v-if="form.selectionKind === 'range'" class="apply-section">
              <div class="apply-section__label">节次范围</div>
              <div class="field-grid field-grid--split">
                <div class="field-block">
                  <span>开始节次</span>
                  <select v-model.number="form.fromPeriod" class="native-select">
                    <option v-for="option in todayContext.rangeOptions" :key="`from-${option.period}`" :value="option.period">
                      {{ option.label }} · {{ option.startTime }} - {{ option.endTime }}
                    </option>
                  </select>
                </div>

                <div class="field-block">
                  <span>结束节次</span>
                  <select v-model.number="form.toPeriod" class="native-select">
                    <option
                      v-for="option in availableRangeEndOptions"
                      :key="`to-${option.period}`"
                      :value="option.period"
                    >
                      {{ option.label }} · {{ option.startTime }} - {{ option.endTime }}
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <section class="apply-section">
              <div class="apply-section__label">请假类型</div>
              <div class="chip-list">
                <button
                  v-for="item in leaveTypeOptions"
                  :key="item.value"
                  type="button"
                  class="chip-pill chip-pill--type"
                  :class="{ 'chip-pill--active': form.leaveType === item.value }"
                  @click="form.leaveType = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </section>

            <section class="apply-section apply-section--input">
              <div class="apply-section__label">请假原因</div>
              <p class="field-hint">请填写当天请假原因，至少 5 个字。</p>
              <van-field
                v-model="form.reason"
                type="textarea"
                rows="4"
                autosize
                maxlength="200"
                show-word-limit
                placeholder="请填写当天请假原因，至少 5 个字"
                class="plain-field"
              />
            </section>
          </template>
        </section>

        <section v-else-if="form.mode === 'weekend'" class="apply-ticket apply-ticket--weekend">
          <header class="apply-ticket__header">
            <div class="apply-ticket__heading">
              <p class="apply-ticket__eyebrow">周末 / 节假日报备</p>
              <h2 class="apply-ticket__title">回家报备</h2>
              <p class="apply-ticket__subtitle">此模式只做回家报备，不进入教师审批，提交后会直接归档到历史记录。</p>
            </div>
          </header>

          <section class="apply-ticket__hero">
            <p class="inline-note inline-note--accent">
              当前选择：<strong>{{ selectedWeekendTarget?.label || '未选择报备对象' }}</strong>
            </p>

            <p v-if="!weekendTargets.length" class="inline-note inline-note--warn">
              请先在教师端维护节假日，或等待临近周末后再提交。
            </p>
          </section>

          <section v-if="weekendTargets.length" class="apply-section">
            <div class="apply-section__label">选择报备对象</div>
            <div class="target-list">
              <button
                v-for="target in weekendTargets"
                :key="target.id"
                type="button"
                class="target-card"
                :class="{ 'target-card--active': form.targetId === target.id }"
                @click="form.targetId = target.id"
              >
                <div class="target-card__head">
                  <div class="target-card__title">{{ target.label }}</div>
                  <span v-if="form.targetId === target.id" class="target-card__badge">已选择</span>
                </div>
                <div class="target-card__meta">
                  {{ formatRouteDate(target.startDate) }} 至 {{ formatRouteDate(target.endDate) }}
                </div>
              </button>
            </div>
          </section>
        </section>

        <section v-else class="apply-ticket apply-ticket--custom">
          <header class="apply-ticket__header">
            <div class="apply-ticket__heading">
              <p class="apply-ticket__eyebrow">其他请假</p>
              <h2 class="apply-ticket__title">跨日期 / 预约请假</h2>
              <p class="apply-ticket__subtitle">用于长假、预约和跨日期时间段请假，提交后仍会按命中课程进入审批。</p>
            </div>
          </header>

          <section class="apply-ticket__hero">
            <div class="time-grid">
              <button type="button" class="picker-card" @click="showStartPicker = true">
                <span class="picker-card__label">开始时间</span>
                <strong class="picker-card__value">{{ form.startTime ? formatMetaDateTime(form.startTime) : '请选择开始时间' }}</strong>
              </button>

              <button type="button" class="picker-card" @click="showEndPicker = true">
                <span class="picker-card__label">结束时间</span>
                <strong class="picker-card__value">{{ form.endTime ? formatMetaDateTime(form.endTime) : '请选择结束时间' }}</strong>
              </button>
            </div>

            <p class="inline-note inline-note--accent">
              时间安排：<strong>{{ customTimeSummaryText }}</strong>
            </p>
          </section>

          <section class="apply-section">
            <div class="apply-section__label">请假类型</div>
            <div class="chip-list">
              <button
                v-for="item in leaveTypeOptions"
                :key="item.value"
                type="button"
                class="chip-pill chip-pill--type"
                :class="{ 'chip-pill--active': form.leaveType === item.value }"
                @click="form.leaveType = item.value"
              >
                {{ item.label }}
              </button>
            </div>
          </section>

          <section class="apply-section apply-section--input">
            <div class="apply-section__label">请假原因</div>
            <p class="field-hint">请填写跨日期或预约请假的原因，至少 5 个字。</p>
            <van-field
              v-model="form.reason"
              type="textarea"
              rows="4"
              autosize
              maxlength="200"
              show-word-limit
              placeholder="请填写请假原因，至少 5 个字"
              class="plain-field"
            />
          </section>
        </section>
      </template>
    </div>

    <div class="submit-wrap">
      <div class="submit-card" :class="`submit-card--${form.mode}`">
        <div class="submit-card__summary">
          <strong>{{ submitSummaryPrimary }}</strong>
          <span>{{ submitSummarySecondary }}</span>
        </div>
        <van-button
          round
          block
          type="primary"
          class="submit-card__button"
          :loading="submitting"
          :disabled="submitDisabled"
          @click="handleSubmit"
        >
          {{ submitText }}
        </van-button>
      </div>
    </div>

    <ProjectModal
      v-model="showStartPicker"
      title="选择开始时间"
      size="md"
      panel-class="leave-picker-modal"
      body-class="project-modal-body--flush leave-picker-modal__body"
    >
      <van-picker-group
        title=""
        :tabs="['选择日期', '选择时间']"
        @confirm="onStartConfirm"
        @cancel="showStartPicker = false"
      >
        <van-date-picker v-model="startDateValues" />
        <van-time-picker v-model="startTimeValues" />
      </van-picker-group>
    </ProjectModal>

    <ProjectModal
      v-model="showEndPicker"
      title="选择结束时间"
      size="md"
      panel-class="leave-picker-modal"
      body-class="project-modal-body--flush leave-picker-modal__body"
    >
      <van-picker-group
        title=""
        :tabs="['选择日期', '选择时间']"
        @confirm="onEndConfirm"
        @cancel="showEndPicker = false"
      >
        <van-date-picker v-model="endDateValues" />
        <van-time-picker v-model="endTimeValues" />
      </van-picker-group>
    </ProjectModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getLeaveContext, submitLeave } from '../api/student';
import ProjectModal from '../components/ProjectModal.vue';
import {
  formatApiDateTimeValue,
  normalizeApiDateTimeValue,
  parseApiDateTimeValue
} from '../utils/date';

const router = useRouter();

const SWITCH_GAP = 8;
const PAGE_HEAD_COMPACT_SCROLL_Y = 0.82;

const modeOptions = [
  { value: 'today', label: '当天请假', shortLabel: '当天', description: '自动识别当前位置并生成快捷选项' },
  { value: 'weekend', label: '周末报备', shortLabel: '周末', description: '节假日和周末回家报备，无需审批' },
  { value: 'custom', label: '其他请假', shortLabel: '预约', description: '长假、预约和跨日期时间段请假' }
];

const leaveTypeOptions = [
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
  { value: 'other', label: '其他' }
];

const contextLoading = ref(false);
const submitting = ref(false);
const todayContext = ref({
  available: false,
  reason: '',
  currentLocation: 'dormitory',
  currentLocationLabel: '宿舍',
  currentCourse: null,
  presets: [],
  rangeOptions: [],
  copyText: ''
});
const weekendTargets = ref([]);
const isPageHeadCompact = ref(false);
const headerMotionProgress = ref(0);
const pageHeadTitleRef = ref(null);
const pageNavTitleTargetRef = ref(null);
const modeSwitchRef = ref(null);
const titleMotionSourceRect = ref(null);
const titleMotionTargetRect = ref(null);

let headerMotionRafId = 0;

const CUSTOM_LEAVE_MAX_DAYS = 14;
const CUSTOM_LEAVE_MAX_LOOKBACK_DAYS = 30;

const now = new Date();
const currentYear = String(now.getFullYear());
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
const currentDay = String(now.getDate()).padStart(2, '0');
const currentHour = String(now.getHours()).padStart(2, '0');
const currentMinute = String(now.getMinutes()).padStart(2, '0');

const startDateValues = ref([currentYear, currentMonth, currentDay]);
const startTimeValues = ref([currentHour, currentMinute]);
const endDateValues = ref([currentYear, currentMonth, currentDay]);
const endTimeValues = ref([currentHour, currentMinute]);
const showStartPicker = ref(false);
const showEndPicker = ref(false);

const form = ref({
  mode: 'today',
  leaveType: 'sick',
  reason: '',
  selectionKind: 'preset',
  presetId: '',
  fromPeriod: null,
  toPeriod: null,
  targetId: '',
  startTime: '',
  endTime: ''
});

const currentLeaveTypeLabel = computed(() => (
  leaveTypeOptions.find((item) => item.value === form.value.leaveType)?.label || '未选择'
));

const selectedWeekendTarget = computed(() => (
  weekendTargets.value.find((item) => item.id === form.value.targetId) || null
));

const todayLocationLabel = computed(() => todayContext.value.currentLocationLabel || '宿舍');

const todaySummaryText = computed(() => {
  if (!todayContext.value.available) {
    return todayContext.value.reason || '当前没有可请假的课程。';
  }

  if (todayContext.value.currentCourse) {
    return '已识别当前课堂，可直接覆盖剩余课程或切换到自定义范围。';
  }

  return '已识别当前位置，可快速请今天剩余课程，也可以手动选择节次范围。';
});

const availableRangeEndOptions = computed(() => {
  if (!form.value.fromPeriod) {
    return todayContext.value.rangeOptions;
  }

  return todayContext.value.rangeOptions.filter((item) => item.period >= form.value.fromPeriod);
});

const todaySelectionSummaryText = computed(() => {
  if (!todayContext.value.available) {
    return '当前不可提交';
  }

  if (form.value.selectionKind === 'preset') {
    const preset = todayContext.value.presets.find((item) => item.id === form.value.presetId);
    return preset?.label || '请先选择快捷范围';
  }

  const fromOption = todayContext.value.rangeOptions.find((item) => item.period === form.value.fromPeriod);
  const toOption = todayContext.value.rangeOptions.find((item) => item.period === form.value.toPeriod);

  if (!fromOption || !toOption) {
    return '请先选择节次范围';
  }

  return `${fromOption.label} 至 ${toOption.label}`;
});

const customTimeSummaryText = computed(() => {
  if (!form.value.startTime || !form.value.endTime) {
    return '请选择开始与结束时间';
  }

  return `${formatMetaDateTime(form.value.startTime)} 至 ${formatMetaDateTime(form.value.endTime)}`;
});

const selectedWeekendRangeText = computed(() => {
  if (!selectedWeekendTarget.value) {
    return '请选择报备对象';
  }

  return `${formatRouteDate(selectedWeekendTarget.value.startDate)} 至 ${formatRouteDate(selectedWeekendTarget.value.endDate)}`;
});

const submitDisabled = computed(() => {
  if (contextLoading.value || submitting.value) {
    return true;
  }

  if (form.value.mode === 'today') {
    return !todayContext.value.available;
  }

  if (form.value.mode === 'weekend') {
    return weekendTargets.value.length === 0;
  }

  return false;
});

const submitText = computed(() => (form.value.mode === 'weekend' ? '提交报备' : '提交'));

const pageMetaText = computed(() => {
  if (contextLoading.value) {
    return '正在同步请假信息...';
  }

  if (form.value.mode === 'today') {
    return todayContext.value.available
      ? `今天 · ${todaySelectionSummaryText.value}`
      : '今天 · 暂不可提交';
  }

  if (form.value.mode === 'weekend') {
    return weekendTargets.value.length
      ? `周末 · ${selectedWeekendTarget.value ? selectedWeekendTarget.value.label : '选择报备对象'}`
      : '周末 · 暂无可报备目标';
  }

  return form.value.startTime && form.value.endTime
    ? `其他 · 已选择时间`
    : '其他 · 选择时间';
});

const submitSummaryPrimary = computed(() => {
  if (contextLoading.value) {
    return '正在准备申请信息';
  }

  if (submitting.value) {
    return form.value.mode === 'weekend' ? '正在提交回家报备' : '正在提交请假';
  }

  if (form.value.mode === 'today') {
    return currentLeaveTypeLabel.value;
  }

  if (form.value.mode === 'weekend') {
    return '回家报备';
  }

  return currentLeaveTypeLabel.value;
});

const submitSummarySecondary = computed(() => {
  if (contextLoading.value) {
    return '请稍候';
  }

  if (submitting.value) {
    return form.value.mode === 'weekend' ? selectedWeekendRangeText.value : customTimeSummaryText.value;
  }

  if (form.value.mode === 'today') {
    return todaySelectionSummaryText.value;
  }

  if (form.value.mode === 'weekend') {
    return selectedWeekendTarget.value ? selectedWeekendRangeText.value : '选择需要报备的日期';
  }

  return customTimeSummaryText.value;
});

const pageHeadTitleStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.2))
}));

const pageHeadMetaStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.5)),
  transform: `translate3d(0, ${Math.min(headerMotionProgress.value * -6, 6)}px, 0)`
}));

const sharedTitleStyle = computed(() => {
  const sourceRect = titleMotionSourceRect.value;
  const targetRect = titleMotionTargetRect.value;
  const progress = headerMotionProgress.value;

  if (!sourceRect || !targetRect) {
    return {
      opacity: '0',
      pointerEvents: 'none'
    };
  }

  const easedProgress = easeInOutCubic(progress);
  const targetScale = clamp(targetRect.width / Math.max(sourceRect.width, 1), 0.5, 1);
  const curveLift = prefersReducedMotion()
    ? 0
    : Math.sin(easedProgress * Math.PI) * 3.2;
  const translateX = lerp(sourceRect.left, targetRect.left, easedProgress);
  const translateY = lerp(sourceRect.top, targetRect.top, easedProgress) - curveLift;
  const scale = lerp(1, targetScale, easedProgress);
  const opacity = clamp((progress - 0.06) / 0.26, 0, 1);

  return {
    opacity: String(opacity),
    transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    filter: prefersReducedMotion() ? 'none' : `blur(${(Math.sin(progress * Math.PI) * 0.8).toFixed(2)}px)`,
    pointerEvents: 'none'
  };
});

function getSwitchStyle(tabs) {
  return {
    '--switch-count': String(tabs.length)
  };
}

function getSwitchIndicatorStyle(tabs, activeValue) {
  const activeIndex = Math.max(
    tabs.findIndex((item) => item.value === activeValue),
    0
  );
  const totalGap = (tabs.length - 1) * SWITCH_GAP;
  const tabWidth = `((100% - ${totalGap}px) / ${tabs.length})`;

  return {
    width: `calc(${tabWidth} - (var(--switch-indicator-inset) * 2))`,
    left: `calc(${activeIndex} * (${tabWidth} + ${SWITCH_GAP}px) + var(--switch-indicator-inset))`
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, progress) {
  return start + ((end - start) * progress);
}

function easeInOutCubic(value) {
  if (value < 0.5) {
    return 4 * value * value * value;
  }

  return 1 - (Math.pow(-2 * value + 2, 3) / 2);
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatDateValue(dateStr, options) {
  return formatApiDateTimeValue(dateStr, options, '--');
}

function formatRouteDate(dateStr) {
  return formatDateValue(dateStr, {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
}

function formatRouteTime(dateStr) {
  return formatDateValue(dateStr, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatMetaDateTime(dateStr) {
  return formatDateValue(dateStr, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function measureHeaderMotionRects() {
  if (
    typeof window === 'undefined'
    || !pageHeadTitleRef.value
    || !pageNavTitleTargetRef.value
  ) {
    return null;
  }

  const sourceRect = pageHeadTitleRef.value.getBoundingClientRect();
  const targetRect = pageNavTitleTargetRef.value.getBoundingClientRect();

  return {
    sourceRect: {
      left: sourceRect.left,
      top: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height
    },
    targetRect: {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height
    }
  };
}

function setDateTimeStrings(target, dateValues, timeValues) {
  const [year, month, day] = dateValues.value;
  const [hour, minute] = timeValues.value;
  form.value[target] = `${year}-${month}-${day} ${hour}:${minute}`;
}

function syncTodaySelection() {
  const firstPreset = todayContext.value.presets[0];
  const firstRange = todayContext.value.rangeOptions[0];

  if (firstPreset) {
    form.value.selectionKind = 'preset';
    form.value.presetId = firstPreset.id;
    form.value.fromPeriod = firstPreset.fromPeriod;
    form.value.toPeriod = firstPreset.toPeriod;
    return;
  }

  form.value.selectionKind = 'range';
  form.value.presetId = '';
  form.value.fromPeriod = firstRange?.period || null;
  form.value.toPeriod = firstRange?.period || null;
}

function syncWeekendTarget() {
  if (!weekendTargets.value.length) {
    form.value.targetId = '';
    return;
  }

  if (!weekendTargets.value.some((item) => item.id === form.value.targetId)) {
    form.value.targetId = weekendTargets.value[0].id;
  }
}

function selectPreset(presetId) {
  const preset = todayContext.value.presets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  form.value.selectionKind = 'preset';
  form.value.presetId = preset.id;
  form.value.fromPeriod = preset.fromPeriod;
  form.value.toPeriod = preset.toPeriod;
}

function selectRangeMode() {
  const firstRange = todayContext.value.rangeOptions[0];
  form.value.selectionKind = 'range';
  form.value.presetId = '';
  form.value.fromPeriod = form.value.fromPeriod || firstRange?.period || null;
  form.value.toPeriod = form.value.toPeriod || firstRange?.period || null;
}

async function switchMode(mode) {
  if (form.value.mode === mode) {
    return;
  }

  form.value.mode = mode;
  form.value.reason = '';

  await nextTick();

  if (typeof window !== 'undefined') {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  scheduleHeaderMotionSync();
}

function onStartConfirm() {
  setDateTimeStrings('startTime', startDateValues, startTimeValues);
  showStartPicker.value = false;
}

function onEndConfirm() {
  setDateTimeStrings('endTime', endDateValues, endTimeValues);
  showEndPicker.value = false;
}

function syncHeaderMotionState() {
  if (
    typeof window === 'undefined'
    || !pageHeadTitleRef.value
    || !pageNavTitleTargetRef.value
    || !modeSwitchRef.value
  ) {
    return;
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const switchRect = modeSwitchRef.value.getBoundingClientRect();
  const rects = measureHeaderMotionRects();

  if (rects) {
    titleMotionSourceRect.value = rects.sourceRect;
    titleMotionTargetRect.value = rects.targetRect;
  }

  const sourceTop = titleMotionSourceRect.value?.top ?? pageHeadTitleRef.value.getBoundingClientRect().top;
  const motionRange = Math.max(switchRect.top - sourceTop, 1);
  const rawProgress = clamp(scrollTop / motionRange, 0, 1);

  headerMotionProgress.value = rawProgress;
  isPageHeadCompact.value = rawProgress >= PAGE_HEAD_COMPACT_SCROLL_Y;
}

function scheduleHeaderMotionSync() {
  if (typeof window === 'undefined') {
    return;
  }

  window.cancelAnimationFrame(headerMotionRafId);
  headerMotionRafId = window.requestAnimationFrame(async () => {
    await nextTick();
    syncHeaderMotionState();
  });
}

async function loadContext() {
  contextLoading.value = true;

  try {
    const response = await getLeaveContext();
    todayContext.value = response.today || todayContext.value;
    weekendTargets.value = response.weekendTargets || [];
    syncTodaySelection();
    syncWeekendTarget();
  } catch (error) {
    showToast(error.response?.data?.error || '加载请假上下文失败');
  } finally {
    contextLoading.value = false;
    scheduleHeaderMotionSync();
  }
}

function validateReason() {
  const reason = form.value.reason.trim();
  if (reason.length < 5) {
    showToast('请假原因至少填写 5 个字');
    return false;
  }
  return true;
}

function validateCustomLeaveWindow() {
  const start = parseApiDateTimeValue(form.value.startTime);
  const end = parseApiDateTimeValue(form.value.endTime);

  if (!start || !end) {
    showToast('开始或结束时间格式无效');
    return false;
  }

  if (start >= end) {
    showToast('结束时间必须晚于开始时间');
    return false;
  }

  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > CUSTOM_LEAVE_MAX_DAYS) {
    showToast(`请假跨度不得超过 ${CUSTOM_LEAVE_MAX_DAYS} 天`);
    return false;
  }

  const earliestAllowedStart = new Date();
  earliestAllowedStart.setDate(earliestAllowedStart.getDate() - CUSTOM_LEAVE_MAX_LOOKBACK_DAYS);
  if (start < earliestAllowedStart) {
    showToast(`请假开始时间不得早于 ${CUSTOM_LEAVE_MAX_LOOKBACK_DAYS} 天前`);
    return false;
  }

  return true;
}

async function handleSubmit() {
  if (form.value.mode === 'today') {
    if (!todayContext.value.available) {
      showToast(todayContext.value.reason || '当前无法提交当天请假');
      return;
    }

    if (!validateReason()) {
      return;
    }

    if (form.value.selectionKind === 'range') {
      if (!form.value.fromPeriod || !form.value.toPeriod || form.value.fromPeriod > form.value.toPeriod) {
        showToast('请选择正确的课程范围');
        return;
      }
    }
  }

  if (form.value.mode === 'weekend') {
    if (!form.value.targetId) {
      showToast('请选择报备对象');
      return;
    }
  }

  if (form.value.mode === 'custom') {
    if (!form.value.startTime || !form.value.endTime) {
      showToast('请选择开始和结束时间');
      return;
    }

    if (!validateCustomLeaveWindow()) {
      return;
    }

    if (!validateReason()) {
      return;
    }
  }

  const payload = {};

  if (form.value.mode === 'today') {
    Object.assign(payload, {
      mode: 'today',
      leaveType: form.value.leaveType,
      reason: form.value.reason.trim(),
      selectionKind: form.value.selectionKind
    });

    if (form.value.selectionKind === 'preset') {
      payload.presetId = form.value.presetId;
    } else {
      payload.fromPeriod = form.value.fromPeriod;
      payload.toPeriod = form.value.toPeriod;
    }
  } else if (form.value.mode === 'weekend') {
    Object.assign(payload, {
      mode: 'weekend',
      targetId: form.value.targetId
    });
  } else {
    Object.assign(payload, {
      mode: 'custom',
      leaveType: form.value.leaveType,
      reason: form.value.reason.trim(),
      startTime: normalizeApiDateTimeValue(form.value.startTime),
      endTime: normalizeApiDateTimeValue(form.value.endTime)
    });
  }

  submitting.value = true;
  try {
    await submitLeave(payload);
    showToast(form.value.mode === 'weekend' ? '回家报备成功' : '提交成功');
    router.push('/leaves');
  } catch (error) {
    showToast(error.response?.data?.error || '提交失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  setDateTimeStrings('startTime', startDateValues, startTimeValues);
  setDateTimeStrings('endTime', endDateValues, endTimeValues);
  loadContext();

  if (typeof window !== 'undefined') {
    scheduleHeaderMotionSync();
    window.addEventListener('scroll', scheduleHeaderMotionSync, { passive: true });
    window.addEventListener('resize', scheduleHeaderMotionSync, { passive: true });
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', scheduleHeaderMotionSync);
    window.removeEventListener('resize', scheduleHeaderMotionSync);
    window.cancelAnimationFrame(headerMotionRafId);
  }
});
</script>

<style scoped>
.leave-apply-page {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  scroll-padding-top: calc(88px + env(safe-area-inset-top, 0px));
  background:
    radial-gradient(circle at top right, rgba(79, 148, 255, 0.12) 0%, rgba(79, 148, 255, 0) 24%),
    linear-gradient(180deg, #f8fbff 0%, #f1f5fb 42%, #e8eef8 100%);
}

.page-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  min-height: calc(58px + env(safe-area-inset-top, 0px));
  padding: calc(10px + env(safe-area-inset-top, 0px)) 14px 8px;
  display: flex;
  align-items: center;
}

.page-nav::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -18px;
  left: 0;
  height: 24px;
  background: linear-gradient(180deg, rgba(244, 247, 251, 0.6) 0%, rgba(244, 247, 251, 0.12) 48%, rgba(244, 247, 251, 0) 100%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.page-nav--compact::after {
  opacity: 1;
}

.page-nav__surface {
  position: absolute;
  inset: 0;
  opacity: 0;
  border-bottom: 1px solid rgba(223, 229, 239, 0.42);
  background:
    linear-gradient(180deg, rgba(250, 251, 254, 0.84) 0%, rgba(242, 245, 250, 0.8) 100%);
  box-shadow:
    0 10px 22px rgba(148, 163, 184, 0.05),
    inset 0 -1px 0 rgba(255, 255, 255, 0.54);
  backdrop-filter: blur(22px) saturate(115%);
  -webkit-backdrop-filter: blur(22px) saturate(115%);
  transition: opacity 220ms ease;
}

.page-nav--compact .page-nav__surface {
  opacity: 1;
}

.page-nav__center {
  position: absolute;
  inset: calc(env(safe-area-inset-top, 0px) + 6px) 52px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.page-nav__title {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  font-weight: 760;
  letter-spacing: -0.02em;
  color: #17326f;
}

.page-nav__title--target {
  opacity: 0;
}

.page-nav__shared-title {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 42;
  display: flex;
  align-items: center;
  transform-origin: left top;
  will-change: transform, opacity;
  backface-visibility: hidden;
}

.page-nav__shared-text {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.06em;
  color: #142b63;
}

.page-nav__back {
  width: 42px;
  height: 42px;
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  border: 1px solid rgba(214, 223, 238, 0.92);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 10px 20px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.page-nav__back svg {
  width: 18px;
  height: 18px;
}

.page-head {
  padding: 16px 14px 0;
}

.page-head__content {
  min-width: 0;
  padding: 4px 2px 0;
}

.page-head__heading {
  min-width: 0;
}

.page-head__eyebrow,
.apply-ticket__eyebrow,
.apply-section__label {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #6c7fa2;
}

.page-head__title {
  margin: 8px 0 0;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.06em;
  color: #142b63;
  transform-origin: left top;
}

.page-head__meta {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #617392;
  will-change: transform, opacity;
}

.mode-panel {
  padding: 12px 14px 0;
}

.panel-switch {
  --switch-indicator-inset: 16px;
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--switch-count), minmax(0, 1fr));
  gap: 18px;
  padding: 0 2px 10px;
}

.panel-switch__track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  background: rgba(194, 208, 228, 0.7);
  pointer-events: none;
}

.panel-switch__indicator {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb 0%, #4f8fff 100%);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.22);
  transition: left 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.panel-switch__item {
  min-width: 0;
  position: relative;
  z-index: 1;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #6b7f9f;
  padding: 0 2px;
  min-height: 30px;
  font-size: 15px;
  font-weight: 700;
  appearance: none;
  transition: color 0.2s ease, transform 0.18s ease;
}

.panel-switch__item--active {
  color: #1d4ed8;
  font-weight: 800;
}

.panel-switch__item:active,
.chip-pill:active,
.target-card:active,
.picker-card:active,
.page-nav__back:active {
  transform: scale(0.985);
}

.leave-apply-content {
  padding: 16px 14px 124px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.loading-block {
  margin-top: 56px;
  color: #476798;
}

.apply-ticket {
  --ticket-accent: #3b82f6;
  --ticket-soft: rgba(59, 130, 246, 0.1);
  --ticket-chip-bg: rgba(226, 236, 255, 0.96);
  --ticket-chip-color: #2451a6;
  --ticket-chip-glow: rgba(120, 174, 255, 0.48);
  --ticket-pill-border: rgba(96, 165, 250, 0.28);
  --ticket-pill-bg: rgba(222, 235, 255, 0.82);
  --ticket-pill-color: #1d4ed8;
  position: relative;
  overflow: hidden;
  padding: 18px;
  border: 1px solid rgba(220, 229, 241, 0.96);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(247, 250, 255, 0.94) 100%);
  box-shadow:
    0 18px 38px rgba(148, 163, 184, 0.09),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.apply-ticket::before {
  content: '';
  position: absolute;
  top: -76px;
  right: -36px;
  width: 176px;
  height: 176px;
  border-radius: 999px;
  background: radial-gradient(circle, var(--ticket-soft) 0%, rgba(255, 255, 255, 0) 72%);
  pointer-events: none;
}

.apply-ticket--today {
  --ticket-accent: #3b82f6;
  --ticket-soft: rgba(59, 130, 246, 0.12);
  --ticket-chip-bg: rgba(224, 235, 255, 0.96);
  --ticket-chip-color: #2250a8;
}

.apply-ticket--weekend {
  --ticket-accent: #16a34a;
  --ticket-soft: rgba(34, 197, 94, 0.11);
  --ticket-chip-bg: rgba(228, 248, 235, 0.98);
  --ticket-chip-color: #16703b;
  --ticket-chip-glow: rgba(111, 215, 145, 0.42);
  --ticket-pill-border: rgba(74, 222, 128, 0.32);
  --ticket-pill-bg: rgba(225, 247, 232, 0.88);
  --ticket-pill-color: #16703b;
}

.apply-ticket--custom {
  --ticket-accent: #d18a1f;
  --ticket-soft: rgba(245, 158, 11, 0.12);
  --ticket-chip-bg: rgba(255, 241, 217, 0.98);
  --ticket-chip-color: #9a650f;
  --ticket-chip-glow: rgba(240, 188, 92, 0.42);
  --ticket-pill-border: rgba(245, 193, 94, 0.34);
  --ticket-pill-bg: rgba(255, 240, 214, 0.9);
  --ticket-pill-color: #9a650f;
}

.apply-ticket__header,
.target-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(210, 220, 235, 0.7);
}

.apply-ticket__heading {
  min-width: 0;
  flex: 1 1 auto;
}

.apply-ticket__title {
  margin: 8px 0 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.04em;
  color: #17326f;
}

.apply-ticket__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #607495;
}

.apply-ticket__hero,
.apply-section {
  margin-top: 16px;
}

.context-strip {
  display: grid;
  gap: 0;
  padding: 2px 16px;
  border: 1px solid rgba(220, 229, 241, 0.94);
  border-radius: 20px;
  background: rgba(243, 247, 255, 0.88);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 8px 18px rgba(148, 163, 184, 0.05);
}

.context-strip__row,
.field-block {
  padding: 12px 0;
}

.context-strip__row {
  border-bottom: 1px solid rgba(214, 224, 238, 0.72);
}

.context-strip__row:last-child {
  border-bottom: 0;
}

.context-strip__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.context-strip__row span,
.field-block span,
.picker-card__label,
.submit-card__summary span {
  font-size: 12px;
  font-weight: 700;
  color: #6b7fa2;
}

.context-strip__row strong,
.target-card__title,
.picker-card__value {
  min-width: 0;
  text-align: right;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: #17326f;
}

.context-strip__row--muted strong,
.target-card__meta,
.field-hint,
.inline-note {
  font-size: 12px;
  line-height: 1.55;
  color: #6a7d9f;
}

.inline-note {
  margin: 0;
}

.inline-note strong {
  color: #17326f;
}

.inline-note--accent {
  color: #4f6488;
}

.inline-note--warn {
  color: #b45309;
}

.field-grid,
.target-list,
.time-grid {
  display: grid;
  gap: 12px 18px;
}

.field-grid--split,
.time-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.apply-section__label {
  margin-bottom: 10px;
}

.field-hint {
  margin: 0 0 10px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip-pill {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(214, 225, 240, 0.88);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(247, 250, 255, 0.7);
  color: #385b92;
  font-size: 13px;
  font-weight: 800;
  appearance: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, transform 0.18s ease;
}

.chip-pill--active {
  border-color: var(--ticket-pill-border);
  background: var(--ticket-pill-bg);
  color: var(--ticket-pill-color);
}

.native-select {
  width: 100%;
  min-height: 46px;
  margin-top: 8px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid rgba(214, 225, 240, 0.9);
  background: #fbfdff;
  color: #17326f;
  font-size: 14px;
}

.target-card {
  width: 100%;
  padding: 15px 16px;
  border: 1px solid rgba(220, 229, 241, 0.94);
  border-left: 3px solid transparent;
  border-radius: 20px;
  background: rgba(248, 251, 255, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 10px 20px rgba(148, 163, 184, 0.05);
  text-align: left;
  appearance: none;
  transition: transform 0.18s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.target-card--active {
  border-color: var(--ticket-pill-border);
  border-left-color: var(--ticket-accent);
  background: var(--ticket-pill-bg);
}

.target-card__badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  color: var(--ticket-chip-color);
  background: rgba(255, 255, 255, 0.76);
}

.picker-card {
  width: 100%;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  text-align: left;
  border: 1px solid rgba(220, 229, 241, 0.94);
  border-radius: 20px;
  background: rgba(248, 251, 255, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 10px 20px rgba(148, 163, 184, 0.05);
  appearance: none;
}

.submit-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
  background: linear-gradient(180deg, rgba(248, 251, 255, 0) 0%, rgba(248, 251, 255, 0.88) 30%, rgba(248, 251, 255, 0.98) 100%);
}

.submit-card {
  --submit-accent: #2563eb;
  --submit-accent-soft: #4f8fff;
  --submit-shadow: rgba(37, 99, 235, 0.24);
  padding: 14px;
  border: 1px solid rgba(220, 229, 241, 0.96);
  border-radius: 24px;
  background: rgba(248, 250, 255, 0.84);
  box-shadow:
    0 18px 36px rgba(148, 163, 184, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.submit-card--today {
  --submit-accent: #2563eb;
}

.submit-card--weekend {
  --submit-accent: #16a34a;
  --submit-accent-soft: #3bbf69;
  --submit-shadow: rgba(22, 163, 74, 0.24);
}

.submit-card--custom {
  --submit-accent: #d18a1f;
  --submit-accent-soft: #e6aa46;
  --submit-shadow: rgba(209, 138, 31, 0.24);
}

.submit-card__summary {
  display: flex;
  align-items: baseline;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  margin-bottom: 10px;
}

.submit-card__summary strong {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 16px;
  font-weight: 800;
  color: #17326f;
}

.submit-card__summary span {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submit-card__button {
  min-height: 48px;
  border: none;
  color: #fff;
  background: linear-gradient(135deg, var(--submit-accent-soft) 0%, var(--submit-accent) 100%);
  box-shadow: 0 12px 24px var(--submit-shadow);
}

.submit-card__button:disabled {
  box-shadow: none;
}

:deep(.van-field__control),
:deep(.van-field__control::placeholder) {
  color: #17326f;
}

:deep(.plain-field.van-field) {
  margin-top: 0;
  padding: 0;
  border-radius: 14px;
  background: #fbfdff;
  border: 1px solid rgba(214, 225, 240, 0.9);
}

:deep(.plain-field .van-field__body) {
  padding: 12px 14px;
}

:deep(.submit-card__button.van-button--primary) {
  border: none !important;
}

:deep(.leave-picker-modal) {
  max-height: 680px;
}

:deep(.leave-picker-modal .project-modal-body) {
  padding: 0;
}

:deep(.leave-picker-modal .van-picker-group),
:deep(.leave-picker-modal .van-picker) {
  background: transparent;
}

:deep(.leave-picker-modal .van-picker-group__toolbar) {
  padding: 0 18px 12px;
}

:deep(.leave-picker-modal .van-picker__mask) {
  background-image:
    linear-gradient(180deg, rgba(244, 248, 255, 0.96), rgba(244, 248, 255, 0.4)),
    linear-gradient(0deg, rgba(244, 248, 255, 0.96), rgba(244, 248, 255, 0.4));
}

@media (max-width: 720px) {
  .field-grid--split,
  .time-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .panel-switch {
    --switch-indicator-inset: 10px;
  }

  .page-head__title,
  .page-nav__shared-text {
    font-size: 30px;
  }

  .panel-switch {
    gap: 12px;
  }

  .apply-ticket__header,
  .context-strip__row,
  .target-card__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .context-strip__row strong {
    text-align: left;
  }

  .submit-card__summary {
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .submit-card__summary span {
    white-space: normal;
  }
}

@media (max-width: 375px) {
  .page-nav,
  .page-head,
  .mode-panel,
  .leave-apply-content,
  .submit-wrap {
    padding-left: 12px;
    padding-right: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-nav__surface,
  .page-nav::after,
  .panel-switch__indicator,
  .panel-switch__item,
  .submit-card__button,
  .chip-pill,
  .target-card,
  .picker-card,
  .page-head__meta {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

:deep(.van-button--disabled) {
  opacity: 0.62 !important;
}
</style>
