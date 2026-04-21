<template>
  <div class="my-leaves-page">
    <header class="page-nav" :class="{ 'page-nav--compact': isPageHeadCompact }">
      <div class="page-nav__surface" aria-hidden="true"></div>
      <div class="page-nav__center" aria-hidden="true">
        <div ref="pageNavTitleTargetRef" class="page-nav__title page-nav__title--target">请假历史</div>
      </div>

      <div class="page-nav__shared-title" :style="sharedTitleStyle" aria-hidden="true">
        <div class="page-nav__shared-text">请假历史</div>
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
        <div class="page-head__row">
          <div class="page-head__heading">
            <h1 ref="pageHeadTitleRef" class="page-head__title" :style="pageHeadTitleStyle">请假历史</h1>
            <p class="page-head__meta" :style="pageHeadMetaStyle">{{ summaryMetaText }}</p>
          </div>

          <div class="page-head__actions" :style="pageHeadActionsStyle">
            <button
              type="button"
              class="page-head__refresh"
              :class="{ 'page-head__refresh--spinning': refreshing }"
              :disabled="loading || refreshing || isPageHeadCompact || launchingDingTalk"
              aria-label="刷新请假状态"
              title="刷新请假状态"
              @click="handleManualRefresh"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 11A8 8 0 1 0 18.13 16.13"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M20 4V11H13"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>刷新</span>
            </button>

            <button
              type="button"
              class="page-head__dingtalk"
              :disabled="launchingDingTalk || isPageHeadCompact"
              aria-label="跳转钉钉询问"
              title="跳转钉钉询问"
              @click="handleOpenDingTalk"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 8.5C7 7.11929 8.11929 6 9.5 6H14.5C15.8807 6 17 7.11929 17 8.5V12.5C17 13.8807 15.8807 15 14.5 15H11.2L8 17.6V15.2C7.4174 14.7684 7 14.0784 7 13.3V8.5Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M10 10.5H14"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
              <span>跳转钉钉询问</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section ref="filtersPanelRef" class="filters-panel" aria-label="筛选条件">
      <div class="filter-group">
        <div class="filter-group__label">状态</div>
        <div class="panel-switch" :style="getSwitchStyle(statusTabs)">
          <span class="panel-switch__track" aria-hidden="true">
            <span class="panel-switch__indicator" :style="getSwitchIndicatorStyle(statusTabs, activeStatus)" />
          </span>
          <button
            v-for="item in statusTabs"
            :key="item.value"
            type="button"
            class="panel-switch__item"
            :class="{ 'panel-switch__item--active': activeStatus === item.value }"
            @click="changeStatus(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-group__label">模式</div>
        <div class="panel-switch panel-switch--compact" :style="getSwitchStyle(modeTabs)">
          <span class="panel-switch__track" aria-hidden="true">
            <span class="panel-switch__indicator" :style="getSwitchIndicatorStyle(modeTabs, activeMode)" />
          </span>
          <button
            v-for="item in modeTabs"
            :key="item.value"
            type="button"
            class="panel-switch__item"
            :class="{ 'panel-switch__item--active': activeMode === item.value }"
            @click="changeMode(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </section>

    <div class="leaves-content">
      <van-loading v-if="loading" size="24px" vertical class="loading-block">加载中...</van-loading>

      <template v-else>
        <article
          v-for="leave in leaves"
          :key="leave.id"
          class="ticket-card"
          :class="`ticket-card--${leave.status}`"
        >
          <header class="ticket-card__header">
            <div class="ticket-card__heading">
              <p class="ticket-card__eyebrow">{{ getModeText(leave.request_mode) }}</p>
              <div class="ticket-card__title-row">
                <h2 class="ticket-card__title">{{ getLeaveTitle(leave) }}</h2>
                <span class="status-chip" :class="`status-chip--${leave.status}`">
                  {{ getStatusText(leave.status) }}
                </span>
              </div>
              <p class="ticket-card__subtitle">{{ getLeaveSubtitle(leave) }}</p>
            </div>
          </header>

          <section class="ticket-card__hero">
            <div class="ticket-card__hero-label">请假时段</div>

            <div class="ticket-card__route">
              <div class="ticket-card__route-stop">
                <span class="ticket-card__route-caption">开始</span>
                <strong>{{ formatRouteDate(leave.start_time) }}</strong>
                <small>{{ formatRouteTime(leave.start_time) }}</small>
              </div>

              <div class="ticket-card__route-line" aria-hidden="true">
                <span></span>
              </div>

              <div class="ticket-card__route-stop">
                <span class="ticket-card__route-caption">结束</span>
                <strong>{{ formatRouteDate(leave.end_time) }}</strong>
                <small>{{ formatRouteTime(leave.end_time) }}</small>
              </div>
            </div>

            <div class="ticket-card__summary-grid">
              <div class="ticket-card__summary-item ticket-card__summary-item--time">
                <span>{{ getPrimaryTimeLabel(leave) }}</span>
                <strong>{{ getPrimaryTimeRelativeText(leave) }}</strong>
                <small>{{ formatMetaDateTime(getPrimaryTimeValue(leave)) }}</small>
              </div>

              <div class="ticket-card__summary-item">
                <span>处理进度</span>
                <strong>{{ getStatusSummary(leave) }}</strong>
                <small v-if="leave.reviewed_at">{{ getStatusText(leave.status) }}</small>
              </div>

              <div v-if="leave.request_mode === 'weekend'" class="ticket-card__summary-item ticket-card__summary-item--full">
                <span>报备结果</span>
                <strong>{{ leave.go_home ? '回家' : '留校' }}</strong>
              </div>
            </div>

            <div class="ticket-card__reason detail-panel detail-panel--hero">
              <div class="detail-panel__label">请假原因</div>
              <div class="detail-panel__value">{{ getReasonText(leave) }}</div>
            </div>
          </section>

          <div class="ticket-card__divider">
            <span>详细信息</span>
          </div>

          <button
            type="button"
            class="ticket-card__toggle"
            :aria-expanded="isExpanded(leave.id)"
            @click="toggleDetails(leave.id)"
          >
            <span>{{ isExpanded(leave.id) ? '收起详细内容' : '展开详细内容' }}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              :class="{ 'ticket-card__toggle-icon--open': isExpanded(leave.id) }"
            >
              <path
                d="M7 10L12 15L17 10"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <section v-if="isExpanded(leave.id)" class="ticket-card__details">
            <div class="detail-grid">
              <div v-if="leave.current_location" class="detail-grid__item">
                <span>识别地点</span>
                <strong>{{ getLocationText(leave.current_location) }}</strong>
              </div>

              <div v-if="leave.request_mode === 'weekend'" class="detail-grid__item">
                <span>报备结果</span>
                <strong>{{ leave.go_home ? '回家' : '留校' }}</strong>
              </div>

              <div class="detail-grid__item">
                <span>命中课程</span>
                <strong>{{ getRecordCountText(leave.records) }}</strong>
              </div>

              <div v-if="leave.reviewed_at" class="detail-grid__item">
                <span>审批时间</span>
                <strong>{{ formatMetaDateTime(leave.reviewed_at) }}</strong>
              </div>
            </div>

            <div v-if="leave.history_notice" class="note-panel note-panel--history">
              <div class="note-panel__label">历史说明</div>
              <div class="note-panel__value">{{ leave.history_notice }}</div>
            </div>

            <div v-if="leave.teacher_comment" class="note-panel note-panel--comment">
              <div class="note-panel__label">审批意见</div>
              <div class="note-panel__value">{{ leave.teacher_comment }}</div>
            </div>

            <div class="records-panel">
              <div class="records-panel__header">
                <div>
                  <div class="records-panel__label">课程明细</div>
                  <div class="records-panel__meta">保留当前记录中的全部命中课程信息</div>
                </div>
                <strong>{{ getRecordCountText(leave.records) }}</strong>
              </div>

              <div v-if="leave.records?.length" class="records-list">
                <div
                  v-for="(record, index) in leave.records"
                  :key="buildRecordKey(record, index)"
                  class="record-card"
                >
                  <div class="record-card__top">
                    <strong>{{ getRecordTitle(record) }}</strong>
                    <span>{{ formatRecordDate(resolveLeaveRecordDate(record)) }}</span>
                  </div>
                  <div class="record-card__bottom">
                    <span>{{ record.subject || '课程待确认' }}</span>
                    <span>{{ getRecordTimeText(record) }}</span>
                  </div>
                </div>
              </div>

              <div v-else class="records-panel__empty">当前记录没有命中课程明细</div>
            </div>
          </section>
        </article>

        <van-empty v-if="!leaves.length" description="暂无请假记录" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getMyLeaves } from '../api/student';
