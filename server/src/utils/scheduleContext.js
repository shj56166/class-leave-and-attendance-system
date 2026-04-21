const DEFAULT_SCHEDULE_PERIODS = [
  { period: 1, startTime: '08:00', endTime: '08:45' },
  { period: 2, startTime: '08:55', endTime: '09:40' },
  { period: 3, startTime: '10:00', endTime: '10:45' },
  { period: 4, startTime: '10:55', endTime: '11:40' },
  { period: 5, startTime: '14:00', endTime: '14:45' },
  { period: 6, startTime: '14:55', endTime: '15:40' },
  { period: 7, startTime: '16:00', endTime: '16:45' },
  { period: 8, startTime: '16:55', endTime: '17:40' }
];
const MAX_SCHEDULE_PERIODS = 20;
const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return (hours * 60) + minutes;
}

function combineDateAndTime(dateValue, timeValue, endOfMinute = false) {
  const base = typeof dateValue === 'string'
    ? new Date(`${dateValue}T00:00:00`)
    : new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), 0, 0, 0, 0);
  const [hours, minutes] = String(timeValue).slice(0, 5).split(':').map(Number);

  base.setHours(hours, minutes, endOfMinute ? 59 : 0, endOfMinute ? 999 : 0);
  return base;
}

function getWeekdayValue(date) {
  return date.getDay() || 7;
}

function getWeekdayLabel(weekday) {
  return WEEKDAY_LABELS[weekday] || `周${weekday}`;
}

function normalizeTargetWeekday(value) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return null;
  }

  return weekday;
}

function normalizePeriods(periods = []) {
  const normalized = periods
    .map((item) => ({
      period: item.period,
      startTime: String(item.start_time || item.startTime).slice(0, 5),
      endTime: String(item.end_time || item.endTime).slice(0, 5)
    }))
    .sort((a, b) => a.period - b.period);

  if (!normalized.length) {
    return DEFAULT_SCHEDULE_PERIODS.map((period) => ({ ...period }));
  }

  return normalized;
}

function normalizeSpecialDates(specialDates = []) {
  return specialDates.map((item) => ({
    id: item.id,
    date: item.date,
    type: item.type,
    label: item.label || '',
    targetWeekday: normalizeTargetWeekday(item.target_weekday || item.targetWeekday)
  }));
}

function getSpecialDateInfo(date, specialDates = []) {
  const dateKey = typeof date === 'string' ? date : formatDateKey(date);
  return normalizeSpecialDates(specialDates).find((item) => item.date === dateKey) || null;
}

function resolveSpecialTargetWeekday(special, date) {
  const explicitWeekday = normalizeTargetWeekday(special?.targetWeekday);
  if (explicitWeekday) {
    return explicitWeekday;
  }

  if (special?.type === 'workday_override') {
    const dateValue = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
    return getWeekdayValue(dateValue);
  }

  return null;
}

function getDayContext(date, specialDates = []) {
  const dateValue = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const special = getSpecialDateInfo(dateValue, specialDates);
  const isWeekend = [0, 6].includes(dateValue.getDay());
  const targetWeekday = resolveSpecialTargetWeekday(special, dateValue);

  if (special && !targetWeekday) {
    return {
      isWorkday: false,
      type: 'holiday',
      label: special.label || '假期',
      effectiveWeekday: null,
      targetWeekday: null
    };
  }

  if (targetWeekday) {
    return {
      isWorkday: true,
      type: 'workday_override',
      label: special.label || `按${getWeekdayLabel(targetWeekday)}课表`,
      effectiveWeekday: targetWeekday,
      targetWeekday
    };
  }

  return {
    isWorkday: !isWeekend,
    type: isWeekend ? 'weekend' : 'workday',
    label: isWeekend ? '周末' : '工作日',
    effectiveWeekday: isWeekend ? null : getWeekdayValue(dateValue),
    targetWeekday: null
  };
}

