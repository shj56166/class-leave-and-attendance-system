<template>
  <div class="home-content">
    <section class="home-greeting">
      <h2 class="home-greeting__title">{{ mainGreetingText }}</h2>
      <p class="home-greeting__subtitle">{{ isLoggedIn ? greetingDetailText : '游客先看看，登录后再用完整功能。' }}</p>
    </section>

    <section v-if="!isLoggedIn" class="guest-banner">
      <h3 class="guest-banner__title">当前是游客模式</h3>
      <p class="guest-banner__text">登录后获得丝滑请假体验</p>
      <button type="button" class="guest-banner__action" @click="router.push('/login')">立即登录</button>
    </section>

    <PwaInstallGuideCard />

    <section v-if="isLoggedIn && activeReminderTarget" class="reminder-card">
      <div class="reminder-card__header">
        <div class="reminder-card__title-wrap">
          <span class="reminder-card__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 4V12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <path d="M12 16.5V16.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
              <path
                d="M10.29 3.86L2.82 16.45C2.45 17.09 2.26 17.4 2.29 17.66C2.32 17.88 2.44 18.08 2.62 18.21C2.83 18.36 3.2 18.36 3.96 18.36H20.04C20.8 18.36 21.17 18.36 21.38 18.21C21.56 18.08 21.68 17.88 21.71 17.66C21.74 17.4 21.55 17.09 21.18 16.45L13.71 3.86C13.33 3.21 13.14 2.89 12.9 2.78C12.69 2.68 12.31 2.68 12.1 2.78C11.86 2.89 11.67 3.21 11.29 3.86Z"
                stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
            </svg>
          </span>
          <div class="reminder-card__heading">
            <p class="reminder-card__eyebrow">回家报备提醒</p>
            <h3 class="reminder-card__title">{{ reminderPrimaryText }}</h3>
          </div>
        </div>
        <button type="button" class="reminder-card__dismiss" @click="dismissReminder">
          暂不提醒
        </button>
      </div>

      <p class="reminder-card__meta">{{ reminderSecondaryText }}</p>

      <div class="reminder-card__footer">
        <button type="button" class="reminder-card__action" @click="openReminderConfirm">
          一键报备
        </button>
      </div>
    </section>

    <article class="info-card">
      <div class="info-card__header">
        <div class="info-card__title-row">
          <span class="info-card__icon info-card__icon--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4C2.89543 4 2 4.89543 2 6V20C2 21.1046 2.89543 22 4 22H18C19.1046 22 20 21.1046 20 20V13"
                stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path
                d="M17.5 2.5C18.3284 1.67157 19.6716 1.67157 20.5 2.5C21.3284 3.32843 21.3284 4.67157 20.5 5.5L12 14L8 15L9 11L17.5 2.5Z"
                stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <h3 class="info-card__title">请假申请</h3>
        </div>
        <span v-if="latestAcademicLeaveStatusMeta" class="info-card__status"
          :class="latestAcademicLeaveStatusMeta.badgeClass">
          {{ latestAcademicLeaveStatusMeta.label }}
        </span>
      </div>

      <div class="info-card__body">
        <p class="info-card__primary">
          <template v-if="latestAcademicLeaveStatusMeta">
            最新状态：
            <span :class="['info-card__status-text', latestAcademicLeaveStatusMeta.textClass]">
              {{ latestAcademicLeaveStatusMeta.label }}
            </span>
          </template>
          <template v-else>
            {{ applyCardPrimaryText }}
          </template>
        </p>
        <p class="info-card__secondary">{{ applyCardSecondaryText }}</p>
      </div>

      <div class="info-card__footer">
        <button type="button" class="info-card__action info-card__action--blue" @click="openProtectedRoute('/apply')">
          {{ isLoggedIn ? '去申请' : '去登录' }}
        </button>
      </div>
    </article>

    <article class="info-card">
      <div class="info-card__header">
        <div class="info-card__title-row">
          <span class="info-card__icon info-card__icon--green" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
                stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M14 2V8H20" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M12 11V17" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <path d="M9 14L12 17L15 14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </span>
          <h3 class="info-card__title">请假历史</h3>
        </div>
      </div>

      <div class="info-card__body">
        <p class="info-card__primary">{{ leaveCardPrimaryText }}</p>
        <p class="info-card__secondary">{{ leaveCardSecondaryText }}</p>
      </div>

      <div class="info-card__footer">
        <button type="button" class="info-card__action info-card__action--green" @click="openProtectedRoute('/leaves')">
          {{ isLoggedIn ? '查看记录' : '去登录' }}
        </button>
      </div>
    </article>

    <article class="info-card">
      <div class="info-card__header">
        <div class="info-card__title-row">
          <span class="info-card__icon info-card__icon--amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.9" />
              <path d="M8 2V6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <path d="M16 2V6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              <path d="M3 10H21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
            </svg>
          </span>
          <h3 class="info-card__title">我的课表</h3>
        </div>
      </div>

      <div class="info-card__body">
        <p class="info-card__primary">{{ scheduleCardPrimaryText }}</p>
        <p class="info-card__secondary">{{ scheduleCardSecondaryText }}</p>
      </div>

      <div class="info-card__footer">
        <button type="button" class="info-card__action info-card__action--amber" @click="openProtectedRoute('/schedule')">
          {{ isLoggedIn ? '查看课表' : '去登录' }}
        </button>
      </div>
    </article>

    <ProjectModal
      v-model="showReminderConfirm"
      title="确认回家报备"
      size="sm"
      :show-close="false"
      panel-class="reminder-confirm-modal"
      body-class="reminder-confirm-modal__body"
    >
      <div class="reminder-confirm">
        <p class="reminder-confirm__title">
          {{ activeReminderTarget?.label || '当前回家报备' }}
        </p>
        <p class="reminder-confirm__text">
          确认提交这次回家报备吗？提交后会直接完成当前目标的回家报备。
        </p>
        <p v-if="activeReminderTarget" class="reminder-confirm__range">
          {{ formatDateRange(activeReminderTarget.startDate, activeReminderTarget.endDate) }}
        </p>
      </div>

      <template #footer>
        <div class="reminder-confirm__actions">
          <button
            type="button"
            class="reminder-confirm__button reminder-confirm__button--ghost"
            :disabled="submittingReminder"
            @click="closeReminderConfirm"
          >
            取消
          </button>
          <button
            type="button"
            class="reminder-confirm__button reminder-confirm__button--primary"
            :disabled="submittingReminder"
            @click="submitReminderReport"
          >
            {{ submittingReminder ? '提交中...' : '确认报备' }}
          </button>
        </div>
      </template>
    </ProjectModal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getLeaveContext, getMyLeaves, getMySchedule, submitLeave } from '../../api/student';
