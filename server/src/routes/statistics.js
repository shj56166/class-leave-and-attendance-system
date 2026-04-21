const express = require('express');
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const {
  LeaveHistoryArchive,
  LeaveRequest,
  LeaveRecord,
  Student,
  AuditLog,
  ClassroomCheckSubmission,
  Dormitory,
  ClassSpecialDate,
  Schedule,
  SchedulePeriod
} = require('../models');
const { authMiddleware, teacherAuth } = require('../middleware/auth');
const {
  formatDateKey,
  getDayContext,
  getWeekendTargets,
  normalizePeriods,
  parseTimeToMinutes
} = require('../utils/scheduleContext');
const { serializeClassroomCheckSubmission } = require('../utils/classroomCheck');
const { buildTeacherHistoryItemFromArchive } = require('../utils/leaveHistoryArchive');

const router = express.Router();

const COURSE_MATCH_TOLERANCE_MINUTES = 30;
const WEEKDAY_LABELS = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const LEAVE_TYPE_LABELS = {
  sick: '病假',
  personal: '事假',
  other: '其他'
};

router.use(authMiddleware, teacherAuth);

function sortByStudentNumber(items = []) {
  return [...items].sort((left, right) => {
    const leftNumber = left.student_number || left.studentNumber || '';
    const rightNumber = right.student_number || right.studentNumber || '';
    return String(leftNumber).localeCompare(String(rightNumber), 'zh-CN', { numeric: true });
  });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toPlainValue(record) {
  return typeof record?.toJSON === 'function' ? record.toJSON() : record;
}

function buildStudentMatchKey(studentId, studentName) {
  return studentId ? `id:${studentId}` : `name:${normalizeText(studentName)}`;
}

function isSameStudent(targetStudentId, targetStudentName, snapshot) {
  const targetKey = buildStudentMatchKey(targetStudentId, targetStudentName);
  const snapshotKey = buildStudentMatchKey(snapshot?.studentId || null, snapshot?.studentName || '');
  return targetKey === snapshotKey;
}

function normalizeSnapshotTime(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toTimeString().slice(0, 5);
  }

  const raw = String(value);
  const timeMatch = raw.match(/(\d{2}:\d{2})/);
  return timeMatch ? timeMatch[1] : raw.slice(0, 5);
}

function parseArchiveRecordsSnapshot(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function buildOverviewStudentRecord({ student, fallbackId, studentName, studentNumber }) {
  const source = toPlainValue(student) || {};

  return {
    id: source.id || fallbackId,
    student_name: source.student_name || studentName || '',
    student_number: source.student_number || studentNumber || '',
    dormitory_id: source.dormitory_id || null,
    dormitory: source.dormitory ? { name: source.dormitory.name } : null
  };
}

function createStatisticsStudentInclude() {
  return {
    model: Student,
    as: 'student',
    attributes: ['id', 'student_name', 'student_number', 'dormitory_id'],
    required: false,
    include: [{
      model: Dormitory,
      as: 'dormitory',
      attributes: ['id', 'name'],
      required: false
    }]
  };
}

function normalizeOverviewRecord(record, fallbackId) {
  const source = toPlainValue(record) || {};
  const weekday = source.weekday_snapshot ?? source.weekday ?? null;
  const period = source.period_snapshot ?? source.period ?? null;
  const subject = source.subject_snapshot || source.subject || '';

  return {
    id: source.id || fallbackId,
    leave_date: source.leave_date || source.leaveDate || null,
    weekday,
    period,
    subject,
    subject_snapshot: subject,
    weekday_snapshot: weekday,
    period_snapshot: period,
    start_time_snapshot: normalizeSnapshotTime(source.start_time_snapshot || source.startTime),
    end_time_snapshot: normalizeSnapshotTime(source.end_time_snapshot || source.endTime)
  };
}

function normalizeArchivedLeaveForOverview(archive) {
  const source = toPlainValue(archive) || {};
  const archiveId = source.id;
  const student = buildOverviewStudentRecord({
    student: source.student,
    fallbackId: source.student_id || `archive-student:${archiveId}`,
    studentName: source.student_name_snapshot,
    studentNumber: source.student_number_snapshot
  });

  return {
    id: source.original_leave_request_id || `archive:${archiveId}`,
    archiveId,
    leave_type: source.leave_type,
    request_mode: source.request_mode,
    status: source.status,
    submitted_at: source.submitted_at,
    reviewed_at: source.reviewed_at,
    start_time: source.start_time,
    end_time: source.end_time,
    reason: source.reason || '',
    student,
    records: parseArchiveRecordsSnapshot(source.records_snapshot)
      .map((record, index) => normalizeOverviewRecord(record, `archive-record:${archiveId}:${index}`))
      .filter((record) => record.leave_date)
  };
}

function normalizeRealtimeLeaveForOverview(leave) {
  const source = toPlainValue(leave) || {};
  const student = buildOverviewStudentRecord({
    student: source.student,
    fallbackId: source.student_id || `request-student:${source.id}`,
    studentName: source.student_name_snapshot,
    studentNumber: source.student_number_snapshot
  });

  return {
    id: source.id,
    leave_type: source.leave_type,
    request_mode: source.request_mode,
    status: source.status,
    submitted_at: source.submitted_at,
    reviewed_at: source.reviewed_at,
    start_time: source.start_time,
    end_time: source.end_time,
    reason: source.reason || '',
    student,
    records: Array.isArray(source.records)
      ? source.records
        .map((record, index) => normalizeOverviewRecord(record, `request-record:${source.id}:${index}`))
        .filter((record) => record.leave_date)
      : []
  };
}

function getWeekdayLabel(weekday) {
  return WEEKDAY_LABELS[Number(weekday)] || '未知星期';
}

function createDateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getMonday(date) {
  const value = new Date(date);
  const weekday = value.getDay() || 7;
  value.setDate(value.getDate() - weekday + 1);
  return getStartOfDay(value);
}

function getSunday(date) {
  const value = getMonday(date);
  value.setDate(value.getDate() + 6);
  return getEndOfDay(value);
}

function getSemesterRange(now) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 2 && month <= 7) {
    return {
      startDateTime: new Date(year, 1, 1, 0, 0, 0, 0),
      endDateTime: new Date(year, 6, 31, 23, 59, 59, 999),
      label: `${year}春季学期`
    };
  }

  if (month >= 9) {
    return {
      startDateTime: new Date(year, 8, 1, 0, 0, 0, 0),
      endDateTime: new Date(year + 1, 0, 31, 23, 59, 59, 999),
      label: `${year}秋季学期`
    };
  }

  return {
    startDateTime: new Date(year - 1, 8, 1, 0, 0, 0, 0),
    endDateTime: new Date(year, 0, 31, 23, 59, 59, 999),
    label: `${year - 1}秋季学期`
  };
}