function enrichSchedulesForDate(date, periods = [], schedules = [], specialDates = []) {
  const dateKey = typeof date === 'string' ? date : formatDateKey(date);
  const dayContext = getDayContext(date, specialDates);
  if (!dayContext.isWorkday || !dayContext.effectiveWeekday) {
    return [];
  }

  const weekday = dayContext.effectiveWeekday;
  const periodMap = new Map(normalizePeriods(periods).map((item) => [item.period, item]));

  return schedules
    .filter((item) => item.weekday === weekday && item.subject)
    .map((item) => {
      const period = periodMap.get(item.period);
      return {
        id: item.id,
        weekday: item.weekday,
        period: item.period,
        subject: item.subject,
        teacherName: item.teacher_name || item.teacherName || '',
        location: item.location || '教室',
        startTime: period?.startTime || null,
        endTime: period?.endTime || null,
        startDateTime: period ? combineDateAndTime(dateKey, period.startTime) : null,
        endDateTime: period ? combineDateAndTime(dateKey, period.endTime, true) : null,
        effectiveWeekday: weekday
      };
    })
    .sort((a, b) => a.period - b.period);
}

function getDayPartByTime(timeValue) {
  const minutes = parseTimeToMinutes(timeValue);

  if (minutes < 12 * 60) {
    return 'morning';
  }

  if (minutes < 18 * 60) {
    return 'afternoon';
  }

  return 'evening';
}

function getDayPartLabel(part) {
  const labels = {
    morning: '上午课程',
    afternoon: '下午课程',
    evening: '晚间课程'
  };
  return labels[part] || '课程';
}

function getLocationLabel(location) {
  const labels = {
    dormitory: '宿舍',
    classroom: '教室',
    home: '回家',
    other: '其他'
  };
  return labels[location] || '其他';
}

function getTodayLeaveContext({ now, periods, schedules, specialDates }) {
  const dayContext = getDayContext(now, specialDates);
  const courseSchedules = enrichSchedulesForDate(now, periods, schedules, specialDates);
  const availableCourses = courseSchedules.filter((item) => item.startDateTime && item.endDateTime);

  if (!dayContext.isWorkday) {
    return {
      available: false,
      reason: dayContext.type === 'holiday' ? '今日是假期，请使用周末/假期报备。' : '今日是周末，请使用周末/假期报备。',
      currentLocation: 'dormitory',
      currentLocationLabel: '宿舍',
      currentCourse: null,
      presets: [],
      rangeOptions: [],
      copyText: '',
      dayType: dayContext.type
    };
  }

  const currentCourse = availableCourses.find((item) => now >= item.startDateTime && now <= item.endDateTime) || null;
  const remainingCourses = availableCourses.filter((item) => now <= item.endDateTime);

  const currentLocation = currentCourse ? 'classroom' : 'dormitory';
  const copyText = currentLocation === 'dormitory'
    ? `今日请假在宿舍：${''}`
    : '';

  if (!remainingCourses.length) {
    return {
      available: false,
      reason: '今日已没有剩余课程，无法发起当天请假。',
      currentLocation,
      currentLocationLabel: getLocationLabel(currentLocation),
      currentCourse,
      presets: [],
      rangeOptions: [],
      copyText,
      dayType: dayContext.type
    };
  }

  const firstPart = getDayPartByTime(remainingCourses[0].startTime);
  const firstPartCourses = remainingCourses.filter((item) => getDayPartByTime(item.startTime) === firstPart);
  const presets = [];

  if (firstPartCourses.length) {
    presets.push({
      id: `part-${firstPart}`,
      label: getDayPartLabel(firstPart),
      fromPeriod: firstPartCourses[0].period,
      toPeriod: firstPartCourses[firstPartCourses.length - 1].period
    });
  }

  const spansMultipleParts = remainingCourses.some((item) => getDayPartByTime(item.startTime) !== firstPart);
  if (spansMultipleParts) {
    presets.push({
      id: 'all-remaining',
      label: firstPart === 'morning' ? '全天课程' : '今日剩余课程',
      fromPeriod: remainingCourses[0].period,
      toPeriod: remainingCourses[remainingCourses.length - 1].period
    });
  }

  return {
    available: true,
    reason: '',
    currentLocation,
    currentLocationLabel: getLocationLabel(currentLocation),
    currentCourse,
    presets,
    rangeOptions: remainingCourses.map((item) => ({
      period: item.period,
      label: `第${item.period}节 ${item.subject}`,
      subject: item.subject,
      startTime: item.startTime,
      endTime: item.endTime
    })),
    copyText,
    dayType: dayContext.type
  };
}

