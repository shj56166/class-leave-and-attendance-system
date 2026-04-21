<template>
  <div class="schedule-page">
    <header class="page-nav" :class="{ 'page-nav--compact': isPageHeadCompact }">
      <div class="page-nav__surface" aria-hidden="true"></div>
      <div class="page-nav__center" aria-hidden="true">
        <div ref="pageNavTitleTargetRef" class="page-nav__title page-nav__title--target">我的课表</div>
      </div>

      <div class="page-nav__shared-title" :style="sharedTitleStyle" aria-hidden="true">
        <div class="page-nav__shared-text">我的课表</div>
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
          <p class="page-head__eyebrow">学习安排</p>
          <h1 ref="pageHeadTitleRef" class="page-head__title" :style="pageHeadTitleStyle">我的课表</h1>
          <p class="page-head__meta" :style="pageHeadMetaStyle">{{ pageMetaText }}</p>
        </div>
      </div>
    </section>

    <div ref="scheduleContentRef" class="schedule-content">
      <van-loading v-if="loading" size="24px" vertical class="loading-block">加载中...</van-loading>

      <template v-else>
        <section class="overview-card">
          <div class="overview-card__heading">
            <h2>{{ activeDayLabel }}</h2>
            <p>{{ daySummaryText }}</p>
          </div>
          <van-tag :type="activeDayContext.isWorkday ? 'primary' : 'success'" plain>
            {{ activeDayContext.label }}
          </van-tag>
        </section>

        <div class="day-selector">
          <button
            v-for="item in weekOptions"
            :key="item.date"
            type="button"
            class="day-chip"
            :class="{ 'day-chip--active': selectedDate === item.date }"
            @click="selectedDate = item.date"
          >
            <span>{{ item.weekday }}</span>
            <span>{{ item.shortDate }}</span>
          </button>
        </div>

        <section v-if="!activeDayContext.isWorkday" class="status-card">
          <div class="status-card__title">全天状态</div>
          <div class="status-card__text">
            {{ activeDayContext.type === 'holiday' ? `${activeDayContext.label}，今日按整日休息处理。` : '今天是周末，默认无上课时间线。' }}
          </div>
        </section>

        <section v-else-if="timelineItems.length === 0" class="status-card">
          <div class="status-card__title">今日课程</div>
          <div class="status-card__text">今天没有课程安排，课表页不再显示空白宿舍时段。</div>
        </section>

        <section v-else class="timeline">
          <article v-for="item in timelineItems" :key="item.period" class="timeline-item">
            <div class="timeline-item__time">
              <span class="timeline-item__period">第{{ item.period }}节</span>
              <span class="timeline-item__clock">{{ item.startTime }} - {{ item.endTime }}</span>
            </div>

            <div class="timeline-item__content">
              <div class="timeline-item__title">{{ item.title }}</div>
              <div class="timeline-item__meta">{{ item.meta }}</div>
              <div class="timeline-item__place">{{ item.location }}</div>
            </div>
          </article>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getMySchedule } from '../api/student';
import { getDayContext } from '../utils/scheduleContext';

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const PAGE_HEAD_COMPACT_SCROLL_Y = 0.74;

const router = useRouter();
const loading = ref(false);
const selectedDate = ref('');
const bundle = ref({
  periods: [],
  schedules: [],
  specialDates: []
});
const isPageHeadCompact = ref(false);
const headerMotionProgress = ref(0);
const headerMotionBlur = ref(0);
const pageHeadTitleRef = ref(null);
const pageNavTitleTargetRef = ref(null);
const scheduleContentRef = ref(null);
const titleMotionSourceRect = ref(null);
const titleMotionTargetRect = ref(null);

let headerMotionRafId = 0;

const periodMap = computed(() => new Map(
  bundle.value.periods.map((item) => [item.period, item])
));

const weekOptions = computed(() => {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      date: formatDateKey(date),
      weekday: WEEK_LABELS[date.getDay()],
      shortDate: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
    };
  });
});

const activeDayContext = computed(() => getDayContext(selectedDate.value, bundle.value.specialDates));