import {
  formatApiDateTimeValue,
  parseApiDateTimeValue,
  resolveLeaveRecordDate
} from '../utils/date';
import { launchDingTalkHome } from '../utils/externalApps';

const router = useRouter();

const SWITCH_GAP = 8;

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'reviewed', label: '已处理' }
];

const modeTabs = [
  { value: 'all', label: '全部模式' },
  { value: 'today', label: '当天请假' },
  { value: 'custom', label: '其他请假' },
  { value: 'weekend', label: '周末报备' }
];

const weekdayMap = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日'
};

const activeStatus = ref('all');
const activeMode = ref('all');
const loading = ref(false);
const refreshing = ref(false);
const launchingDingTalk = ref(false);
const leaves = ref([]);
const expandedLeaveIds = ref([]);
const isPageHeadCompact = ref(false);
const headerMotionProgress = ref(0);
const headerMotionBlur = ref(0);
const pageHeadTitleRef = ref(null);
const pageNavTitleTargetRef = ref(null);
const filtersPanelRef = ref(null);
const titleMotionSourceRect = ref(null);
const titleMotionTargetRect = ref(null);

const PAGE_HEAD_COMPACT_SCROLL_Y = 0.74;

let headerMotionRafId = 0;

const currentStatusLabel = computed(() => (
  statusTabs.find((item) => item.value === activeStatus.value)?.label || '全部'
));