import PwaInstallGuideCard from '../../components/PwaInstallGuideCard.vue';
import ProjectModal from '../../components/ProjectModal.vue';
import { useUserStore } from '../../stores/user';
import {
  formatApiDateTimeValue,
  formatDateKey,
  resolveLeaveRecordDate
} from '../../utils/date';
import { getDayContext } from '../../utils/scheduleContext';
import { safeGetItem, safeSetItem } from '../../utils/storage';

const DISMISSED_REMINDERS_KEY_PREFIX = 'student-home-dismissed-reminders';

const router = useRouter();
const userStore = useUserStore();
const now = ref(new Date());
const scheduleLoading = ref(false);
const leavesLoading = ref(false);
const leaveContextLoading = ref(false);
const bundle = ref({
  periods: [],
  schedules: [],
  specialDates: []
});
const leaveContext = ref({
  today: null,
  weekendTargets: []
});
const leaves = ref([]);
const dismissedReminderIds = ref([]);
const showReminderConfirm = ref(false);
const submittingReminder = ref(false);

let timerId = 0;

const isLoggedIn = computed(() => userStore.isLoggedIn);
const dismissedReminderStorageKey = computed(() => (
  `${DISMISSED_REMINDERS_KEY_PREFIX}:${userStore.user?.id || 'guest'}`
));
const todayKey = computed(() => formatDateKey(now.value));
const greetingText = computed(() => {
  const hour = now.value.getHours();
  if (hour >= 5 && hour < 12) {
    return '早上好';
  }
  if (hour >= 12 && hour < 14) {
    return '中午好';
  }
  if (hour >= 14 && hour < 18) {
    return '下午好';
  }
  return '晚上好';
});
const todayContext = computed(() => getDayContext(todayKey.value, bundle.value.specialDates));
const periodMap = computed(() => new Map(
  (bundle.value.periods || []).map((item) => [item.period, item])
));
const todayCourses = computed(() => {
  if (!todayContext.value.isWorkday) {
    return [];
  }

  const weekday = todayContext.value.effectiveWeekday;
  if (!weekday) {
    return [];
  }

  return (bundle.value.schedules || [])
    .filter((item) => item.weekday === weekday)
    .sort((left, right) => left.period - right.period)
    .map((item) => {
      const period = periodMap.value.get(item.period);
      if (!period) {
        return null;
      }

      return {
        ...item,
        startTime: period.startTime,
        endTime: period.endTime,
        startDateTime: combineDateAndTime(todayKey.value, period.startTime),
        endDateTime: combineDateAndTime(todayKey.value, period.endTime)
      };
    })
    .filter(Boolean);
});
const nextCourse = computed(() => {
  const currentTime = now.value.getTime();
  return todayCourses.value.find((item) => item.startDateTime.getTime() > currentTime) || null;
});
const remainingCourseCount = computed(() => (
  nextCourse.value
    ? todayCourses.value.filter((item) => item.startDateTime.getTime() > now.value.getTime()).length
    : 0
));
const isCompletedState = computed(() => !scheduleLoading.value && (
  !todayContext.value.isWorkday
  || remainingCourseCount.value === 0
));
const weekendTargets = computed(() => Array.isArray(leaveContext.value.weekendTargets)
  ? leaveContext.value.weekendTargets
  : []);