const activeDayLabel = computed(() => {
  if (!selectedDate.value) {
    return '本周课表';
  }

  const date = new Date(`${selectedDate.value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '本周课表';
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEK_LABELS[date.getDay()]}`;
});

const activeDaySchedules = computed(() => {
  const weekday = activeDayContext.value.effectiveWeekday;
  if (!weekday) {
    return [];
  }

  return bundle.value.schedules
    .filter((item) => item.weekday === weekday)
    .sort((a, b) => a.period - b.period);
});

const timelineItems = computed(() => {
  if (!activeDayContext.value.isWorkday) {
    return [];
  }

  return activeDaySchedules.value
    .map((item) => {
      const period = periodMap.value.get(item.period);
      if (!period) {
        return null;
      }

      return {
        period: item.period,
        startTime: period.startTime,
        endTime: period.endTime,
        title: item.subject,
        meta: item.teacherName ? `任课老师：${item.teacherName}` : '未填写任课老师',
        location: item.location || '教室'
      };
    })
    .filter(Boolean);
});

const daySummaryText = computed(() => {
  if (!activeDayContext.value.isWorkday) {
    return activeDayContext.value.type === 'holiday'
      ? '今天按假期展示整日状态。'
      : '今天按周末展示整日状态。';
  }

  const courseCount = timelineItems.value.length;
  if (!courseCount) {
    return activeDayContext.value.type === 'workday_override'
      ? `今天按${activeDayContext.value.label}执行，但还没有配置课程。`
      : '今天没有配置课程。';
  }

  return activeDayContext.value.type === 'workday_override'
    ? `今天按${activeDayContext.value.label}执行，共安排 ${courseCount} 节课程。`
    : `今天共安排 ${courseCount} 节课程。`;
});

const pageMetaText = computed(() => {
  if (loading.value) {
    return '正在同步本周课程...';
  }

  if (!selectedDate.value) {
    return '查看本周课程安排';
  }

  if (!activeDayContext.value.isWorkday) {
    return `${activeDayLabel.value} · ${activeDayContext.value.label}`;
  }

  if (!timelineItems.value.length) {
    return `${activeDayLabel.value} · 今日暂无课程`;
  }

  return `${activeDayLabel.value} · 共 ${timelineItems.value.length} 节课程`;
});

const pageHeadTitleStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.35))
}));

const pageHeadMetaStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - headerMotionProgress.value * 1.8)),
  transform: `translate3d(0, ${Math.min(headerMotionProgress.value * -8, 8)}px, 0)`
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

function syncHeaderMotionState() {
  if (
    typeof window === 'undefined'
    || !pageHeadTitleRef.value
    || !pageNavTitleTargetRef.value
    || !scheduleContentRef.value
  ) {
    return;
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const contentRect = scheduleContentRef.value.getBoundingClientRect();
  const rects = measureHeaderMotionRects();
  if (rects) {
    titleMotionSourceRect.value = rects.sourceRect;
    titleMotionTargetRect.value = rects.targetRect;
  }

  const sourceTop = titleMotionSourceRect.value?.top ?? pageHeadTitleRef.value.getBoundingClientRect().top;
  const motionRange = Math.max(contentRect.top - sourceTop, 1);
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

function formatDateKey(date) {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadSchedule() {
  loading.value = true;
  try {
    const response = await getMySchedule();
    bundle.value = {
      periods: response.periods || [],
      schedules: response.schedules || [],
      specialDates: response.specialDates || []
    };

    if (!selectedDate.value) {
      selectedDate.value = formatDateKey(new Date());
    }
  } catch (error) {
    showToast(error.response?.data?.error || '加载课表失败');
  } finally {
    loading.value = false;
    scheduleHeaderMotionSync();
  }
}

onMounted(() => {
  selectedDate.value = formatDateKey(new Date());
  loadSchedule();

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
.schedule-page {
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

.page-head__eyebrow {
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

.schedule-content {
  padding: 18px 14px 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-block {
  margin-top: 56px;
  color: #476798;
}

.overview-card,
.status-card,
.timeline-item {
  border: 1px solid rgba(220, 230, 244, 0.96);
  background: #f8fbff;
  box-shadow: 0 8px 22px rgba(148, 163, 184, 0.08);
}

.overview-card {
  padding: 18px;
  border-radius: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.overview-card__heading {
  min-width: 0;
}

.overview-card h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 760;
  color: #15316e;
  letter-spacing: -0.03em;
}

.overview-card p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: #64799f;
}

:deep(.overview-card .van-tag) {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-weight: 700;
}

.day-selector {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.day-chip {
  min-width: 70px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(214, 225, 240, 0.96);
  background: #f8fbff;
  color: #4e6896;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  appearance: none;
}

.day-chip--active {
  background: #edf4ff;
  border-color: rgba(59, 130, 246, 0.34);
  color: #1954bf;
}

.status-card {
  border-radius: 20px;
  padding: 20px 16px;
}

.status-card__title {
  font-size: 13px;
  font-weight: 700;
  color: #5472a4;
}

.status-card__text {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #15316e;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item {
  border-radius: 18px;
  padding: 14px;
  display: grid;
  grid-template-columns: 94px 1fr;
  gap: 12px;
}

.timeline-item__time {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeline-item__period {
  font-size: 13px;
  font-weight: 700;
  color: #15316e;
}

.timeline-item__clock {
  font-size: 12px;
  line-height: 1.45;
  color: #64799f;
}

.timeline-item__title {
  font-size: 15px;
  font-weight: 700;
  color: #15316e;
}

.timeline-item__meta,
.timeline-item__place {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #64799f;
}

@media (max-width: 375px) {
  .page-nav,
  .page-head,
  .schedule-content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .page-head__title,
  .page-nav__shared-text {
    font-size: 30px;
  }

  .page-nav__back {
    width: 40px;
    height: 40px;
  }

  .overview-card {
    padding: 16px;
    border-radius: 20px;
  }

  .timeline-item {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-nav::after,
  .page-nav__surface,
  .page-head__meta {
    transition-duration: 0.01ms !important;
  }
}
</style>
