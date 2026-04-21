function toPlainRecord(record) {
  if (!record) {
    return null;
  }

  const source = typeof record.toJSON === 'function' ? record.toJSON() : record;

  return {
    id: source.id || null,
    leaveDate: source.leave_date || null,
    weekday: source.weekday_snapshot ?? source.weekday ?? null,
    period: source.period_snapshot ?? source.period ?? null,
    subject: source.subject_snapshot || source.subject || '',
    startTime: source.start_time_snapshot || null,
    endTime: source.end_time_snapshot || null
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickRequestSortTime(item) {
  return normalizeDate(item.reviewedAt)
    || normalizeDate(item.submittedAt)
    || normalizeDate(item.startTime)
    || new Date(0);
}

function buildRequestHistoryItem(leave) {
  const source = typeof leave?.toJSON === 'function' ? leave.toJSON() : leave || {};
  const records = Array.isArray(source.records)
    ? source.records.map(toPlainRecord).filter(Boolean)
    : [];

  return {
    id: `request-${source.id}`,
    requestId: Number(source.id) || null,
    sourceType: 'request',
    sourceAuditLogId: null,
    historyNotice: '',
    studentId: source.student_id || source.student?.id || null,
    studentName: normalizeText(source.student_name_snapshot || source.student?.student_name),
    studentNumber: normalizeText(source.student_number_snapshot || source.student?.student_number),
    className: normalizeText(source.class_name_snapshot || source.class?.class_name),
    requestMode: normalizeText(source.request_mode),
    leaveType: normalizeText(source.leave_type),
    status: normalizeText(source.status),
    reviewerName: normalizeText(source.reviewer_name_snapshot || source.reviewer?.real_name),
    submittedAt: source.submitted_at || source.created_at || null,
    reviewedAt: source.reviewed_at || null,
    startTime: source.start_time || null,
    endTime: source.end_time || null,
    currentLocation: normalizeText(source.current_location),
    goHome: Boolean(source.go_home),
    reason: normalizeText(source.reason),
    teacherComment: normalizeText(source.teacher_comment),
    records
  };
}

function buildAuditFallbackItem(log, studentMap = new Map(), teacherMap = new Map()) {
  const source = typeof log?.toJSON === 'function' ? log.toJSON() : log || {};
  const details = source.details || {};
  const detailStudentId = Number(details.studentId) || null;
  const student = detailStudentId ? studentMap.get(detailStudentId) : null;
  const reviewer = teacherMap.get(Number(source.user_id)) || null;
  const rawRecords = Array.isArray(details.records) ? details.records : [];

  return {
    id: `audit-${source.id}`,
    requestId: Number(source.target_id) || null,
    sourceType: 'audit_fallback',
    sourceAuditLogId: Number(source.id) || null,
    historyNotice: '该记录已不在 leave_requests 表中，当前内容由操作日志回补生成。',
    studentId: detailStudentId,
    studentName: normalizeText(details.studentName || student?.student_name),
    studentNumber: normalizeText(details.studentNumber || student?.student_number),
    className: normalizeText(details.className),
    requestMode: normalizeText(details.requestMode || 'custom'),
    leaveType: normalizeText(details.leaveType || 'other'),
    status: normalizeText(details.status || 'approved'),
    reviewerName: normalizeText(details.reviewerName || reviewer?.real_name),
    submittedAt: details.submittedAt || null,
    reviewedAt: source.created_at || null,
    startTime: details.startTime || null,
    endTime: details.endTime || null,
    currentLocation: normalizeText(details.currentLocation),
    goHome: Boolean(details.goHome),
    reason: normalizeText(details.reason),
    teacherComment: normalizeText(details.comment || details.teacherComment),
    records: rawRecords.map(toPlainRecord).filter(Boolean)
  };
}

function isInListFilter(value, filterValue) {
  const filterItems = String(filterValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!filterItems.length) {
    return true;
  }

  return filterItems.includes(String(value || '').trim());
}

function isInDateRange(value, start, end) {
  if (!start && !end) {
    return true;
  }

  const current = normalizeDate(value);
  if (!current) {
    return false;
  }

  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);

  if (startDate && current < startDate) {
    return false;
  }

  if (endDate && current > endDate) {
    return false;
  }

  return true;
}

function filterLeaveHistoryItem(item, filters = {}) {
  const {
    status = '',
    requestMode = '',
    studentName = '',
    sourceType = 'all',
    startDate = '',
    endDate = '',
    reviewedStartDate = '',
    reviewedEndDate = ''
  } = filters;

  if (!isInListFilter(item.status, status)) {
    return false;
  }

  if (!isInListFilter(item.requestMode, requestMode)) {
    return false;
  }

  if (sourceType && sourceType !== 'all' && item.sourceType !== sourceType) {
    return false;
  }

  if (studentName && !normalizeText(item.studentName).includes(normalizeText(studentName))) {
    return false;
  }

  if (!isInDateRange(item.submittedAt, startDate, endDate)) {
    return false;
  }

  if ((reviewedStartDate || reviewedEndDate) && !isInDateRange(item.reviewedAt, reviewedStartDate, reviewedEndDate)) {
    return false;
  }

  return true;
}

function sortLeaveHistoryDesc(left, right) {
  const leftTime = pickRequestSortTime(left).getTime();
  const rightTime = pickRequestSortTime(right).getTime();

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return (Number(right.requestId) || 0) - (Number(left.requestId) || 0);
}

module.exports = {
  buildRequestHistoryItem,
  buildAuditFallbackItem,
  filterLeaveHistoryItem,
  sortLeaveHistoryDesc
};