function formatMonthDay(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}/${day}`;
}

function getPeriodRange(period = 'week', now = new Date()) {
  if (period === 'month') {
    return {
      period,
      startDateTime: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      endDateTime: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      windowLabel: `${now.getFullYear()}年${now.getMonth() + 1}月`
    };
  }

  if (period === 'semester') {
    return {
      period,
      ...getSemesterRange(now),
      windowLabel: getSemesterRange(now).label
    };
  }

  const startDateTime = getMonday(now);
  const endDateTime = getSunday(now);
  return {
    period: 'week',
    startDateTime,
    endDateTime,
    windowLabel: `${formatMonthDay(startDateTime)} - ${formatMonthDay(endDateTime)}`
  };
}

function getDayPart(now) {
  const hour = now.getHours();
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 18) {
    return 'afternoon';
  }
  return 'evening';
}

function getDayPartLabel(dayPart) {
  return {
    morning: '上午',
    afternoon: '下午',
    evening: '晚间'
  }[dayPart] || '今日';
}

function toDateOnlyString(dateValue) {
  return formatDateKey(typeof dateValue === 'string' ? createDateFromKey(dateValue) : dateValue);
}

function normalizeTarget(target) {
  if (!target) {
    return null;
  }

  return {
    id: target.id,
    type: target.type,
    label: target.label,
    startDate: target.startDate,
    endDate: target.endDate
  };
}

function buildDormitoryIndex(classStudents, dormitories) {
  const index = new Map();

  dormitories.forEach((dormitory) => {
    index.set(`dorm-${dormitory.id}`, {
      dormitoryId: dormitory.id,
      dormitoryName: dormitory.name,
      totalMembers: 0,
      matchCount: 0,
      students: []
    });
  });

  index.set('unassigned', {
    dormitoryId: null,
    dormitoryName: '未分配宿舍',
    totalMembers: 0,
    matchCount: 0,
    students: []
  });

  classStudents.forEach((student) => {
    const key = student.dormitory_id ? `dorm-${student.dormitory_id}` : 'unassigned';
    if (!index.has(key)) {
      index.set(key, {
        dormitoryId: student.dormitory_id || null,
        dormitoryName: student.dormitory?.name || '未分配宿舍',
        totalMembers: 0,
        matchCount: 0,
        students: []
      });
    }
    index.get(key).totalMembers += 1;
  });

  return index;
}

function serializeMatchedStudent(student, extra = {}) {
  return {
    studentId: student.id,
    studentName: student.student_name || student.studentName || '',
    studentNumber: student.student_number || student.studentNumber || '',
    dormitoryId: student.dormitory_id || student.dormitoryId || null,
    dormitoryName: student.dormitory?.name || student.dormitoryName || '未分配宿舍',
    ...extra
  };
}

function buildDormSummary({ classStudents, dormitories, matchedStudents }) {
  const dormIndex = buildDormitoryIndex(classStudents, dormitories);

  matchedStudents.forEach((student) => {
    const key = student.dormitoryId ? `dorm-${student.dormitoryId}` : 'unassigned';
    if (!dormIndex.has(key)) {
      dormIndex.set(key, {
        dormitoryId: student.dormitoryId || null,
        dormitoryName: student.dormitoryName || '未分配宿舍',
        totalMembers: 0,
        matchCount: 0,
        students: []
      });
    }

    const dormitory = dormIndex.get(key);
    dormitory.matchCount += 1;
    dormitory.students.push(student);
  });

  return Array.from(dormIndex.values())
    .filter((item) => item.totalMembers > 0 || item.matchCount > 0)
    .map((item) => ({
      ...item,
      students: sortByStudentNumber(item.students)
    }))
    .sort((left, right) => {
      if (left.dormitoryId === null) {
        return 1;
      }
      if (right.dormitoryId === null) {
        return -1;
      }
      return left.dormitoryName.localeCompare(right.dormitoryName, 'zh-CN', { numeric: true });
    });
}

function buildCopyText(prefix, dormSummary) {
  const parts = dormSummary
    .filter((item) => item.students.length > 0)
    .map((item) => `${item.dormitoryName} ${item.students.map((student) => student.studentName).join('、')}`);

  if (!parts.length) {
    return '';
  }

  return `${prefix}：${parts.join('；')}`;
}

function shouldDefaultWeekendView({ now, availableTargets }) {
  if (!availableTargets.length) {
    return false;
  }

  const todayKey = formatDateKey(now);
  const isHolidayToday = availableTargets.some((target) => (
    target.type === 'holiday'
    && target.startDate <= todayKey
    && target.endDate >= todayKey
  ));

  if (isHolidayToday) {
    return true;
  }

  return now.getDay() === 5 && now.getHours() >= 12;
}

async function loadClassReferenceData(classId) {
  const [classStudents, dormitories, specialDates, schedules, periods] = await Promise.all([
    Student.findAll({
      where: { class_id: classId, status: 'active' },
      include: [{
        model: Dormitory,
        as: 'dormitory',
        attributes: ['id', 'name'],
        required: false
      }],
      order: [['student_number', 'ASC']]
    }),
    Dormitory.findAll({
      where: { class_id: classId },
      order: [['name', 'ASC']]
    }),
    ClassSpecialDate.findAll({
      where: { class_id: classId },
      order: [['date', 'ASC']]
    }),
    Schedule.findAll({
      where: { class_id: classId },
      order: [['weekday', 'ASC'], ['period', 'ASC']]
    }),
    SchedulePeriod.findAll({
      where: { class_id: classId },
      order: [['period', 'ASC']]
    })
  ]);

  return { classStudents, dormitories, specialDates, schedules, periods };
}

async function loadLatestClassroomCheck(classId, checkDate) {
  const record = await ClassroomCheckSubmission.findOne({
    where: {
      class_id: classId,
      check_date: checkDate
    },
    order: [['submitted_at', 'DESC'], ['id', 'DESC']]
  });

  return record ? serializeClassroomCheckSubmission(record) : null;
}

router.get('/counselor-panel', async (req, res) => {
  try {
    const now = new Date();
    const { classStudents, dormitories, specialDates } = await loadClassReferenceData(req.user.classId);
    const availableTargets = getWeekendTargets(now, specialDates);
    const todayKey = formatDateKey(now);
    const defaultTarget = availableTargets.find((item) => (
      item.type === 'holiday'
      && item.startDate <= todayKey
      && item.endDate >= todayKey
    )) || availableTargets[0] || null;
    const selectedTarget = availableTargets.find((item) => item.id === req.query.targetId) || defaultTarget;
    const dayPart = getDayPart(now);
    const latestClassroomCheck = await loadLatestClassroomCheck(req.user.classId, todayKey);

    const currentLeaves = await LeaveRequest.findAll({
      where: {
        class_id: req.user.classId,
        status: 'approved',
        request_mode: { [Op.in]: ['today', 'custom'] },
        start_time: { [Op.lte]: now },
        end_time: { [Op.gte]: now }
      },
      include: [{
        model: Student,
        as: 'student',
        attributes: ['id', 'student_name', 'student_number', 'dormitory_id'],
        include: [{
          model: Dormitory,
          as: 'dormitory',
          attributes: ['id', 'name'],
          required: false
        }]
      }],
      order: [['start_time', 'ASC']]
    });

    const currentLeaveStudents = sortByStudentNumber(currentLeaves.map((leave) => serializeMatchedStudent(leave.student, {
      leaveRequestId: leave.id,
      requestMode: leave.request_mode,
      reason: leave.reason || '',
      currentLocation: leave.current_location,
      startTime: leave.start_time,
      endTime: leave.end_time
    })));

    const inDormitory = currentLeaveStudents.filter((student) => student.currentLocation === 'dormitory');
    const todayDormSummary = buildDormSummary({
      classStudents,
      dormitories,
      matchedStudents: inDormitory
    });

    let weekendStudents = [];
    let weekendDormSummary = [];
    let weekendCopyText = '';

    if (selectedTarget) {
      const targetStart = new Date(`${selectedTarget.startDate}T00:00:00`);
      const targetEnd = new Date(`${selectedTarget.endDate}T23:59:59.999`);

      const weekendLeaves = await LeaveRequest.findAll({
        where: {
          class_id: req.user.classId,
          request_mode: 'weekend',
          status: 'recorded',
          go_home: true,
          start_time: { [Op.lte]: targetEnd },
          end_time: { [Op.gte]: targetStart }
        },
        include: [{
          model: Student,
          as: 'student',
          attributes: ['id', 'student_name', 'student_number', 'dormitory_id'],
          include: [{
            model: Dormitory,
            as: 'dormitory',
            attributes: ['id', 'name'],
            required: false
          }]
        }],
        order: [['submitted_at', 'ASC']]
      });

      weekendStudents = sortByStudentNumber(weekendLeaves.map((leave) => serializeMatchedStudent(leave.student, {
        leaveRequestId: leave.id,
        submittedAt: leave.submitted_at,
        startDate: toDateOnlyString(leave.start_time),
        endDate: toDateOnlyString(leave.end_time)
      })));

      weekendDormSummary = buildDormSummary({
        classStudents,
        dormitories,
        matchedStudents: weekendStudents
      });

      const weekendPrefix = selectedTarget.type === 'holiday'
        ? `${selectedTarget.label}回家`
        : '本周末回家';
      weekendCopyText = buildCopyText(weekendPrefix, weekendDormSummary);
    }

    const todayPrefix = `今日${getDayPartLabel(dayPart)}请假在宿舍`;
    const todayCopyText = buildCopyText(todayPrefix, todayDormSummary);

    res.json({
      defaultView: shouldDefaultWeekendView({ now, availableTargets }) ? 'weekend' : 'today',
      availableTargets: availableTargets.map(normalizeTarget),
      today: {
        dayPart,
        currentLeaves: currentLeaveStudents,
        inDormitory,
        dormSummary: todayDormSummary,
        copyText: todayCopyText,
        classroomCheck: latestClassroomCheck
      },
      weekend: {
        selectedTarget: normalizeTarget(selectedTarget),
        students: weekendStudents,
        dormSummary: weekendDormSummary,
        copyText: weekendCopyText
      }
    });
  } catch (error) {
    console.error('获取教师面板数据失败:', error);
    res.status(500).json({ error: '获取教师面板数据失败' });
  }
});

function isDateKeyInRange(dateKey, startKey, endKey) {
  return Boolean(dateKey) && dateKey >= startKey && dateKey <= endKey;
}

function getWeekdayNumberFromDate(dateValue) {
  const weekday = createDateFromKey(dateValue).getDay();
  return weekday === 0 ? 7 : weekday;
}

function buildCurrentCourseSlots(schedules, periods) {
  const normalizedPeriods = normalizePeriods(periods);
  const periodMap = new Map(normalizedPeriods.map((item) => [item.period, item]));

  return schedules
    .filter((item) => item.subject)
    .map((item) => {
      const periodConfig = periodMap.get(item.period);
      const startTime = periodConfig?.startTime || '';
      const endTime = periodConfig?.endTime || '';
      const timeLabel = startTime && endTime ? `${startTime} - ${endTime}` : '';
      return {
        slotKey: buildCourseSlotKey({
          weekday: item.weekday,
          period: item.period,
          subject: item.subject,
          startTime,
          endTime
        }),
        slotType: 'current',
        scheduleId: item.id,
        weekday: item.weekday,
        weekdayLabel: getWeekdayLabel(item.weekday),
        period: item.period,
        subject: item.subject,
        location: item.location || '教室',
        startTime,
        endTime,
        timeLabel,
        displayLabel: `${getWeekdayLabel(item.weekday)} 第${item.period}节${item.subject ? ` · ${item.subject}` : ''}${timeLabel ? ` · ${timeLabel}` : ''}`
      };
    })
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }
      return left.period - right.period;
    });
}

function groupSlotsByWeekday(slots) {
  const grouped = new Map();
  slots.forEach((slot) => {
    if (!grouped.has(slot.weekday)) {
      grouped.set(slot.weekday, []);
    }
    grouped.get(slot.weekday).push(slot);
  });
  return grouped;
}

function getRecordSnapshot(record) {
  return {
    subject: record.subject_snapshot || record.subject || '',
    weekday: record.weekday_snapshot || record.weekday || (record.leave_date ? getWeekdayNumberFromDate(record.leave_date) : null),
    period: record.period_snapshot || record.period || null,
    startTime: String(record.start_time_snapshot || '').slice(0, 5),
    endTime: String(record.end_time_snapshot || '').slice(0, 5)
  };
}

function getTimeMatchScore(slot, snapshot) {
  if (snapshot.startTime && slot.startTime) {
    const slotStart = parseTimeToMinutes(slot.startTime);
    const snapshotStart = parseTimeToMinutes(snapshot.startTime);
    const startDiff = Math.abs(slotStart - snapshotStart);
    const slotEnd = slot.endTime ? parseTimeToMinutes(slot.endTime) : slotStart;
    const snapshotEnd = snapshot.endTime ? parseTimeToMinutes(snapshot.endTime) : snapshotStart;
    const endDiff = Math.abs(slotEnd - snapshotEnd);
    const overlap = Math.max(slotStart, snapshotStart) <= Math.min(slotEnd, snapshotEnd);

    if (overlap) {
      return 0;
    }

    const diff = Math.min(startDiff, endDiff);
    if (diff <= COURSE_MATCH_TOLERANCE_MINUTES) {
      return diff;
    }

    return null;
  }

  if (snapshot.period && slot.period === snapshot.period) {
    return 5;
  }

  return null;
}

function pickClosestSlot(candidates, snapshot, requireSubject = false) {
  if (!candidates.length) {
    return null;
  }

  const snapshotSubject = normalizeText(snapshot.subject);
  const scoped = requireSubject && snapshotSubject
    ? candidates.filter((slot) => normalizeText(slot.subject) === snapshotSubject)
    : candidates;

  if (!scoped.length) {
    return null;
  }

  const scored = scoped
    .map((slot) => {
      const timeScore = getTimeMatchScore(slot, snapshot);
      if (timeScore !== null) {
        return { slot, score: timeScore };
      }
      return null;
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score);

  if (scored.length) {
    return scored[0].slot;
  }

  if (snapshot.period) {
    return scoped.find((slot) => slot.period === snapshot.period) || null;
  }

  if (requireSubject && scoped.length === 1) {
    return scoped[0];
  }

  return null;
}

function buildHistoricalCourseSlot(record) {
  const snapshot = getRecordSnapshot(record);
  const subject = snapshot.subject || '历史课程';
  const weekday = snapshot.weekday || 0;
  const weekdayLabel = getWeekdayLabel(weekday);
  const period = snapshot.period || null;
  const timeLabel = snapshot.startTime && snapshot.endTime
    ? `${snapshot.startTime} - ${snapshot.endTime}`
    : '';

  return {
    slotKey: buildCourseSlotKey({
      weekday,
      period,
      subject,
      startTime: snapshot.startTime,
      endTime: snapshot.endTime
    }),
    slotType: 'historical',
    scheduleId: null,
    weekday,
    weekdayLabel,
    period,
    subject,
    location: '',
    startTime: snapshot.startTime,
    endTime: snapshot.endTime,
    timeLabel,
    displayLabel: `${weekdayLabel}${period ? ` 第${period}节` : ''}${subject ? ` · ${subject}` : ''}${timeLabel ? ` · ${timeLabel}` : ''}`
  };
}

function resolveCourseSlot(record, currentSlotsByWeekday) {
  const snapshot = getRecordSnapshot(record);
  const candidates = currentSlotsByWeekday.get(snapshot.weekday) || [];

  if (snapshot.subject) {
    const exactMatch = pickClosestSlot(candidates, snapshot, true);
    if (exactMatch) {
      return exactMatch;
    }
  }

  const fuzzyMatch = pickClosestSlot(candidates, snapshot, false);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  return buildHistoricalCourseSlot(record);
}

function buildWeekdayOccurrenceMap({ startDateTime, endDateTime, specialDates }) {
  const weekdayMap = new Map();

  for (let cursor = getStartOfDay(startDateTime); cursor <= endDateTime; cursor.setDate(cursor.getDate() + 1)) {
    const dayContext = getDayContext(cursor, specialDates);
    if (!dayContext.isWorkday || !dayContext.effectiveWeekday) {
      continue;
    }

    const weekday = dayContext.effectiveWeekday;
    weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + 1);
  }

  return weekdayMap;
}

function buildCurrentSlotOccurrenceMap({ currentSlots, startDateTime, endDateTime, specialDates }) {
  const slotMap = new Map(currentSlots.map((slot) => [slot.slotKey, 0]));
  const currentSlotsByWeekday = groupSlotsByWeekday(currentSlots);

  for (let cursor = getStartOfDay(startDateTime); cursor <= endDateTime; cursor.setDate(cursor.getDate() + 1)) {
    const dayContext = getDayContext(cursor, specialDates);
    if (!dayContext.isWorkday || !dayContext.effectiveWeekday) {
      continue;
    }

    const weekday = dayContext.effectiveWeekday;
    const daySlots = currentSlotsByWeekday.get(weekday) || [];
    daySlots.forEach((slot) => {
      slotMap.set(slot.slotKey, (slotMap.get(slot.slotKey) || 0) + 1);
    });
  }

  return slotMap;
}

function setTimeOnDate(date, timeValue = '12:00') {
  const value = new Date(date);
  const normalized = normalizeSnapshotTime(timeValue) || '12:00';
  const [hour, minute] = normalized.split(':').map((item) => Number(item) || 0);
  value.setHours(hour, minute, 0, 0);
  return value;
}

async function loadClassStudentLifecycleRecords(classId, rangeEndDateTime) {
  const students = await Student.findAll({
    where: { class_id: classId },
    attributes: ['id', 'status', 'created_at']
  });

  if (!students.length) {
    return { students, auditLogs: [] };
  }

  const auditLogs = await AuditLog.findAll({
    where: {
      target_type: 'student',
      target_id: { [Op.in]: students.map((student) => student.id) },
      action: { [Op.in]: ['update_student', 'archive_student'] },
      created_at: { [Op.lte]: rangeEndDateTime }
    },
    attributes: ['id', 'target_id', 'action', 'details', 'created_at'],
    order: [['created_at', 'ASC'], ['id', 'ASC']]
  });

  return { students, auditLogs };
}

function normalizeAuditStudentStatus(log) {
  if (!log) {
    return '';
  }

  if (log.action === 'archive_student') {
    return 'inactive';
  }

  const status = String(log.details?.status || log.details?.newStatus || '').trim();
  return ['active', 'inactive'].includes(status) ? status : '';
}

function buildStudentStatusTimelineMap(students, auditLogs) {
  const timelineMap = new Map();

  students.forEach((student) => {
    timelineMap.set(Number(student.id), {
      createdAt: new Date(student.created_at),
      currentStatus: student.status === 'inactive' ? 'inactive' : 'active',
      events: []
    });
  });

  auditLogs.forEach((log) => {
    const timeline = timelineMap.get(Number(log.target_id));
    const status = normalizeAuditStudentStatus(log);
    if (!timeline || !status) {
      return;
    }

    timeline.events.push({
      at: new Date(log.created_at),
      status
    });
  });

  timelineMap.forEach((timeline) => {
    timeline.events.sort((left, right) => left.at - right.at);
  });

  return timelineMap;
}

function resolveStudentStatusAt(timeline, at) {
  if (!timeline || !(at instanceof Date)) {
    return 'inactive';
  }

  if (at < timeline.createdAt) {
    return 'inactive';
  }

  let resolved = 'active';
  for (const event of timeline.events) {
    if (event.at > at) {
      break;
    }
    resolved = event.status;
  }

  return resolved || timeline.currentStatus || 'inactive';
}

function countActiveStudentsAt(timelineMap, at) {
  let count = 0;
  timelineMap.forEach((timeline) => {
    if (resolveStudentStatusAt(timeline, at) === 'active') {
      count += 1;
    }
  });
  return count;
}

function buildHistoricalActiveAttendanceMaps({
  currentSlots,
  startDateTime,
  endDateTime,
  specialDates,
  timelineMap
}) {
  const slotActiveAttendanceMap = new Map(currentSlots.map((slot) => [slot.slotKey, 0]));
  const weekdayActiveAttendanceMap = new Map();
  const currentSlotsByWeekday = groupSlotsByWeekday(currentSlots);

  for (let cursor = getStartOfDay(startDateTime); cursor <= endDateTime; cursor.setDate(cursor.getDate() + 1)) {
    const dayContext = getDayContext(cursor, specialDates);
    if (!dayContext.isWorkday || !dayContext.effectiveWeekday) {
      continue;
    }

    const weekday = dayContext.effectiveWeekday;
    const weekdayActiveCount = countActiveStudentsAt(timelineMap, setTimeOnDate(cursor, '12:00'));
    weekdayActiveAttendanceMap.set(
      weekday,
      (weekdayActiveAttendanceMap.get(weekday) || 0) + weekdayActiveCount
    );

    const daySlots = currentSlotsByWeekday.get(weekday) || [];
    daySlots.forEach((slot) => {
      const activeCount = countActiveStudentsAt(timelineMap, setTimeOnDate(cursor, slot.startTime || '12:00'));
      slotActiveAttendanceMap.set(
        slot.slotKey,
        (slotActiveAttendanceMap.get(slot.slotKey) || 0) + activeCount
      );
    });
  }

  return { slotActiveAttendanceMap, weekdayActiveAttendanceMap };
}

function buildCourseSlotKey({ weekday, period, subject, startTime, endTime }) {
  return [
    weekday || 0,
    period || 0,
    normalizeText(subject) || 'unknown',
    normalizeSnapshotTime(startTime) || 'none',
    normalizeSnapshotTime(endTime) || 'none'
  ].join(':');
}

function buildCourseTimeSummaryEntry({ weekday, weekdayLabel, period, timeRange, startTime, endTime }) {
  const normalizedWeekday = Number(weekday) || 0;
  const normalizedPeriod = Number(period) || 0;
  const normalizedTimeRange = String(
    timeRange
    || ((normalizeSnapshotTime(startTime) && normalizeSnapshotTime(endTime))
      ? `${normalizeSnapshotTime(startTime)} - ${normalizeSnapshotTime(endTime)}`
      : '')
  ).trim();
  const label = [
    weekdayLabel || getWeekdayLabel(normalizedWeekday),
    normalizedPeriod ? `第${normalizedPeriod}节` : '',
    normalizedTimeRange
  ].filter(Boolean).join(' · ');

  return {
    key: `${normalizedWeekday}:${normalizedPeriod}:${normalizedTimeRange || 'none'}`,
    weekday: normalizedWeekday,
    period: normalizedPeriod,
    label
  };
}

function addCourseTimeSummaryEntry(targetMap, payload) {
  if (!targetMap) {
    return;
  }
  const entry = buildCourseTimeSummaryEntry(payload);
  if (!entry.label) {
    return;
  }
  targetMap.set(entry.key, entry);
}

function formatCourseTimeSummary(summaryMap) {
  const entries = Array.from((summaryMap || new Map()).values())
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }
      if (left.period !== right.period) {
        return left.period - right.period;
      }
      return String(left.label).localeCompare(String(right.label), 'zh-CN');
    });

  if (!entries.length) {
    return '';
  }

  const preview = entries.slice(0, 2).map((item) => item.label).join(' / ');
  return entries.length > 2 ? `${preview} 等 ${entries.length} 个时段` : preview;
}

function formatTrendWeekLabel(dateKey) {
  return formatMonthDay(createDateFromKey(dateKey));
}

function getWeekBucketKey(dateKey) {
  return formatDateKey(getMonday(createDateFromKey(dateKey)));
}

function formatWeekBucketLabel(dateKey) {
  const start = getMonday(createDateFromKey(dateKey));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

function buildTrendBuckets(range) {
  const buckets = new Map();

  if (range.period === 'semester') {
    for (let cursor = getMonday(range.startDateTime); cursor <= range.endDateTime; cursor.setDate(cursor.getDate() + 7)) {
      const key = formatDateKey(cursor);
      buckets.set(key, {
        key,
        label: formatWeekBucketLabel(key),
        leavePeriods: 0,
        studentIds: new Set(),
        truancyCount: 0,
        submissionIds: new Set()
      });
    }
    return buckets;
  }

  for (let cursor = getStartOfDay(range.startDateTime); cursor <= range.endDateTime; cursor.setDate(cursor.getDate() + 1)) {
    const key = formatDateKey(cursor);
    buckets.set(key, {
      key,
      label: formatTrendWeekLabel(key),
      leavePeriods: 0,
      studentIds: new Set(),
      truancyCount: 0,
      submissionIds: new Set()
    });
  }

  return buckets;
}

function getTrendBucketKey(range, dateKey) {
  return range.period === 'semester' ? getWeekBucketKey(dateKey) : dateKey;
}

function ensureMapItem(map, key, factory) {
  if (!map.has(key)) {
    map.set(key, factory());
  }
  return map.get(key);
}

function formatLeaveDateTime(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('zh-CN');
}

async function loadOverviewLeavesForRange(classId, range) {
  const [archivedLeaves, realtimeLeaves] = await Promise.all([
    LeaveHistoryArchive.findAll({
      where: {
        class_id: classId,
        status: { [Op.in]: ['approved', 'recorded'] },
        request_mode: { [Op.in]: ['today', 'custom'] },
        source_type: { [Op.ne]: 'restore_preview' }
      },
      include: [createStatisticsStudentInclude()],
      order: [['submitted_at', 'DESC'], ['reviewed_at', 'DESC'], ['id', 'DESC']]
    }),
    LeaveRequest.findAll({
      where: {
        class_id: classId,
        status: { [Op.in]: ['approved', 'recorded'] },
        request_mode: { [Op.in]: ['today', 'custom'] },
        start_time: { [Op.lte]: range.endDateTime },
        end_time: { [Op.gte]: range.startDateTime }
      },
      include: [createStatisticsStudentInclude(), {
        model: LeaveRecord,
        as: 'records'
      }],
      order: [['submitted_at', 'DESC']]
    })
  ]);

  const normalizedArchivedLeaves = archivedLeaves.map(normalizeArchivedLeaveForOverview);
  const archivedRequestIds = new Set(
    normalizedArchivedLeaves
      .filter((leave) => typeof leave.id === 'number' && leave.records.length > 0)
      .map((leave) => leave.id)
  );

  const normalizedRealtimeLeaves = realtimeLeaves
    .map(normalizeRealtimeLeaveForOverview)
    .filter((leave) => !archivedRequestIds.has(leave.id));

  return [...normalizedArchivedLeaves, ...normalizedRealtimeLeaves]
    .sort((left, right) => {
      const rightTime = new Date(right.submitted_at || 0).getTime();
      const leftTime = new Date(left.submitted_at || 0).getTime();
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return String(right.id).localeCompare(String(left.id), 'zh-CN', { numeric: true });
    });
}

async function loadOverviewClassroomChecksForRange(classId, range) {
  return ClassroomCheckSubmission.findAll({
    where: {
      class_id: classId,
      check_date: {
        [Op.gte]: formatDateKey(range.startDateTime),
        [Op.lte]: formatDateKey(range.endDateTime)
      }
    },
    order: [['submitted_at', 'DESC'], ['id', 'DESC']]
  });
}

function buildClassroomCheckOverview({ submissions, range, classStudents }) {
  const trendBuckets = buildTrendBuckets(range);
  const studentDirectory = new Map(classStudents.map((student) => [String(student.id), {
    dormitoryId: student.dormitory_id || null,
    dormitoryName: student.dormitory?.name || '未分配宿舍'
  }]));
  const studentRankingMap = new Map();
  const dormitoryRankingMap = new Map();
  const weekdayDistributionMap = new Map(Array.from({ length: 7 }, (_, index) => [index + 1, 0]));
  const slotRankingMap = new Map();
  const subjectRankingMap = new Map();
  const impactedStudentKeys = new Set();
  const detailRows = [];
  let totalQuestionCount = 0;

  submissions.forEach((submissionRecord) => {
    const submission = serializeClassroomCheckSubmission(submissionRecord);
    const checkDate = submission.checkDate || formatDateKey(new Date(submission.submittedAt));
    const bucket = trendBuckets.get(getTrendBucketKey(range, checkDate));
    const weekday = checkDate ? getWeekdayNumberFromDate(checkDate) : null;
    const slotLabel = submission.slotLabel || '未标记时段';
    const slotKey = buildCourseSlotKey({
      weekday,
      period: submission.period || null,
      subject: submission.subject || '',
      startTime: submission.startTime,
      endTime: submission.endTime
    });
    const subjectLabel = submission.subject || '未命名课程';
    const questionStudentIds = new Set((submission.questionStudents || []).map((item) => String(item.studentId)));
    const questionStudentKeys = new Set((submission.questionStudents || []).map((item) => (
      buildStudentMatchKey(item.studentId || null, item.studentName || '')
    )));
    totalQuestionCount += submission.questionStudents.length;

    if (bucket) {
      bucket.submissionIds.add(submission.id);
      bucket.questionCount = (bucket.questionCount || 0) + submission.questionStudents.length;
    }

    if (!submission.truancyStudents.length) {
      return;
    }

    if (weekday) {
      weekdayDistributionMap.set(weekday, (weekdayDistributionMap.get(weekday) || 0) + submission.truancyStudents.length);
    }

    const slotEntry = ensureMapItem(slotRankingMap, slotKey, () => ({
      slotKey,
      label: slotLabel,
      slotKind: submission.slotKind,
      subject: subjectLabel,
      weekday,
      weekdayLabel: getWeekdayLabel(weekday),
      period: submission.period || null,
      timeRange: submission.startTime && submission.endTime ? `${submission.startTime} - ${submission.endTime}` : '',
      truancyCount: 0,
      submissionIds: new Set(),
      timeSummaryEntries: new Map()
    }));
    slotEntry.truancyCount += submission.truancyStudents.length;
    slotEntry.submissionIds.add(submission.id);
    addCourseTimeSummaryEntry(slotEntry.timeSummaryEntries, {
      weekday,
      weekdayLabel: slotEntry.weekdayLabel,
      period: slotEntry.period,
      timeRange: slotEntry.timeRange,
      startTime: submission.startTime,
      endTime: submission.endTime
    });

    const subjectEntry = ensureMapItem(subjectRankingMap, normalizeText(subjectLabel) || subjectLabel, () => ({
      subject: subjectLabel,
      truancyCount: 0,
      questionCount: 0,
      submissionIds: new Set(),
      timeSummaryEntries: new Map()
    }));
    subjectEntry.truancyCount += submission.truancyStudents.length;
    subjectEntry.questionCount += submission.questionStudents.length;
    subjectEntry.submissionIds.add(submission.id);
    addCourseTimeSummaryEntry(subjectEntry.timeSummaryEntries, {
      weekday,
      weekdayLabel: getWeekdayLabel(weekday),
      period: submission.period || null,
      timeRange: submission.startTime && submission.endTime ? `${submission.startTime} - ${submission.endTime}` : '',
      startTime: submission.startTime,
      endTime: submission.endTime
    });

    submission.truancyStudents.forEach((studentSnapshot) => {
      const studentKey = studentSnapshot.studentId ? String(studentSnapshot.studentId) : `name:${studentSnapshot.studentName}`;
      const studentMeta = studentDirectory.get(studentKey) || {
        dormitoryId: null,
        dormitoryName: '未分配宿舍'
      };

      impactedStudentKeys.add(studentKey);
      if (bucket) {
        bucket.truancyCount += 1;
        bucket.studentIds.add(studentKey);
      }

      const studentEntry = ensureMapItem(studentRankingMap, studentKey, () => ({
        studentId: studentSnapshot.studentId || null,
        studentName: studentSnapshot.studentName || '',
        studentNumber: studentSnapshot.studentNumber || '',
        dormitoryId: studentMeta.dormitoryId,
        dormitoryName: studentMeta.dormitoryName,
        truancyCount: 0,
        submissionIds: new Set()
      }));
      studentEntry.truancyCount += 1;
      studentEntry.submissionIds.add(submission.id);

      const dormitoryKey = studentMeta.dormitoryId || 'unassigned';
      const dormitoryEntry = ensureMapItem(dormitoryRankingMap, dormitoryKey, () => ({
        dormitoryId: studentMeta.dormitoryId,
        dormitoryName: studentMeta.dormitoryName,
        truancyCount: 0,
        studentKeys: new Set(),
        submissionIds: new Set()
      }));
      dormitoryEntry.truancyCount += 1;
      dormitoryEntry.studentKeys.add(studentKey);
      dormitoryEntry.submissionIds.add(submission.id);

      detailRows.push({
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        submittedByName: submission.submittedByName,
        checkDate,
        slotKind: submission.slotKind,
        slotLabel,
        subject: subjectLabel,
        weekday,
        weekdayLabel: getWeekdayLabel(weekday),
        period: submission.period || null,
        studentId: studentSnapshot.studentId || null,
        studentName: studentSnapshot.studentName || '',
        studentNumber: studentSnapshot.studentNumber || '',
        dormitoryId: studentMeta.dormitoryId,
        dormitoryName: studentMeta.dormitoryName,
        isQuestion: questionStudentIds.has(String(studentSnapshot.studentId))
          || questionStudentKeys.has(buildStudentMatchKey(studentSnapshot.studentId || null, studentSnapshot.studentName || ''))
      });
    });
  });

  const studentRanking = Array.from(studentRankingMap.values())
    .sort((left, right) => {
      if (right.truancyCount !== left.truancyCount) {
        return right.truancyCount - left.truancyCount;
      }
      return String(left.studentName).localeCompare(String(right.studentName), 'zh-CN');
    })
    .map((item, index) => ({
      rank: index + 1,
      studentId: item.studentId,
      studentName: item.studentName,
      studentNumber: item.studentNumber,
      dormitoryId: item.dormitoryId,
      dormitoryName: item.dormitoryName,
      truancyCount: item.truancyCount,
      submissionCount: item.submissionIds.size
    }));

  const dormitoryRanking = Array.from(dormitoryRankingMap.values())
    .sort((left, right) => {
      if (right.truancyCount !== left.truancyCount) {
        return right.truancyCount - left.truancyCount;
      }
      return right.studentKeys.size - left.studentKeys.size;
    })
    .map((item, index) => ({
      rank: index + 1,
      dormitoryId: item.dormitoryId,
      dormitoryName: item.dormitoryName,
      truancyCount: item.truancyCount,
      impactedStudents: item.studentKeys.size,
      submissionCount: item.submissionIds.size
    }));

  const weekdayDistribution = Array.from(weekdayDistributionMap.entries())
    .map(([weekday, truancyCount]) => ({
      weekday,
      label: getWeekdayLabel(weekday),
      truancyCount
    }))
    .sort((left, right) => left.weekday - right.weekday);

  const slotRanking = Array.from(slotRankingMap.values())
    .sort((left, right) => {
      if (right.truancyCount !== left.truancyCount) {
        return right.truancyCount - left.truancyCount;
      }
      return right.submissionIds.size - left.submissionIds.size;
    })
    .map((item, index) => ({
      rank: index + 1,
      slotKey: item.slotKey,
      label: item.label,
      slotKind: item.slotKind,
      subject: item.subject,
      weekday: item.weekday,
      weekdayLabel: item.weekdayLabel,
      period: item.period,
      timeRange: item.timeRange,
      timeSummary: formatCourseTimeSummary(item.timeSummaryEntries),
      truancyCount: item.truancyCount,
      submissionCount: item.submissionIds.size
    }));

  const subjectRanking = Array.from(subjectRankingMap.values())
    .sort((left, right) => {
      if (right.truancyCount !== left.truancyCount) {
        return right.truancyCount - left.truancyCount;
      }
      if (right.questionCount !== left.questionCount) {
        return right.questionCount - left.questionCount;
      }
      return right.submissionIds.size - left.submissionIds.size;
    })
    .map((item, index) => ({
      rank: index + 1,
      subject: item.subject,
      timeSummary: formatCourseTimeSummary(item.timeSummaryEntries),
      truancyCount: item.truancyCount,
      questionCount: item.questionCount,
      submissionCount: item.submissionIds.size
    }));

  const trend = Array.from(trendBuckets.values()).map((item) => ({
    key: item.key,
    label: item.label,
    truancyCount: item.truancyCount || 0,
    impactedStudents: item.studentIds?.size || 0,
    submissionCount: item.submissionIds?.size || 0,
    questionCount: item.questionCount || 0
  }));

  const hottestWeekday = [...weekdayDistribution]
    .filter((item) => item.truancyCount > 0)
    .sort((left, right) => right.truancyCount - left.truancyCount)[0] || null;

  return {
    summary: {
      totalTruancyCount: detailRows.length,
      impactedStudents: impactedStudentKeys.size,
      submissionCount: submissions.length,
      totalQuestionCount,
      topStudent: studentRanking[0] || null,
      topDormitory: dormitoryRanking[0] || null,
      hottestWeekday,
      hottestSlot: slotRanking[0] || null
    },
    trend,
    studentRanking,
    dormitoryRanking,
    weekdayDistribution,
    slotRanking,
    subjectRanking,
    detailRows: detailRows.sort((left, right) => {
      const rightTime = new Date(right.submittedAt || 0).getTime();
      const leftTime = new Date(left.submittedAt || 0).getTime();
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return String(left.studentName).localeCompare(String(right.studentName), 'zh-CN');
    })
  };
}

async function buildOverviewData(classId, period = 'week') {
  const now = new Date();
  const range = getPeriodRange(period, now);
  const startKey = formatDateKey(range.startDateTime);
  const endKey = formatDateKey(range.endDateTime);
  const { classStudents, dormitories, specialDates, schedules, periods } = await loadClassReferenceData(classId);
  const currentSlots = buildCurrentCourseSlots(schedules, periods);
  const currentSlotsByWeekday = groupSlotsByWeekday(currentSlots);
  const trendBuckets = buildTrendBuckets(range);
  const [leaves, classroomCheckSubmissions, lifecycleRecords] = await Promise.all([
    loadOverviewLeavesForRange(classId, range),
    loadOverviewClassroomChecksForRange(classId, range),
    loadClassStudentLifecycleRecords(classId, range.endDateTime)
  ]);
  const studentStatusTimelineMap = buildStudentStatusTimelineMap(
    lifecycleRecords.students,
    lifecycleRecords.auditLogs
  );
  const { slotActiveAttendanceMap, weekdayActiveAttendanceMap } = buildHistoricalActiveAttendanceMaps({
    currentSlots,
    startDateTime: range.startDateTime,
    endDateTime: range.endDateTime,
    specialDates,
    timelineMap: studentStatusTimelineMap
  });
  const classroomCheck = buildClassroomCheckOverview({
    submissions: classroomCheckSubmissions,
    range,
    classStudents
  });

  const studentRankingMap = new Map();
  const dormitoryRankingMap = new Map();
  const weekdayDistributionMap = new Map(Array.from({ length: 7 }, (_, index) => [index + 1, {
    totalPeriods: 0,
    studentDayKeys: new Set()
  }]));
  const leaveTypeDistributionMap = new Map(Object.keys(LEAVE_TYPE_LABELS).map((key) => [key, 0]));
  const slotMetricsMap = new Map();
  const detailRows = [];
  const impactedStudentIds = new Set();
  const requestIds = new Set();

  leaves.forEach((leave) => {
    const records = (leave.records || []).filter((record) => isDateKeyInRange(record.leave_date, startKey, endKey));
    if (!records.length || !leave.student) {
      return;
    }

    requestIds.add(leave.id);
    leaveTypeDistributionMap.set(
      leave.leave_type,
      (leaveTypeDistributionMap.get(leave.leave_type) || 0) + 1
    );
    impactedStudentIds.add(leave.student.id);

    const studentEntry = ensureMapItem(studentRankingMap, leave.student.id, () => ({
      studentId: leave.student.id,
      studentName: leave.student.student_name,
      studentNumber: leave.student.student_number || '',
      dormitoryId: leave.student.dormitory_id || null,
      dormitoryName: leave.student.dormitory?.name || '未分配宿舍',
      totalPeriods: 0,
      totalRequests: 0
    }));
    studentEntry.totalPeriods += records.length;
    studentEntry.totalRequests += 1;

    const dormitoryKey = leave.student.dormitory_id || 'unassigned';
    const dormitoryEntry = ensureMapItem(dormitoryRankingMap, dormitoryKey, () => ({
      dormitoryId: leave.student.dormitory_id || null,
      dormitoryName: leave.student.dormitory?.name || '未分配宿舍',
      totalPeriods: 0,
      totalRequests: 0,
      studentIds: new Set(),
      studentDayKeys: new Set()
    }));
    dormitoryEntry.totalPeriods += records.length;
    dormitoryEntry.totalRequests += 1;
    dormitoryEntry.studentIds.add(leave.student.id);

    records.forEach((record) => {
      const weekday = getWeekdayNumberFromDate(record.leave_date);
      const studentDayKey = `${leave.student.id}:${record.leave_date}`;
      const trendBucket = trendBuckets.get(getTrendBucketKey(range, record.leave_date));
      if (trendBucket) {
        trendBucket.leavePeriods += 1;
        trendBucket.studentIds.add(leave.student.id);
      }

      dormitoryEntry.studentDayKeys.add(studentDayKey);
      const weekdayEntry = ensureMapItem(weekdayDistributionMap, weekday, () => ({
        totalPeriods: 0,
        studentDayKeys: new Set()
      }));
      weekdayEntry.totalPeriods += 1;
      weekdayEntry.studentDayKeys.add(studentDayKey);

      const resolvedSlot = resolveCourseSlot(record, currentSlotsByWeekday);
      const slotMetric = ensureMapItem(slotMetricsMap, resolvedSlot.slotKey, () => ({
        ...resolvedSlot,
        leaveCount: 0,
        timeSummaryEntries: new Map()
      }));
      slotMetric.leaveCount += 1;
      addCourseTimeSummaryEntry(slotMetric.timeSummaryEntries, {
        weekday: resolvedSlot.weekday,
        weekdayLabel: resolvedSlot.weekdayLabel,
        period: resolvedSlot.period,
        timeRange: resolvedSlot.timeLabel,
        startTime: resolvedSlot.startTime,
        endTime: resolvedSlot.endTime
      });

      detailRows.push({
        id: record.id,
        leaveRequestId: leave.id,
        studentId: leave.student.id,
        studentName: leave.student.student_name,
        dormitoryId: leave.student.dormitory_id || null,
        dormitoryName: leave.student.dormitory?.name || '未分配宿舍',
        leaveDate: record.leave_date,
        weekday,
        weekdayLabel: getWeekdayLabel(weekday),
        leaveType: leave.leave_type,
        leaveTypeLabel: LEAVE_TYPE_LABELS[leave.leave_type] || '其他',
        courseLabel: resolvedSlot.displayLabel,
        subject: resolvedSlot.subject || record.subject || '未命名课程',
        period: resolvedSlot.period || record.period || null,
        timeRange: resolvedSlot.timeLabel,
        slotType: resolvedSlot.slotType,
        requestMode: leave.request_mode,
        submittedAt: leave.submitted_at,
        leaveStartTime: leave.start_time,
        leaveEndTime: leave.end_time
      });
    });
  });

  const studentRanking = Array.from(studentRankingMap.values())
    .sort((left, right) => {
      if (right.totalPeriods !== left.totalPeriods) {
        return right.totalPeriods - left.totalPeriods;
      }
      return right.totalRequests - left.totalRequests;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const dormitoryRanking = Array.from(dormitoryRankingMap.values())
    .sort((left, right) => {
      if (right.studentDayKeys.size !== left.studentDayKeys.size) {
        return right.studentDayKeys.size - left.studentDayKeys.size;
      }
      if (right.totalPeriods !== left.totalPeriods) {
        return right.totalPeriods - left.totalPeriods;
      }
      return right.studentIds.size - left.studentIds.size;
    })
    .map((item, index) => ({
      rank: index + 1,
      dormitoryId: item.dormitoryId,
      dormitoryName: item.dormitoryName,
      leavePersonDays: item.studentDayKeys.size,
      totalPeriods: item.totalPeriods,
      totalRequests: item.totalRequests,
      impactedStudents: item.studentIds.size
    }));

  const weekdayDistribution = Array.from(weekdayDistributionMap.entries())
    .map(([weekday, metrics]) => ({
      weekday,
      label: getWeekdayLabel(weekday),
      totalPeriods: metrics.totalPeriods,
      leavePersonDays: metrics.studentDayKeys.size
    }))
    .sort((left, right) => left.weekday - right.weekday);

  const leaveTypeDistribution = Array.from(leaveTypeDistributionMap.entries())
    .map(([type, totalRequests]) => ({
      type,
      label: LEAVE_TYPE_LABELS[type] || '其他',
      totalRequests
    }))
    .filter((item) => item.totalRequests > 0);

  const courseProbabilityBySlot = Array.from(slotMetricsMap.values())
    .map((slot) => {
      const theoreticalAttendance = slot.slotType === 'current'
        ? (slotActiveAttendanceMap.get(slot.slotKey) || 0)
        : (weekdayActiveAttendanceMap.get(slot.weekday) || 0);
      return {
        slotKey: slot.slotKey,
        label: slot.displayLabel,
        subject: slot.subject,
        weekday: slot.weekday,
        weekdayLabel: slot.weekdayLabel,
        period: slot.period,
        timeRange: slot.timeLabel,
        timeSummary: formatCourseTimeSummary(slot.timeSummaryEntries),
        leaveCount: slot.leaveCount,
        theoreticalAttendance,
        probability: theoreticalAttendance > 0 ? Number((slot.leaveCount / theoreticalAttendance).toFixed(4)) : 0,
        slotType: slot.slotType
      };
    })
    .sort((left, right) => {
      if (right.probability !== left.probability) {
        return right.probability - left.probability;
      }
      return right.leaveCount - left.leaveCount;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const subjectProbabilityMap = new Map();
  courseProbabilityBySlot.forEach((slot) => {
    const subjectEntry = ensureMapItem(subjectProbabilityMap, normalizeText(slot.subject) || slot.subject, () => ({
      subject: slot.subject,
      leaveCount: 0,
      theoreticalAttendance: 0,
      timeSummaryEntries: new Map()
    }));
    subjectEntry.leaveCount += slot.leaveCount;
    subjectEntry.theoreticalAttendance += slot.theoreticalAttendance;
    addCourseTimeSummaryEntry(subjectEntry.timeSummaryEntries, {
      weekday: slot.weekday,
      weekdayLabel: slot.weekdayLabel,
      period: slot.period,
      timeRange: slot.timeRange
    });
  });

  const courseProbabilityBySubject = Array.from(subjectProbabilityMap.values())
    .map((item) => ({
      subject: item.subject,
      leaveCount: item.leaveCount,
      theoreticalAttendance: item.theoreticalAttendance,
      timeSummary: formatCourseTimeSummary(item.timeSummaryEntries),
      probability: item.theoreticalAttendance > 0 ? Number((item.leaveCount / item.theoreticalAttendance).toFixed(4)) : 0
    }))
    .sort((left, right) => {
      if (right.probability !== left.probability) {
        return right.probability - left.probability;
      }
      return right.leaveCount - left.leaveCount;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const trend = Array.from(trendBuckets.values()).map((item) => ({
    key: item.key,
    label: item.label,
    leavePeriods: item.leavePeriods,
    impactedStudents: item.studentIds.size
  }));

  const hottestWeekday = [...weekdayDistribution]
    .sort((left, right) => right.leavePersonDays - left.leavePersonDays || right.totalPeriods - left.totalPeriods)[0] || null;
  const hottestCourseSlot = [...courseProbabilityBySlot]
    .sort((left, right) => {
      if (right.leaveCount !== left.leaveCount) {
        return right.leaveCount - left.leaveCount;
      }
      return right.probability - left.probability;
    })[0] || null;

  return {
    period: range.period,
    windowLabel: range.windowLabel,
    summary: {
      totalLeavePeriods: detailRows.length,
      impactedStudents: impactedStudentIds.size,
      leaveRequestCount: requestIds.size,
      topStudent: studentRanking[0] || null,
      topDormitory: dormitoryRanking[0] || null,
      hottestWeekday,
      hottestCourseSlot
    },
    trend,
    studentRanking,
    dormitoryRanking,
    weekdayDistribution,
    leaveTypeDistribution,
    courseProbability: {
      bySlot: courseProbabilityBySlot,
      bySubject: courseProbabilityBySubject
    },
    classroomCheck,
    detailRows: detailRows.sort((left, right) => {
      if (left.leaveDate !== right.leaveDate) {
        return String(left.leaveDate).localeCompare(String(right.leaveDate));
      }
      if (left.period !== right.period) {
        return Number(left.period || 0) - Number(right.period || 0);
      }
      return String(left.studentName).localeCompare(String(right.studentName), 'zh-CN');
    })
  };
}

async function loadClassStudentsWithDormitory(classId, options = {}) {
  const { includeInactive = false } = options;
  return Student.findAll({
    where: {
      class_id: classId,
      ...(includeInactive ? {} : { status: 'active' })
    },
    include: [{
      model: Dormitory,
      as: 'dormitory',
      attributes: ['id', 'name'],
      required: false
    }],
    order: [['student_number', 'ASC']]
  });
}

function buildLeaveHistoryWhere(classId, query = {}) {
  const {
    status = '',
    requestMode = '',
    studentName = '',
    studentId = '',
    sourceType = 'all',
    startDate = '',
    endDate = '',
    reviewedStartDate = '',
    reviewedEndDate = ''
  } = query;

  const where = {
    class_id: classId,
    source_type: { [Op.ne]: 'restore_preview' }
  };

  if (status) {
    const statuses = String(status)
      .split(',')
      .map((item) => item.trim())
      .filter((item) => ['pending', 'approved', 'rejected', 'recorded'].includes(item));

    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = { [Op.in]: statuses };
    }
  }

  if (requestMode) {
    const requestModes = String(requestMode)
      .split(',')
      .map((item) => item.trim())
      .filter((item) => ['today', 'custom', 'weekend'].includes(item));

    if (requestModes.length === 1) {
      where.request_mode = requestModes[0];
    } else if (requestModes.length > 1) {
      where.request_mode = { [Op.in]: requestModes };
    }
  }

  if (studentName) {
    where.student_name_snapshot = { [Op.like]: `%${studentName}%` };
  }

  if (studentId) {
    where.student_id = Number(studentId);
  }

  if (sourceType && sourceType !== 'all') {
    where.source_type = sourceType;
  }

  if (startDate || endDate) {
    where.submitted_at = {};
    if (startDate) {
      where.submitted_at[Op.gte] = new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      where.submitted_at[Op.lte] = new Date(`${endDate}T23:59:59`);
    }
  }

  if (reviewedStartDate || reviewedEndDate) {
    where.reviewed_at = {};
    if (reviewedStartDate) {
      where.reviewed_at[Op.gte] = new Date(`${reviewedStartDate}T00:00:00`);
    }
    if (reviewedEndDate) {
      where.reviewed_at[Op.lte] = new Date(`${reviewedEndDate}T23:59:59`);
    }
  }

  return where;
}

function buildTruancyRecordRows(submissions, classStudents, query = {}) {
  const {
    studentId = '',
    studentName = '',
    checkerName = ''
  } = query;

  const normalizedStudentName = normalizeText(studentName);
  const studentDirectory = new Map(classStudents.map((student) => [String(student.id), {
    studentId: student.id,
    studentName: student.student_name,
    studentNumber: student.student_number || '',
    dormitoryName: student.dormitory?.name || '未分配宿舍'
  }]));

  return submissions.flatMap((submissionRecord) => {
    const submission = serializeClassroomCheckSubmission(submissionRecord);

    if (checkerName && !String(submission.submittedByName || '').includes(String(checkerName).trim())) {
      return [];
    }

    const questionStudentKeys = new Set((submission.questionStudents || []).map((item) => (
      buildStudentMatchKey(item.studentId || null, item.studentName || '')
    )));

    return (submission.truancyStudents || [])
      .filter((studentSnapshot) => {
        if (studentId && Number(studentSnapshot.studentId || 0) !== Number(studentId)) {
          return false;
        }

        if (normalizedStudentName && !normalizeText(studentSnapshot.studentName).includes(normalizedStudentName)) {
          return false;
        }

        return true;
      })
      .map((studentSnapshot) => {
        const studentMeta = studentDirectory.get(String(studentSnapshot.studentId || '')) || {
          studentId: studentSnapshot.studentId || null,
          studentName: studentSnapshot.studentName || '',
          studentNumber: studentSnapshot.studentNumber || '',
          dormitoryName: '未分配宿舍'
        };

        const studentKey = buildStudentMatchKey(studentSnapshot.studentId || null, studentSnapshot.studentName || '');
        const isQuestion = questionStudentKeys.has(studentKey);

        return {
          id: `truancy:${submission.id}:${studentSnapshot.studentId || normalizeText(studentSnapshot.studentName)}`,
          recordType: 'truancy',
          submissionId: submission.id,
          occurredAt: submission.submittedAt,
          studentId: studentMeta.studentId,
          studentName: studentMeta.studentName,
          studentNumber: studentMeta.studentNumber,
          dormitoryName: studentMeta.dormitoryName,
          submittedByName: submission.submittedByName,
          submittedAt: submission.submittedAt,
          checkDate: submission.checkDate,
          slotKind: submission.slotKind,
          slotLabel: submission.slotLabel,
          subject: submission.subject || '',
          period: submission.period || null,
          isQuestion,
          selectedStudents: submission.selectedStudents || [],
          truancyStudents: submission.truancyStudents || [],
          questionStudents: submission.questionStudents || [],
          teacherCopyText: submission.teacherCopyText || ''
        };
      });
  });
}

async function buildStudentOverview(classId, studentId, period = 'week') {
  const range = getPeriodRange(period, new Date());
  const classStudents = await loadClassStudentsWithDormitory(classId, { includeInactive: true });
  const student = classStudents.find((item) => Number(item.id) === Number(studentId));

  if (!student) {
    return null;
  }

  const trendBuckets = buildTrendBuckets(range);
  const [leaves, submissions] = await Promise.all([
    loadOverviewLeavesForRange(classId, range),
    loadOverviewClassroomChecksForRange(classId, range)
  ]);

  const leaveRequestIds = new Set();
  const leaveDays = new Set();
  let leavePeriods = 0;
  let truancyCount = 0;
  let questionCount = 0;

  leaves.forEach((leave) => {
    if (!leave.student || Number(leave.student.id) !== Number(student.id)) {
      return;
    }

    const records = leave.records || [];
    if (!records.length) {
      return;
    }

    leaveRequestIds.add(leave.id);
    leavePeriods += records.length;

    records.forEach((record) => {
      if (record.leave_date) {
        leaveDays.add(record.leave_date);
      }
      const bucket = trendBuckets.get(getTrendBucketKey(range, record.leave_date));
      if (bucket) {
        bucket.leavePeriods += 1;
      }
    });
  });

  submissions.forEach((submissionRecord) => {
    const submission = serializeClassroomCheckSubmission(submissionRecord);
    const checkDate = submission.checkDate || formatDateKey(new Date(submission.submittedAt));
    const bucket = trendBuckets.get(getTrendBucketKey(range, checkDate));

    (submission.truancyStudents || []).forEach((snapshot) => {
      if (!isSameStudent(student.id, student.student_name, snapshot)) {
        return;
      }

      truancyCount += 1;
      if (bucket) {
        bucket.truancyCount = (bucket.truancyCount || 0) + 1;
      }
    });

    (submission.questionStudents || []).forEach((snapshot) => {
      if (!isSameStudent(student.id, student.student_name, snapshot)) {
        return;
      }

      questionCount += 1;
      if (bucket) {
        bucket.questionCount = (bucket.questionCount || 0) + 1;
      }
    });
  });

  return {
    period: range.period,
    windowLabel: range.windowLabel,
    student: {
      id: student.id,
      studentName: student.student_name,
      studentNumber: student.student_number || '',
      dormitoryName: student.dormitory?.name || '未分配宿舍',
      status: student.status || 'active',
      isReadonly: student.status === 'inactive',
      readonlyReason: student.status === 'inactive'
        ? '该学生已停用，当前仅提供历史只读视图。'
        : ''
    },
    summary: {
      leaveRequestCount: leaveRequestIds.size,
      leaveDays: leaveDays.size,
      leavePeriods,
      truancyCount,
      questionCount
    },
    trend: Array.from(trendBuckets.values()).map((item) => ({
      key: item.key,
      label: item.label,
      leavePeriods: item.leavePeriods || 0,
      truancyCount: item.truancyCount || 0,
      questionCount: item.questionCount || 0
    }))
  };
}

async function buildUnifiedRecords(classId, query = {}) {
  const {
    recordType = 'all',
    page = 1,
    limit = 20,
    startDate = '',
    endDate = ''
  } = query;

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 5000);
  const includeLeave = recordType === 'all' || recordType === 'leave';
  const includeTruancy = recordType === 'all' || recordType === 'truancy';

  const [classStudents, leaveArchives, classroomChecks] = await Promise.all([
    loadClassStudentsWithDormitory(classId),
    includeLeave
      ? LeaveHistoryArchive.findAll({
        where: buildLeaveHistoryWhere(classId, query),
        include: [createStatisticsStudentInclude()],
        order: [['submitted_at', 'DESC'], ['reviewed_at', 'DESC'], ['id', 'DESC']]
      })
      : Promise.resolve([]),
    includeTruancy
      ? ClassroomCheckSubmission.findAll({
        where: {
          class_id: classId,
          ...(startDate || endDate ? {
            check_date: {
              ...(startDate ? { [Op.gte]: startDate } : {}),
              ...(endDate ? { [Op.lte]: endDate } : {})
            }
          } : {})
        },
        order: [['submitted_at', 'DESC'], ['id', 'DESC']]
      })
      : Promise.resolve([])
  ]);

  const leaveRows = includeLeave
    ? leaveArchives.map((archive) => {
      const record = buildTeacherHistoryItemFromArchive(archive);
      const source = toPlainValue(archive) || {};
      return {
        id: `leave:${record.id}`,
        recordType: 'leave',
        occurredAt: record.submittedAt || record.startTime,
        dormitoryName: source.student?.dormitory?.name || '未分配宿舍',
        ...record
      };
    })
    : [];

  const truancyRows = includeTruancy
    ? buildTruancyRecordRows(classroomChecks, classStudents, query)
    : [];

  const rows = [...leaveRows, ...truancyRows]
    .sort((left, right) => {
      const rightTime = new Date(right.occurredAt || right.submittedAt || 0).getTime();
      const leftTime = new Date(left.occurredAt || left.submittedAt || 0).getTime();
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return String(left.studentName || '').localeCompare(String(right.studentName || ''), 'zh-CN');
    });

  const offset = (pageNumber - 1) * pageSize;

  return {
    total: rows.length,
    page: pageNumber,
    limit: pageSize,
    data: rows.slice(offset, offset + pageSize)
  };
}

function buildLegacyStudentStats(detailRows) {
  return detailRows.reduce((accumulator, row) => {
    if (!accumulator[row.studentName]) {
      accumulator[row.studentName] = { total: 0, subjects: {} };
    }

    accumulator[row.studentName].total += 1;
    accumulator[row.studentName].subjects[row.subject] = (accumulator[row.studentName].subjects[row.subject] || 0) + 1;
    return accumulator;
  }, {});
}

router.get('/classroom-checks', async (req, res) => {
  try {
    const {
      checkerName = '',
      startDate = '',
      endDate = '',
      page = 1,
      limit = 20
    } = req.query;

    const where = {
      class_id: req.user.classId
    };

    if (checkerName) {
      where.submitted_by_name_snapshot = {
        [Op.like]: `%${String(checkerName).trim()}%`
      };
    }

    if (startDate || endDate) {
      where.check_date = {};
      if (startDate) {
        where.check_date[Op.gte] = startDate;
      }
      if (endDate) {
        where.check_date[Op.lte] = endDate;
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offset = (pageNumber - 1) * pageSize;

    const { count, rows } = await ClassroomCheckSubmission.findAndCountAll({
      where,
      order: [['submitted_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({
      total: count,
      page: pageNumber,
      limit: pageSize,
      data: rows.map(serializeClassroomCheckSubmission)
    });
  } catch (error) {
    console.error('获取教室核对历史失败:', error);
    res.status(500).json({ error: '获取教室核对历史失败' });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const period = ['week', 'month', 'semester'].includes(req.query.period) ? req.query.period : 'week';
    const overview = await buildOverviewData(req.user.classId, period);
    res.json(overview);
  } catch (error) {
    console.error('获取总览统计失败:', error);
    res.status(500).json({ error: '获取总览统计失败' });
  }
});

router.get('/student-overview', async (req, res) => {
  try {
    const period = ['week', 'month', 'semester'].includes(req.query.period) ? req.query.period : 'week';
    const studentId = Number(req.query.studentId);

    if (!studentId) {
      return res.status(400).json({ error: 'studentId 必填' });
    }

    const overview = await buildStudentOverview(req.user.classId, studentId, period);
    if (!overview) {
      return res.status(404).json({ error: '学生不存在' });
    }

    res.json(overview);
  } catch (error) {
    console.error('获取学生统计失败:', error);
    res.status(500).json({ error: '获取学生统计失败' });
  }
});

router.get('/records', async (req, res) => {
  try {
    const records = await buildUnifiedRecords(req.user.classId, req.query);
    res.json(records);
  } catch (error) {
    console.error('获取综合记录失败:', error);
    res.status(500).json({ error: '获取综合记录失败' });
  }
});

router.get('/week', async (req, res) => {
  try {
    const overview = await buildOverviewData(req.user.classId, 'week');
    res.json(buildLegacyStudentStats(overview.detailRows));
  } catch (error) {
    console.error('获取周统计失败:', error);
    res.status(500).json({ error: '获取周统计失败' });
  }
});

router.get('/month', async (req, res) => {
  try {
    const overview = await buildOverviewData(req.user.classId, 'month');
    const dailyStats = overview.detailRows.reduce((accumulator, row) => {
      accumulator[row.leaveDate] = (accumulator[row.leaveDate] || 0) + 1;
      return accumulator;
    }, {});
    res.json({
      studentStats: buildLegacyStudentStats(overview.detailRows),
      dailyStats
    });
  } catch (error) {
    console.error('获取月统计失败:', error);
    res.status(500).json({ error: '获取月统计失败' });
  }
});

router.get('/semester', async (req, res) => {
  try {
    const overview = await buildOverviewData(req.user.classId, 'semester');
    const subjectStats = overview.detailRows.reduce((accumulator, row) => {
      accumulator[row.subject] = (accumulator[row.subject] || 0) + 1;
      return accumulator;
    }, {});
    res.json({
      studentStats: buildLegacyStudentStats(overview.detailRows),
      subjectStats
    });
  } catch (error) {
    console.error('获取学期统计失败:', error);
    res.status(500).json({ error: '获取学期统计失败' });
  }
});

router.get('/export-integrated', async (req, res) => {
  try {
    const period = ['week', 'month', 'semester'].includes(req.query.period) ? req.query.period : 'month';
    const studentId = Number(req.query.studentId || 0);
    const studentPeriod = ['week', 'month', 'semester'].includes(req.query.studentPeriod) ? req.query.studentPeriod : period;
    const range = getPeriodRange(period, new Date());
    const overview = await buildOverviewData(req.user.classId, period);
    const unifiedRecords = await buildUnifiedRecords(req.user.classId, {
      recordType: 'all',
      page: 1,
      limit: 5000,
      startDate: formatDateKey(range.startDateTime),
      endDate: formatDateKey(range.endDateTime),
      studentId: studentId || undefined
    });
    const workbook = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([
      { Category: 'Window', Metric: 'Period', Value: overview.windowLabel },
      { Category: 'Leave', Metric: 'Requests', Value: overview.summary.leaveRequestCount || 0 },
      { Category: 'Leave', Metric: 'Periods', Value: overview.summary.totalLeavePeriods || 0 },
      { Category: 'Leave', Metric: 'Students', Value: overview.summary.impactedStudents || 0 },
      { Category: 'Truancy', Metric: 'Count', Value: overview.classroomCheck?.summary?.totalTruancyCount || 0 },
      { Category: 'Truancy', Metric: 'Questions', Value: overview.classroomCheck?.summary?.totalQuestionCount || 0 },
      { Category: 'Truancy', Metric: 'Students', Value: overview.classroomCheck?.summary?.impactedStudents || 0 }
    ]), 'Overview');

    const truancySlotMap = new Map((overview.classroomCheck?.slotRanking || []).map((item) => [item.slotKey, item]));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet((overview.courseProbability?.bySlot || []).map((item) => {
      const truancyItem = truancySlotMap.get(item.slotKey);
      return {
        Course: item.subject || item.label,
        TimeSummary: item.timeSummary || '',
        LeavePersonTimes: item.leaveCount,
        LeaveProbability: item.probability,
        TruancyPersonTimes: truancyItem?.truancyCount || 0,
        TruancySubmissions: truancyItem?.submissionCount || 0
      };
    })), 'CourseRisk');

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet((unifiedRecords.data || []).map((item) => (
      item.recordType === 'leave'
        ? {
          RecordType: 'leave',
          StudentName: item.studentName,
          StudentNumber: item.studentNumber,
          Dormitory: item.dormitoryName || '',
          DateTime: formatLeaveDateTime(item.submittedAt),
          SubType: LEAVE_TYPE_LABELS[item.leaveType] || item.leaveType || '',
          Status: item.status || '',
          Summary: item.reason || ''
        }
        : {
          RecordType: 'truancy',
          StudentName: item.studentName,
          StudentNumber: item.studentNumber,
          Dormitory: item.dormitoryName || '',
          DateTime: formatLeaveDateTime(item.submittedAt),
          SubType: item.isQuestion ? 'question' : 'truancy',
          Status: item.slotLabel || '',
          Summary: item.submittedByName || ''
        }
    ))), 'Records');

    if (studentId) {
      const studentOverview = await buildStudentOverview(req.user.classId, studentId, studentPeriod);
      if (studentOverview) {
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([
          { Section: 'Student', Metric: 'Name', Value: studentOverview.student.studentName },
          { Section: 'Student', Metric: 'StudentNumber', Value: studentOverview.student.studentNumber || '' },
          { Section: 'Student', Metric: 'Dormitory', Value: studentOverview.student.dormitoryName || '' },
          { Section: 'Summary', Metric: 'Window', Value: studentOverview.windowLabel },
          { Section: 'Summary', Metric: 'LeaveRequests', Value: studentOverview.summary.leaveRequestCount || 0 },
          { Section: 'Summary', Metric: 'LeaveDays', Value: studentOverview.summary.leaveDays || 0 },
          { Section: 'Summary', Metric: 'LeavePeriods', Value: studentOverview.summary.leavePeriods || 0 },
          { Section: 'Summary', Metric: 'TruancyCount', Value: studentOverview.summary.truancyCount || 0 },
          { Section: 'Summary', Metric: 'QuestionCount', Value: studentOverview.summary.questionCount || 0 }
        ]), 'Student');
      }
    }

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=integrated-statistics-${period}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('导出综合统计失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const period = ['week', 'month', 'semester'].includes(req.query.period) ? req.query.period : 'month';
    const range = getPeriodRange(period, new Date());
    const startKey = formatDateKey(range.startDateTime);
    const endKey = formatDateKey(range.endDateTime);
    const leaves = await loadOverviewLeavesForRange(req.user.classId, range);

    const data = leaves
      .map((leave) => {
        const records = (leave.records || []).filter((record) => isDateKeyInRange(record.leave_date, startKey, endKey));
        if (!records.length || !leave.student) {
          return null;
        }

        return {
          学生姓名: leave.student.student_name,
          请假类型: LEAVE_TYPE_LABELS[leave.leave_type] || '其他',
          请假时间: `${formatLeaveDateTime(leave.start_time)} 至 ${formatLeaveDateTime(leave.end_time)}`,
          命中课程数: records.length,
          请假原因: leave.reason || '',
          提交时间: formatLeaveDateTime(leave.submitted_at),
          审批时间: formatLeaveDateTime(leave.reviewed_at)
        };
      })
      .filter(Boolean);

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '请假统计');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=leave-statistics-${period}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('导出统计失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;