const activeReminderTarget = computed(() => {
  if (!isLoggedIn.value) {
    return null;
  }

  if (leaveContextLoading.value || leavesLoading.value) {
    return null;
  }

  const currentTime = now.value.getTime();

  return weekendTargets.value.find((target) => {
    if (!target?.id || !target.startDate || !target.endDate) {
      return false;
    }

    if (dismissedReminderIds.value.includes(target.id)) {
      return false;
    }

    if (isTargetAlreadyReported(target)) {
      return false;
    }

    const reminderTime = getTargetReminderTime(target).getTime();
    const targetEndTime = combineDateAndTime(target.endDate, '23:59').getTime();
    return currentTime >= reminderTime && currentTime <= targetEndTime;
  }) || null;
});
const reminderPrimaryText = computed(() => {
  if (!activeReminderTarget.value) {
    return '';
  }

  return activeReminderTarget.value.type === 'holiday'
    ? `${activeReminderTarget.value.label}回家报备已开放`
    : '本周末回家报备已开放';
});
const reminderSecondaryText = computed(() => {
  if (!activeReminderTarget.value) {
    return '';
  }

  return `${formatDateRange(activeReminderTarget.value.startDate, activeReminderTarget.value.endDate)} · 不回家可手动关闭这次提醒`;
});
const mainGreetingText = computed(() => {
  if (!isLoggedIn.value) {
    return `${greetingText.value}，欢迎先看看首页`;
  }

  if (scheduleLoading.value) {
    return `${greetingText.value}，正在同步今日课表`;
  }

  if (isCompletedState.value) {
    return `${greetingText.value}，已完成今日目标🎉`;
  }

  return `${greetingText.value}，今日剩余 ${remainingCourseCount.value} 节课`;
});
const greetingDetailText = computed(() => {
  if (!isLoggedIn.value) {
    return '当前为游客模式，登录后可提交请假、查看个人记录与同步课表。';
  }

  if (scheduleLoading.value) {
    return '正在获取今天的课程安排';
  }

  if (isCompletedState.value) {
    if (!todayContext.value.isWorkday || todayCourses.value.length === 0) {
      return '今天没有待上的课程，好好休息吧';
    }
    return '今日课程已结束，好好休息吧';
  }

  if (!nextCourse.value) {
    return '今日课程已结束，好好休息吧';
  }

  return `距离第 ${nextCourse.value.period} 课 ${formatCountdown(nextCourse.value.startDateTime.getTime() - now.value.getTime())}`;
});
const academicLeaves = computed(() => leaves.value.filter((leave) => ['today', 'custom'].includes(leave.request_mode)));
const latestAcademicLeave = computed(() => academicLeaves.value[0] || null);
const latestPendingAcademicLeave = computed(() => (
  academicLeaves.value.find((leave) => leave.status === 'pending') || null
));
const latestAcademicLeaveStatusMeta = computed(() => {
  if (!latestAcademicLeave.value) {
    return null;
  }

  return getLeaveStatusMeta(latestAcademicLeave.value.status);
});
const effectiveAcademicLeaveDates = computed(() => {
  const dates = new Set();

  academicLeaves.value
    .filter((leave) => leave.status !== 'rejected')
    .forEach((leave) => {
      const recordDates = Array.isArray(leave.records)
        ? leave.records
          .map((record) => resolveLeaveRecordDate(record))
          .filter(Boolean)
        : [];

      if (recordDates.length) {
        recordDates
          .filter((date) => date <= todayKey.value)
          .forEach((date) => dates.add(date));
        return;
      }

      const startDate = formatDateKey(leave.start_time);
      if (startDate && startDate <= todayKey.value) {
        dates.add(startDate);
      }
    });

  return [...dates].sort();
});
const currentSemesterStart = computed(() => getSemesterStartDateKey(now.value));
const semesterLeaveDayCount = computed(() => (
  effectiveAcademicLeaveDates.value.filter((date) => (
    date >= currentSemesterStart.value && date <= todayKey.value
  )).length
));
const applyCardPrimaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '登录后可快速提交请假申请';
  }

  if (leavesLoading.value) {
    return '正在同步请假记录';
  }

  if (!latestAcademicLeave.value) {
    return '最近还没有请假申请';
  }

  return `最新状态：${getLeaveStatusText(latestAcademicLeave.value.status)}`;
});
const applyCardSecondaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '登录后这里会显示审批进度、最近结果和请假状态。';
  }

  if (leavesLoading.value) {
    return '正在获取最新审批进度';
  }

  if (!latestAcademicLeave.value) {
    return '提交申请后，这里会显示最新审批结果';
  }

  if (latestAcademicLeave.value.status === 'pending') {
    return `${getLeaveTypeText(latestAcademicLeave.value.leave_type)} · ${formatDateTime(latestAcademicLeave.value.submitted_at)} 提交`;
  }

  return `${getLeaveTypeText(latestAcademicLeave.value.leave_type)} · ${formatDateTime(latestAcademicLeave.value.submitted_at)} 已处理`;
});
const leaveCardPrimaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '登录后可查看自己的请假历史';
  }

  if (leavesLoading.value) {
    return '正在加载请假状态';
  }

  if (latestPendingAcademicLeave.value) {
    return `最近一条请假待审批：${getLeaveTypeText(latestPendingAcademicLeave.value.leave_type)}`;
  }

  return `本学期已请假 ${semesterLeaveDayCount.value} 天`;
});
const leaveCardSecondaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '审批结果、回家报备和历史记录都会集中显示在这里。';
  }

  if (leavesLoading.value) {
    return '正在同步最新请假进度';
  }

  if (latestPendingAcademicLeave.value) {
    return `${formatDateTime(latestPendingAcademicLeave.value.submitted_at)} 提交，等待老师处理`;
  }

  return '不含回家报备与已拒绝记录';
});
const scheduleCardPrimaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '登录后可查看个人课表';
  }

  if (scheduleLoading.value) {
    return '正在同步今日课表';
  }

  if (nextCourse.value) {
    return `下节第 ${nextCourse.value.period} 课 · ${nextCourse.value.subject}`;
  }

  if (!todayContext.value.isWorkday || !todayCourses.value.length) {
    return '今天没有待上的课程';
  }

  return '今天课程已结束';
});
const scheduleCardSecondaryText = computed(() => {
  if (!isLoggedIn.value) {
    return '下节课提醒、课表详情和统计数据都需要登录后同步。';
  }

  if (scheduleLoading.value) {
    return '正在获取下节课信息';
  }

  if (nextCourse.value) {
    return `${nextCourse.value.location || '教室'} · 距离开始 ${formatCountdown(nextCourse.value.startDateTime.getTime() - now.value.getTime())}`;
  }

  if (!todayContext.value.isWorkday || !todayCourses.value.length) {
    return '今天可以放松一下，好好休息吧';
  }

  return '没有下一节待上课程，好好休息吧';
});