const currentModeLabel = computed(() => (
  modeTabs.find((item) => item.value === activeMode.value)?.label || '全部模式'
));

const summaryMetaText = computed(() => {
  if (loading.value) {
    return '正在同步请假记录...';
  }

  if (refreshing.value) {
    return '正在刷新请假状态...';
  }

  return `${leaves.value.length} 条记录 · ${currentStatusLabel.value} · ${currentModeLabel.value}`;
});

const pageHeadTitleStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.35))
}));

const pageHeadMetaStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.8)),
  transform: `translate3d(0, ${Math.min(headerMotionProgress.value * -8, 8)}px, 0)`
}));

const pageHeadActionsStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 2.4)),
  transform: `translate3d(0, ${headerMotionProgress.value * -10}px, 0) scale(${1 - headerMotionProgress.value * 0.08})`,
  pointerEvents: headerMotionProgress.value > 0.7 ? 'none' : 'auto'
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
  const sourceScale = 1;
  const targetScale = clamp(targetRect.width / Math.max(sourceRect.width, 1), 0.48, 1);
  const curveLift = prefersReducedMotion()
    ? 0
    : Math.sin(easedProgress * Math.PI) * 5.5;
  const translateX = lerp(sourceRect.left, targetRect.left, easedProgress);
  const translateY = lerp(sourceRect.top, targetRect.top, easedProgress) - curveLift;
  const scale = lerp(sourceScale, targetScale, easedProgress);
  const opacity = clamp((progress - 0.05) / 0.22, 0, 1);

  return {
    opacity: String(opacity),
    transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
    filter: `blur(${headerMotionBlur.value.toFixed(2)}px)`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
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

function getStatusText(status) {
  return {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
    recorded: '已报备'
  }[status] || status || '处理中';
}

function getModeText(mode) {
  return {
    today: '当天请假',
    custom: '其他请假',
    weekend: '周末 / 节假日报备'
  }[mode] || mode || '请假记录';
}

function getLeaveTitle(leave) {
  if (leave.request_mode === 'weekend') {
    return leave.go_home ? '周末回家报备' : '周末留校报备';
  }

  return {
    sick: '病假',
    personal: '事假',
    other: '其他请假'
  }[leave.leave_type] || '请假单';
}

function getLeaveSubtitle(leave) {
  if (leave.request_mode === 'weekend') {
    return leave.go_home ? '回家安排已归档，可作为报备记录查看' : '留校安排已归档，可作为报备记录查看';
  }

  if (leave.status === 'pending') {
    return '等待教官审批，当前记录已进入历史归档';
  }

  if (leave.status === 'rejected') {
    return '审批未通过，保留完整提交信息供复查';
  }

  if (leave.status === 'approved') {
    return '审批通过，以下为已归档的请假单内容';
  }

  return '已归档记录，可查看完整时间与课程明细';
}

function getLocationText(location) {
  return {
    dormitory: '宿舍',
    classroom: '教室',
    home: '家中',
    other: '其他'
  }[location] || '其他';
}

function getStatusSummary(leave) {
  if (leave.status === 'pending') {
    return '等待审批';
  }

  if (leave.reviewed_at) {
    return formatMetaDateTime(leave.reviewed_at);
  }

  return getStatusText(leave.status);
}

function getPrimaryTimeLabel(leave) {
  return {
    approved: '通过时间',
    rejected: '拒绝时间',
    recorded: '报备时间',
    pending: '提交时间'
  }[leave?.status] || '处理时间';
}

function getPrimaryTimeValue(leave) {
  if (!leave) {
    return null;
  }

  if (leave.status === 'pending') {
    return leave.submitted_at || null;
  }

  return leave.reviewed_at || leave.submitted_at || null;
}

function getRelativeDateText(dateStr) {
  if (!dateStr) {
    return '-';
  }

  const targetDate = parseApiDateTimeValue(dateStr);
  if (!targetDate) {
    return '-';
  }

  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return '当日';
  }

  return `${diffDays}天前`;
}

