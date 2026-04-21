const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function createDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function normalizeTargetWeekday(value) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return null;
  }

  return weekday;
}

export function getWeekdayValue(dateKey) {
  return createDate(dateKey).getDay() || 7;
}

export function getWeekdayLabel(weekday) {
  return WEEKDAY_LABELS[weekday] || `周${weekday}`;
}

function resolveTargetWeekday(special, dateKey) {
  const explicitWeekday = normalizeTargetWeekday(special?.targetWeekday || special?.target_weekday);
  if (explicitWeekday) {
    return explicitWeekday;
  }

  if (special?.type === 'workday_override') {
    return getWeekdayValue(dateKey);
  }

  return null;
}

export function getDayContext(dateKey, specialDates = []) {
  const special = specialDates.find((item) => item.date === dateKey) || null;
  const date = createDate(dateKey);
  const isWeekend = [0, 6].includes(date.getDay());
  const targetWeekday = resolveTargetWeekday(special, dateKey);

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
      label: special?.label || `按${getWeekdayLabel(targetWeekday)}课表`,
      effectiveWeekday: targetWeekday,
      targetWeekday
    };
  }

  return {
    isWorkday: !isWeekend,
    type: isWeekend ? 'weekend' : 'workday',
    label: isWeekend ? '周末' : '工作日',
    effectiveWeekday: isWeekend ? null : getWeekdayValue(dateKey),
    targetWeekday: null
  };
}