function shiftDateKey(dateKey, days) {
  const value = new Date(`${dateKey}T00:00:00`);
  value.setDate(value.getDate() + days);
  return formatDateKey(value);
}

function formatDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endLabel = `${end.getMonth() + 1}月${end.getDate()}日`;
  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`;
}

function combineDateAndTime(dateKey, time) {
  const [hours = '0', minutes = '0'] = String(time || '00:00').split(':');
  const result = new Date(`${dateKey}T00:00:00`);
  result.setHours(Number(hours), Number(minutes), 0, 0);
  return result;
}

function getSemesterStartDateKey(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month === 1) {
    return `${year - 1}-09-01`;
  }

  if (month >= 2 && month <= 7) {
    return `${year}-02-01`;
  }

  return `${year}-09-01`;
}

function getLeaveTypeText(type) {
  return {
    sick: '病假',
    personal: '事假',
    other: '其他'
  }[type] || '请假';
}

function getLeaveStatusText(status) {
  return {
    pending: '待审批',
    approved: '已同意',
    rejected: '已拒绝',
    recorded: '已报备'
  }[status] || '处理中';
}

function getLeaveStatusMeta(status) {
  return {
    pending: {
      label: '待审批中',
      badgeClass: 'info-card__status--warning',
      textClass: 'info-card__status-text--warning'
    },
    approved: {
      label: '已通过',
      badgeClass: 'info-card__status--success',
      textClass: 'info-card__status-text--success'
    },
    rejected: {
      label: '未通过',
      badgeClass: 'info-card__status--danger',
      textClass: 'info-card__status-text--danger'
    }
  }[status] || {
    label: getLeaveStatusText(status),
    badgeClass: 'info-card__status--neutral',
    textClass: 'info-card__status-text--neutral'
  };
}

function formatDateTime(dateStr) {
  return formatApiDateTimeValue(dateStr, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCountdown(diffMs) {
  const safeDiff = Math.max(diffMs, 0);
  const totalSeconds = Math.floor(safeDiff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours >= 1) {
    return `${hours}小时${minutes}分`;
  }

  return `${minutes}分${seconds}秒`;
}

function getTargetReminderTime(target) {
  const reminderDate = shiftDateKey(target.startDate, -1);
  return combineDateAndTime(reminderDate, '11:00');
}

function isTargetAlreadyReported(target) {
  return leaves.value.some((leave) => (
    leave.request_mode === 'weekend'
    && leave.status === 'recorded'
    && formatDateKey(leave.start_time) === target.startDate
    && formatDateKey(leave.end_time) === target.endDate
  ));
}

function readDismissedReminderIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(safeGetItem(dismissedReminderStorageKey.value) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistDismissedReminderIds() {
  if (typeof window === 'undefined') {
    return;
  }

  safeSetItem(
    dismissedReminderStorageKey.value,
    JSON.stringify(dismissedReminderIds.value)
  );
}

function dismissReminder() {
  if (!activeReminderTarget.value) {
    return;
  }

  if (!dismissedReminderIds.value.includes(activeReminderTarget.value.id)) {
    dismissedReminderIds.value = [...dismissedReminderIds.value, activeReminderTarget.value.id];
    persistDismissedReminderIds();
  }
}

function openReminderConfirm() {
  if (!activeReminderTarget.value || submittingReminder.value) {
    return;
  }

  showReminderConfirm.value = true;
}

function closeReminderConfirm() {
  if (submittingReminder.value) {
    return;
  }

  showReminderConfirm.value = false;
}

function openProtectedRoute(path) {
  if (!isLoggedIn.value) {
    showToast('请先登录后再使用这个功能');
    router.push('/login');
    return;
  }

  router.push(path);
}

function resetGuestState() {
  bundle.value = {
    periods: [],
    schedules: [],
    specialDates: []
  };
  leaveContext.value = {
    today: null,
    weekendTargets: []
  };
  leaves.value = [];
  scheduleLoading.value = false;
  leavesLoading.value = false;
  leaveContextLoading.value = false;
  showReminderConfirm.value = false;
  dismissedReminderIds.value = [];
}

async function submitReminderReport() {
  if (!activeReminderTarget.value || submittingReminder.value) {
    return;
  }

  submittingReminder.value = true;

  try {
    await submitLeave({
      mode: 'weekend',
      targetId: activeReminderTarget.value.id
    });
    showToast('回家报备成功');
    showReminderConfirm.value = false;
    await Promise.all([loadLeaves(), loadLeaveContext()]);
  } catch (error) {
    showToast(error.response?.data?.error || '回家报备失败');
  } finally {
    submittingReminder.value = false;
  }
}

async function loadSchedule() {
  if (!isLoggedIn.value) {
    scheduleLoading.value = false;
    return;
  }

  scheduleLoading.value = true;
  try {
    const response = await getMySchedule();
    bundle.value = {
      periods: response.periods || [],
      schedules: response.schedules || [],
      specialDates: response.specialDates || []
    };
  } catch (error) {
    showToast(error.response?.data?.error || '加载今日课程失败');
  } finally {
    scheduleLoading.value = false;
  }
}

async function loadLeaves() {
  if (!isLoggedIn.value) {
    leavesLoading.value = false;
    return;
  }

  leavesLoading.value = true;
  try {
    leaves.value = await getMyLeaves();
  } catch (error) {
    showToast(error.response?.data?.error || '加载请假记录失败');
  } finally {
    leavesLoading.value = false;
  }
}

async function loadLeaveContext() {
  if (!isLoggedIn.value) {
    leaveContextLoading.value = false;
    return;
  }

  leaveContextLoading.value = true;
  try {
    const response = await getLeaveContext();
    leaveContext.value = {
      today: response.today || null,
      weekendTargets: response.weekendTargets || []
    };
  } catch (error) {
    showToast(error.response?.data?.error || '加载报备提醒失败');
  } finally {
    leaveContextLoading.value = false;
  }
}

onMounted(() => {
  if (isLoggedIn.value) {
    dismissedReminderIds.value = readDismissedReminderIds();
    loadSchedule();
    loadLeaves();
    loadLeaveContext();
  } else {
    resetGuestState();
  }

  timerId = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

watch(
  isLoggedIn,
  (value) => {
    if (value) {
      dismissedReminderIds.value = readDismissedReminderIds();
      loadSchedule();
      loadLeaves();
      loadLeaveContext();
      return;
    }

    resetGuestState();
  }
);

watch(
  () => userStore.user?.id,
  (value) => {
    dismissedReminderIds.value = value ? readDismissedReminderIds() : [];
  }
);

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId);
  }
});
</script>

<style scoped>
.home-content {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  padding: clamp(18px, calc(12px + env(safe-area-inset-top, 0px)), 34px) 14px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.home-greeting {
  padding: 8px 2px 12px;
}

.home-greeting__title {
  margin: 0;
  font-size: clamp(24px, 7.4vw, 28px);
  font-weight: 780;
  line-height: 1.08;
  letter-spacing: -0.05em;
  color: #15316e;
}

.home-greeting__subtitle {
  margin: 10px 0 0;
  max-width: 32ch;
  font-size: 13px;
  line-height: 1.5;
  color: #64799f;
}

.guest-banner {
  border: 1px solid rgba(191, 219, 254, 0.92);
  border-radius: 18px;
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background:
    linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.88) 100%);
  box-shadow: 0 12px 26px rgba(59, 130, 246, 0.12);
}

.guest-banner__eyebrow {
  margin: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #2563eb;
}

.guest-banner__title {
  margin: 0;
  font-size: 16px;
  font-weight: 760;
  line-height: 1.3;
  color: #15316e;
}

.guest-banner__text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #5a7199;
}

.guest-banner__action {
  align-self: flex-start;
  min-height: 34px;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
}

.reminder-card {
  width: 100%;
  border: 1px solid rgba(255, 214, 153, 0.82);
  border-radius: 22px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background:
    linear-gradient(180deg, rgba(255, 248, 233, 0.96) 0%, rgba(255, 243, 217, 0.92) 100%);
  box-shadow:
    0 10px 28px rgba(245, 158, 11, 0.12);
}

.reminder-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.reminder-card__title-wrap {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.reminder-card__badge {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #d97706;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 232, 192, 0.96);
}

.reminder-card__badge svg {
  width: 17px;
  height: 17px;
}

.reminder-card__heading {
  min-width: 0;
}

.reminder-card__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #b45309;
}

.reminder-card__title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 760;
  line-height: 1.35;
  letter-spacing: -0.03em;
  color: #8a3b12;
}

.reminder-card__dismiss {
  min-height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(245, 158, 11, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  font-weight: 700;
  color: #9a5d12;
}

.reminder-card__meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #9a6a20;
}

.reminder-card__footer {
  display: flex;
  justify-content: flex-end;
}

.reminder-card__action {
  min-height: 36px;
  padding: 0 15px;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #d97706;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 10px 20px rgba(217, 119, 6, 0.18);
}

.reminder-confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reminder-confirm__title {
  margin: 0;
  font-size: 18px;
  font-weight: 760;
  line-height: 1.35;
  letter-spacing: -0.03em;
  color: #15316e;
}

.reminder-confirm__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #4f648d;
}

.reminder-confirm__range {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
}

.reminder-confirm__actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reminder-confirm__button {
  min-height: 42px;
  border-radius: 16px;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
}

.reminder-confirm__button:disabled {
  opacity: 0.62;
}

.reminder-confirm__button--ghost {
  color: #5f7398;
  background: rgba(239, 244, 255, 0.92);
  border: 1px solid rgba(211, 222, 241, 0.92);
}

.reminder-confirm__button--primary {
  color: #ffffff;
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}

.reminder-confirm__button:active {
  transform: scale(0.985);
}

.info-card {
  width: 100%;
  border: 1px solid rgba(220, 230, 244, 0.92);
  border-radius: 20px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(248, 251, 255, 0.88);
  box-shadow:
    0 8px 22px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.info-card__header {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.info-card__title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card__icon {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 233, 246, 0.92);
  box-shadow: 0 6px 14px rgba(148, 163, 184, 0.08);
}

.info-card__icon svg {
  width: 15px;
  height: 15px;
}

.info-card__icon--blue {
  color: #3b82f6;
}

.info-card__icon--green {
  color: #22c55e;
}

.info-card__icon--amber {
  color: #f59e0b;
}

.info-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #15316e;
}

.info-card__status {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.info-card__status--warning {
  color: #b45309;
  background: rgba(254, 243, 199, 0.82);
  border: 1px solid rgba(253, 230, 138, 0.92);
}

.info-card__status--success {
  color: #15803d;
  background: rgba(220, 252, 231, 0.86);
  border: 1px solid rgba(134, 239, 172, 0.92);
}

.info-card__status--danger {
  color: #dc2626;
  background: rgba(254, 226, 226, 0.88);
  border: 1px solid rgba(252, 165, 165, 0.92);
}

.info-card__status--neutral {
  color: #475569;
  background: rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.92);
}

.info-card__body {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px dashed rgba(186, 201, 226, 0.72);
}

.info-card__primary {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: #15316e;
}

.info-card__status-text--warning {
  color: #b45309;
}

.info-card__status-text--success {
  color: #16a34a;
}

.info-card__status-text--danger {
  color: #dc2626;
}

.info-card__status-text--neutral {
  color: #475569;
}

.info-card__secondary {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #65799f;
}

.info-card__footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.info-card__action {
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.16);
}

.info-card__action--blue {
  background: #3b82f6;
}

.info-card__action--green {
  background: #22c55e;
}

.info-card__action--amber {
  background: #f59e0b;
}

.info-card__action:active,
.reminder-card__action:active,
.reminder-card__dismiss:active {
  transform: scale(0.985);
}

@media (max-width: 375px) {
  .home-content {
    padding: clamp(16px, calc(10px + env(safe-area-inset-top, 0px)), 28px) 12px 0;
  }

  .home-greeting__title {
    font-size: clamp(22px, 7.8vw, 25px);
  }

  .home-greeting__subtitle {
    font-size: 12px;
  }

  .reminder-card {
    padding: 14px;
    border-radius: 20px;
  }

  .reminder-card__title {
    font-size: 16px;
  }

  .info-card {
    padding: 13px;
    border-radius: 18px;
  }

  .info-card__title {
    font-size: 14px;
  }

  .info-card__primary {
    font-size: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {

  .info-card__action,
  .reminder-card__action,
  .reminder-card__dismiss {
    transition-duration: 0.01ms !important;
  }
}
</style>