function getPrimaryTimeRelativeText(leave) {
  return getRelativeDateText(getPrimaryTimeValue(leave));
}

function getReasonText(leave) {
  if (leave.reason) {
    return leave.reason;
  }

  if (leave.request_mode === 'weekend') {
    return '周末 / 节假日报备记录无需填写请假原因。';
  }

  return '无';
}

function getRecordCountText(records) {
  const count = Array.isArray(records) ? records.length : 0;
  return `${count} 节`;
}

function getWeekdayText(value) {
  if (weekdayMap[value]) {
    return weekdayMap[value];
  }

  return value ? String(value) : '未排定';
}

function getRecordTitle(record) {
  const parts = [getWeekdayText(record.weekday)];

  if (record.period) {
    parts.push(`第 ${record.period} 节`);
  }

  return parts.join(' · ');
}

function getRecordTimeText(record) {
  if (record.startTime && record.endTime) {
    return `${record.startTime} - ${record.endTime}`;
  }

  return '时间待确认';
}

function buildRecordKey(record, index) {
  return [
    resolveLeaveRecordDate(record) || 'date',
    record.weekday || 'weekday',
    record.period || 'period',
    record.subject || 'subject',
    index
  ].join('-');
}

function formatDateValue(dateStr, options) {
  return formatApiDateTimeValue(dateStr, options);
}