function getWeekendTargets(now, specialDates = []) {
  const today = cloneDate(now);
  today.setHours(0, 0, 0, 0);

  const day = today.getDay();
  const offsetToSaturday = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  const weekendStart = new Date(today);
  weekendStart.setDate(today.getDate() + offsetToSaturday);
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendStart.getDate() + 1);

  const weekendDates = [weekendStart, weekendEnd]
    .filter((date) => {
      const context = getDayContext(date, specialDates);
      return !context.isWorkday && context.type !== 'holiday';
    })
    .map((date) => formatDateKey(date));

  const targets = [];

  if (weekendDates.length) {
    targets.push({
      id: `weekend-${weekendDates[0]}-${weekendDates[weekendDates.length - 1]}`,
      type: 'weekend',
      label: '本周末',
      startDate: weekendDates[0],
      endDate: weekendDates[weekendDates.length - 1]
    });
  }

  const holidays = normalizeSpecialDates(specialDates)
    .filter((item) => !resolveSpecialTargetWeekday(item, item.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!holidays.length) {
    return targets;
  }

  const groups = [];
  for (const holiday of holidays) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push({ label: holiday.label || '假期', dates: [holiday.date] });
      continue;
    }

    const lastDate = new Date(`${lastGroup.dates[lastGroup.dates.length - 1]}T00:00:00`);
    lastDate.setDate(lastDate.getDate() + 1);

    if (formatDateKey(lastDate) === holiday.date) {
      lastGroup.dates.push(holiday.date);
      if (!lastGroup.label && holiday.label) {
        lastGroup.label = holiday.label;
      }
    } else {
      groups.push({ label: holiday.label || '假期', dates: [holiday.date] });
    }
  }

  const todayKey = formatDateKey(today);
  const targetHoliday = groups.find((group) => group.dates.includes(todayKey))
    || groups.find((group) => group.dates[group.dates.length - 1] >= todayKey);

  if (targetHoliday) {
    const startDate = targetHoliday.dates[0];
    const endDate = targetHoliday.dates[targetHoliday.dates.length - 1];
    targets.push({
      id: `holiday-${startDate}-${endDate}`,
      type: 'holiday',
      label: targetHoliday.label || '假期',
      startDate,
      endDate
    });
  }

  return targets;
}

function getScheduleRecordsForRange({
  startDateTime,
  endDateTime,
  periods,
  schedules,
  specialDates
}) {
  const records = [];
  const normalizedPeriods = normalizePeriods(periods);
  const endDate = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate(), 0, 0, 0, 0);

  for (let cursor = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate(), 0, 0, 0, 0); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const dayContext = getDayContext(cursor, specialDates);
    if (!dayContext.isWorkday) {
      continue;
    }

    const daySchedules = enrichSchedulesForDate(cursor, normalizedPeriods, schedules, specialDates);
    for (const schedule of daySchedules) {
      if (schedule.startDateTime < endDateTime && schedule.endDateTime > startDateTime) {
        records.push({
          schedule_id: schedule.id,
          leave_date: formatDateKey(cursor),
          weekday: schedule.weekday,
          period: schedule.period,
          subject: schedule.subject,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        });
      }
    }
  }

  return records;
}

module.exports = {
  DEFAULT_SCHEDULE_PERIODS,
  MAX_SCHEDULE_PERIODS,
  combineDateAndTime,
  formatDateKey,
  getDayContext,
  getLocationLabel,
  getScheduleRecordsForRange,
  getTodayLeaveContext,
  getWeekendTargets,
  normalizePeriods,
  normalizeSpecialDates,
  parseTimeToMinutes
};