function formatRouteDate(dateStr) {
  return formatDateValue(dateStr, {
    month: '2-digit',
    day: '2-digit'
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

function syncHeaderMotionState() {
  if (
    typeof window === 'undefined'
    || !pageHeadTitleRef.value
    || !pageNavTitleTargetRef.value
    || !filtersPanelRef.value
  ) {
    return;
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const filtersRect = filtersPanelRef.value.getBoundingClientRect();
  const rects = measureHeaderMotionRects();
  if (rects) {
    titleMotionSourceRect.value = rects.sourceRect;
    titleMotionTargetRect.value = rects.targetRect;
  }

  const sourceTop = titleMotionSourceRect.value?.top ?? pageHeadTitleRef.value.getBoundingClientRect().top;
  const motionRange = Math.max(filtersRect.top - sourceTop, 1);
  const rawProgress = clamp(scrollTop / motionRange, 0, 1);
  headerMotionProgress.value = rawProgress;
  headerMotionBlur.value = prefersReducedMotion()
    ? 0
    : Math.sin(rawProgress * Math.PI) * 2.1;
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

function formatRecordDate(dateStr) {
  if (!dateStr) {
    return '日期待确认';
  }

  return formatDateValue(`${dateStr}T00:00:00`, {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
}

function isExpanded(id) {
  return expandedLeaveIds.value.includes(id);
}

function toggleDetails(id) {
  if (isExpanded(id)) {
    expandedLeaveIds.value = expandedLeaveIds.value.filter((item) => item !== id);
    return;
  }

  expandedLeaveIds.value = [...expandedLeaveIds.value, id];
}

function syncExpandedIds() {
  const validIds = new Set(leaves.value.map((leave) => leave.id));
  expandedLeaveIds.value = expandedLeaveIds.value.filter((id) => validIds.has(id));
}

async function loadLeaves(options = {}) {
  const isManualRefresh = options.manualRefresh === true;

  if (isManualRefresh) {
    refreshing.value = true;
  } else {
    loading.value = true;
  }

  try {
    const params = {};

    if (activeStatus.value === 'pending') {
      params.status = 'pending';
    } else if (activeStatus.value === 'reviewed') {
      params.status = 'approved,rejected,recorded';
    }

    if (activeMode.value !== 'all') {
      params.requestMode = activeMode.value;
    }

    leaves.value = await getMyLeaves(params);
    syncExpandedIds();
  } catch (error) {
    showToast(error.response?.data?.error || '加载失败');
  } finally {
    if (isManualRefresh) {
      refreshing.value = false;
    } else {
      loading.value = false;
    }
    scheduleHeaderMotionSync();
  }
}

function changeStatus(value) {
  if (activeStatus.value === value) {
    return;
  }

  activeStatus.value = value;
  loadLeaves();
}

function changeMode(value) {
  if (activeMode.value === value) {
    return;
  }

  activeMode.value = value;
  loadLeaves();
}

function handleManualRefresh() {
  if (loading.value || refreshing.value) {
    return;
  }

  loadLeaves({ manualRefresh: true });
}

async function handleOpenDingTalk() {
  if (launchingDingTalk.value || isPageHeadCompact.value) {
    return;
  }

  launchingDingTalk.value = true;

  try {
    const opened = await launchDingTalkHome();

    if (!opened) {
      showToast('未能打开钉钉，请确认已安装并允许打开外部应用');
    }
  } catch (error) {
    console.warn('Open DingTalk failed:', error);
    showToast('未能打开钉钉，请确认已安装并允许打开外部应用');
  } finally {
    launchingDingTalk.value = false;
  }
}

onMounted(() => {
  loadLeaves();

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
.my-leaves-page {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  scroll-padding-top: calc(86px + env(safe-area-inset-top, 0px));
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0) 26%),
    linear-gradient(180deg, #f8fbff 0%, #f1f5fb 42%, #e9eef7 100%);
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
  background: linear-gradient(180deg, rgba(243, 246, 251, 0.52) 0%, rgba(243, 246, 251, 0.12) 46%, rgba(243, 246, 251, 0) 100%);
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
  border-bottom: 1px solid rgba(219, 226, 238, 0.42);
  background:
    linear-gradient(180deg, rgba(248, 250, 254, 0.82) 0%, rgba(241, 245, 251, 0.78) 100%);
  box-shadow:
    0 10px 24px rgba(148, 163, 184, 0.06),
    inset 0 -1px 0 rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(22px) saturate(118%);
  -webkit-backdrop-filter: blur(22px) saturate(118%);
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
  padding: 18px 14px 0;
}

.page-head__content {
  min-width: 0;
  padding: 4px 2px 0;
}

.page-head__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.page-head__heading {
  min-width: 0;
  flex: 1 1 auto;
}

.page-head__actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  will-change: transform, opacity;
}

.page-head__title {
  margin: 0;
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

.page-head__refresh {
  min-width: 84px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(211, 222, 241, 0.92);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #5470a4;
  background: rgba(240, 245, 255, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 10px 18px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.page-head__refresh svg {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
}

.page-head__refresh span {
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}

.page-head__refresh--spinning svg {
  animation: my-leaves-spin 0.9s linear infinite;
}

.page-head__refresh:disabled {
  opacity: 0.68;
}

.page-head__dingtalk {
  min-width: 84px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(191, 219, 254, 0.86);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 8px 16px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.page-head__dingtalk svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.page-head__dingtalk span {
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.page-head__dingtalk:disabled {
  opacity: 0.68;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .page-nav__surface {
    background: linear-gradient(180deg, rgba(248, 250, 254, 0.98) 0%, rgba(241, 245, 251, 0.96) 100%);
  }

  .page-nav__back,
  .page-head__refresh,
  .page-head__dingtalk {
    background: rgba(255, 255, 255, 0.96);
  }
}

.filters-panel {
  padding: 18px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group__label {
  padding-left: 2px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #6b7ea0;
}

.panel-switch {
  --switch-indicator-inset: 16px;
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--switch-count), minmax(0, 1fr));
  align-items: center;
  gap: 8px;
  padding: 0 0 8px;
  background: transparent;
  border: 0;
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
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.22),
    0 8px 18px rgba(37, 99, 235, 0.24);
  transition: left 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.panel-switch__item {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 34px;
  padding: 0 6px;
  border: 0;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #6b7f9f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.panel-switch__item--active {
  color: #1d4ed8;
}

.panel-switch--compact .panel-switch__item {
  font-size: 11px;
}

.leaves-content {
  padding: 16px 14px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.loading-block {
  margin-top: 56px;
  color: #476798;
}

.ticket-card {
  position: relative;
  isolation: isolate;
  border-radius: 28px;
  border: 1px solid rgba(214, 223, 238, 0.98);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 251, 255, 0.98) 100%);
  box-shadow:
    0 14px 30px rgba(15, 23, 42, 0.07),
    0 6px 14px rgba(148, 163, 184, 0.06);
  overflow: hidden;
}

.ticket-card__header,
.ticket-card__hero,
.ticket-card__divider,
.ticket-card__toggle,
.ticket-card__details {
  position: relative;
  z-index: 1;
  padding-left: 18px;
  padding-right: 18px;
}

.ticket-card__header {
  padding-top: 20px;
}

.ticket-card__heading {
  min-width: 0;
}

.ticket-card__title-row {
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ticket-card__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7ea2;
}

.ticket-card__title {
  margin: 0;
  font-size: 29px;
  font-weight: 780;
  line-height: 1.05;
  letter-spacing: -0.05em;
  color: #122c68;
}

.ticket-card__subtitle {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: #7082a2;
}

.status-chip {
  --status-chip-bg: rgba(241, 245, 249, 0.98);
  --status-chip-color: #334155;
  --status-chip-glow: rgba(148, 163, 184, 0.52);
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  flex: 0 0 auto;
  color: var(--status-chip-color);
  background: var(--status-chip-bg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.16);
}

.status-chip::before {
  content: '';
  position: absolute;
  inset: -40px -64px;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 50%, var(--status-chip-glow) 0%, rgba(255, 255, 255, 0) 90%);
  filter: blur(60px);
  opacity: 1;
  z-index: -1;
  pointer-events: none;
}

.status-chip--pending {
  --status-chip-color: #a65b00;
  --status-chip-bg: rgba(255, 243, 199, 0.98);
  --status-chip-glow: rgba(245, 158, 11, 0.62);
}

.status-chip--approved {
  --status-chip-color: #166534;
  --status-chip-bg: rgba(220, 252, 231, 0.98);
  --status-chip-glow: rgba(74, 222, 128, 0.64);
}

.status-chip--rejected {
  --status-chip-color: #b42318;
  --status-chip-bg: rgba(254, 226, 226, 0.98);
  --status-chip-glow: rgba(248, 113, 113, 0.64);
}

.status-chip--recorded {
  --status-chip-color: #1d4ed8;
  --status-chip-bg: rgba(219, 234, 254, 0.98);
  --status-chip-glow: rgba(96, 165, 250, 0.64);
}

.ticket-card__hero {
  padding-top: 16px;
  padding-bottom: 18px;
  display: flex;
  flex-direction: column;
}

.ticket-card__hero-label {
  font-size: 12px;
  font-weight: 800;
  color: #617392;
}

.ticket-card__route {
  margin-top: 12px;
  padding: 16px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  background:
    linear-gradient(180deg, rgba(245, 248, 255, 0.96) 0%, rgba(255, 255, 255, 0.96) 100%);
  border: 1px solid rgba(221, 229, 243, 0.98);
}

.ticket-card__route-stop {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticket-card__route-stop:last-child {
  align-items: flex-end;
  text-align: right;
}

.ticket-card__route-caption {
  font-size: 11px;
  font-weight: 800;
  color: #72839f;
  white-space: nowrap;
}

.ticket-card__route-stop strong {
  max-width: 100%;
  font-size: 22px;
  font-weight: 780;
  line-height: 1.05;
  letter-spacing: -0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: #142b63;
}

.ticket-card__route-stop small {
  max-width: 100%;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: #5c6f93;
}

.ticket-card__route-line {
  width: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ticket-card__route-line span {
  position: relative;
  width: 100%;
  height: 1px;
  border-top: 1px dashed rgba(59, 130, 246, 0.55);
}

.ticket-card__route-line span::after {
  content: '';
  position: absolute;
  right: -2px;
  top: -4px;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 7px solid rgba(59, 130, 246, 0.82);
}

.ticket-card__summary-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
  align-items: start;
}

.ticket-card__summary-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticket-card__summary-item span {
  font-size: 11px;
  font-weight: 700;
  color: #7a8bab;
}

.ticket-card__summary-item strong {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.4;
  color: #122c68;
}

.ticket-card__summary-item small {
  font-size: 12px;
  line-height: 1.45;
  color: #667a9f;
}

.ticket-card__summary-item--full {
  grid-column: 1 / -1;
}

.ticket-card__reason {
  margin-top: 14px;
}

.detail-panel--hero {
  background:
    linear-gradient(180deg, rgba(244, 248, 255, 0.94) 0%, rgba(255, 255, 255, 0.95) 100%);
}

.ticket-card__divider {
  position: relative;
  min-height: 42px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  border-top: 1px dashed rgba(190, 201, 221, 0.9);
  border-bottom: 1px dashed rgba(190, 201, 221, 0.9);
  color: #71839f;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(249, 251, 255, 0.9);
}

.ticket-card__divider::before,
.ticket-card__divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #edf2f9;
  border: 1px solid rgba(214, 223, 238, 0.9);
  transform: translateY(-50%);
}

.ticket-card__divider::before {
  left: -10px;
}

.ticket-card__divider::after {
  right: -10px;
}

.ticket-card__toggle {
  width: 100%;
  min-height: 56px;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: transparent;
  color: #17377d;
  font-size: 14px;
  font-weight: 800;
}

.ticket-card__toggle-icon--open {
  transform: rotate(180deg);
}

.ticket-card__toggle svg {
  width: 18px;
  height: 18px;
  color: #4470ce;
  transition: transform 200ms ease;
  flex: 0 0 auto;
}

.ticket-card__details {
  padding-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: transparent;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid__item,
.detail-panel,
.note-panel,
.records-panel {
  border-radius: 20px;
  border: 1px solid rgba(221, 229, 243, 0.98);
  background: rgba(246, 249, 255, 0.94);
}

.detail-grid__item {
  min-height: 78px;
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-grid__item span,
.detail-panel__label,
.note-panel__label,
.records-panel__label {
  font-size: 12px;
  font-weight: 800;
  color: #6a7da1;
}

.detail-grid__item strong {
  font-size: 15px;
  line-height: 1.5;
  color: #132d67;
}

.detail-panel,
.note-panel,
.records-panel {
  padding: 14px 15px;
}

.detail-panel__value,
.note-panel__value {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #17306a;
  white-space: pre-wrap;
  word-break: break-word;
}

.note-panel--history {
  background: rgba(241, 246, 255, 0.96);
}

.note-panel--comment {
  background: rgba(243, 248, 255, 0.96);
}

.records-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.records-panel__header strong {
  flex: 0 0 auto;
  font-size: 14px;
  color: #15316e;
}

.records-panel__meta {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  color: #71839f;
}

.records-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-card {
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(223, 230, 242, 0.96);
}

.record-card__top,
.record-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.record-card__top strong,
.record-card__bottom span:first-child {
  min-width: 0;
}

.record-card__top strong {
  font-size: 14px;
  color: #132d67;
}

.record-card__top span,
.record-card__bottom span {
  font-size: 12px;
  line-height: 1.5;
  color: #6d809f;
}

.record-card__bottom {
  margin-top: 8px;
}

.record-card__bottom span:first-child {
  font-size: 13px;
  color: #1c356f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.records-panel__empty {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #6e819f;
}

@keyframes my-leaves-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

:deep(.van-empty) {
  margin-top: 56px;
}

@media (max-width: 420px) {
  .panel-switch {
    --switch-indicator-inset: 10px;
  }

  .ticket-card__route {
    padding: 14px;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) 42px minmax(0, 1fr);
  }

  .ticket-card__route-stop strong {
    font-size: 20px;
  }

  .ticket-card__route-stop small {
    font-size: 12px;
  }

  .ticket-card__route-line {
    width: 42px;
  }
}

@media (max-width: 375px) {
  .page-nav,
  .page-head,
  .filters-panel,
  .leaves-content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .page-head__row {
    gap: 10px;
  }

  .page-head__title {
    font-size: 28px;
  }

  .page-nav__shared-text {
    font-size: 28px;
  }

  .page-nav__back {
    width: 40px;
    height: 40px;
    border-radius: 999px;
  }

  .page-head__refresh {
    min-width: 40px;
    width: 40px;
    padding: 0;
  }

  .page-head__refresh span {
    display: none;
  }

  .ticket-card__header,
  .ticket-card__hero,
  .ticket-card__toggle,
  .ticket-card__details {
    padding-left: 16px;
    padding-right: 16px;
  }

  .ticket-card__header {
    padding-top: 18px;
  }

  .ticket-card__title-row {
    align-items: center;
    flex-wrap: wrap;
  }

  .ticket-card__title {
    font-size: 22px;
  }

  .status-chip {
    min-height: 34px;
    padding: 0 14px;
    font-size: 13px;
  }

  .ticket-card__route {
    padding: 13px 14px;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
  }

  .ticket-card__route-stop {
    gap: 3px;
  }

  .ticket-card__route-stop strong {
    font-size: 18px;
  }

  .ticket-card__route-stop small {
    font-size: 11px;
  }

  .ticket-card__route-line {
    width: 36px;
  }

  .ticket-card__summary-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .panel-switch__item {
    font-size: 11px;
  }

  .panel-switch--compact .panel-switch__item {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel-switch__indicator,
  .ticket-card__toggle svg,
  .page-nav__surface,
  .page-head__meta,
  .page-head__refresh {
    transition-duration: 0.01ms !important;
  }

  .page-head__refresh--spinning svg {
    animation: none;
  }
}
</style>
