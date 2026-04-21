const { Op } = require('sequelize');
const { LeaveRequest, LeaveRecord } = require('../models');
const {
  combineDateAndTime,
  formatDateKey,
  getDayContext,
  normalizePeriods
} = require('./scheduleContext');

const NAME_SEPARATOR = '\u3001';
const WEEKDAY_SUFFIX = ['\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d', '\u65e5'];
const CLASSROOM_CHECK_BUFFER_MINUTES = 10;

function parseSnapshotArray(value) {
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

function sortStudentSnapshots(items = []) {
  return [...items].sort((left, right) => {
    const leftNumber = String(left.studentNumber || left.student_number || '');
    const rightNumber = String(right.studentNumber || right.student_number || '');
    const numberCompare = leftNumber.localeCompare(rightNumber, 'zh-CN', { numeric: true });
    if (numberCompare !== 0) {
      return numberCompare;
    }

    return String(left.studentName || left.student_name || '').localeCompare(
      String(right.studentName || right.student_name || ''),
      'zh-CN'
    );
  });
}

function createStudentSnapshot(student) {
  return {
    studentId: student.id,
    studentName: student.student_name || '',
    studentNumber: student.student_number || ''
  };
}

function buildNameText(items = []) {
  return items.length
    ? items.map((item) => item.studentName || item.student_name || '').filter(Boolean).join(NAME_SEPARATOR)
    : '\u65e0';
}

function buildStudentCopyText({ selectedStudents = [], truancyStudents = [] }) {
  return [
    `\u672a\u5230\uff1a${buildNameText(selectedStudents)}`,
    `\u65f7\u8bfe\uff1a${buildNameText(truancyStudents)}`
  ].join('\n');
}

function buildTeacherCopyText(record) {
  const lines = [
    '\u6559\u5ba4\u5b66\u751f\u6838\u5bf9',
    `\u63d0\u4ea4\u65f6\u95f4\uff1a${new Date(record.submittedAt).toLocaleString('zh-CN')}`,
    `\u63d0\u4ea4\u4eba\uff1a${record.submittedByName}`,
    `\u672a\u5230\uff1a${buildNameText(record.selectedStudents)}`,
    `\u65f7\u8bfe\uff1a${buildNameText(record.truancyStudents)}`
  ];

  if ((record.questionStudents || []).length) {
    lines.push(`\u7591\u95ee\uff1a${buildNameText(record.questionStudents)}`);
  }

  if (record.slotLabel) {
    lines.splice(3, 0, `\u65f6\u6bb5\uff1a${record.slotLabel}`);
  }

  return lines.join('\n');
}

function buildCourseCandidate(schedule, period, dateKey) {
  const startDateTime = combineDateAndTime(dateKey, period.startTime);
  const endDateTime = combineDateAndTime(dateKey, period.endTime, true);
  const windowStartDateTime = new Date(startDateTime.getTime() - (CLASSROOM_CHECK_BUFFER_MINUTES * 60 * 1000));
  const windowEndDateTime = new Date(endDateTime.getTime() + (CLASSROOM_CHECK_BUFFER_MINUTES * 60 * 1000));

  return {
    slotKind: 'active_course',
    weekday: schedule.weekday,
    period: schedule.period,
    subject: schedule.subject,
    startTime: period.startTime,
    endTime: period.endTime,
    slotLabel: `星期${WEEKDAY_SUFFIX[schedule.weekday - 1] || ''} 第${schedule.period}节 ${schedule.subject} ${period.startTime}-${period.endTime}`,
    selectionKey: String(schedule.period),
    startDateTime,
    endDateTime,
    windowStartDateTime,
    windowEndDateTime
  };
}

function serializeCourseCandidate(candidate, existingSubmission = null) {
  return {
    slotKind: candidate.slotKind,
    weekday: candidate.weekday,
    period: candidate.period,
    subject: candidate.subject,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    slotLabel: candidate.slotLabel,
    selectionKey: candidate.selectionKey,
    windowStart: candidate.windowStartDateTime.toISOString(),
    windowEnd: candidate.windowEndDateTime.toISOString(),
    hasSubmission: Boolean(existingSubmission),
    existingSubmission: existingSubmission || null
  };
}

function buildFreeTimeSlotSnapshot(now) {
  return {
    slotKind: 'free_time',
    weekday: null,
    period: null,
    subject: '',
    startTime: '',
    endTime: '',
    slotLabel: `非课节时段 ${new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  };
}

function getCourseCandidatesForNow({ now, periods, schedules, specialDates }) {
  const dayContext = getDayContext(now, specialDates);
  if (!dayContext.isWorkday || !dayContext.effectiveWeekday) {
    return [];
  }

  const dateKey = formatDateKey(now);
  const periodMap = new Map(normalizePeriods(periods).map((item) => [item.period, item]));

  return schedules
    .filter((item) => item.weekday === dayContext.effectiveWeekday && item.subject)
    .sort((left, right) => left.period - right.period)
    .map((schedule) => {
      const period = periodMap.get(schedule.period);
      if (!period) {
        return null;
      }

      return buildCourseCandidate(schedule, period, dateKey);
    })
    .filter(Boolean);
}

function resolveClassroomCheckWindow({
  now,
  periods,
  schedules,
  specialDates,
  selectedCoursePeriod
}) {
  const allCandidates = getCourseCandidatesForNow({ now, periods, schedules, specialDates });
  if (!allCandidates.length) {
    return {
      mode: 'out_of_window',
      selectedSlot: null,
      candidates: [],
      message: '今天没有可核对的上课时段'
    };
  }

  const activeCandidates = allCandidates.filter((candidate) => (
    now >= candidate.windowStartDateTime && now <= candidate.windowEndDateTime
  ));

  if (!activeCandidates.length) {
    return {
      mode: 'out_of_window',
      selectedSlot: null,
      candidates: [],
      message: '当前不在可提交时间窗内，请在上课前10分钟到下课后10分钟内提交'
    };
  }

  const normalizedPeriod = selectedCoursePeriod === undefined || selectedCoursePeriod === null || selectedCoursePeriod === ''
    ? null
    : Number(selectedCoursePeriod);

  if (normalizedPeriod !== null && !Number.isInteger(normalizedPeriod)) {
    return {
      mode: 'invalid_selection',
      selectedSlot: null,
      candidates: activeCandidates,
      message: '所选课程无效，请重新选择'
    };
  }

  if (normalizedPeriod !== null) {
    const matchedCandidate = activeCandidates.find((candidate) => candidate.period === normalizedPeriod);
    if (!matchedCandidate) {
      return {
        mode: 'invalid_selection',
        selectedSlot: null,
        candidates: activeCandidates,
        message: '所选课程已不在当前可提交时间窗内，请重新选择'
      };
    }

    return {
      mode: 'single_course',
      selectedSlot: matchedCandidate,
      candidates: activeCandidates,
      message: ''
    };
  }

  if (activeCandidates.length > 1) {
    return {
      mode: 'ambiguous',
      selectedSlot: null,
      candidates: activeCandidates,
      message: '当前时间接近多门课程，请先明确选择本次要核对的课程'
    };
  }

  return {
    mode: 'single_course',
    selectedSlot: activeCandidates[0],
    candidates: activeCandidates,
    message: ''
  };
}

async function getLeaveMatchSets({ classId, studentIds, checkDate, period }) {
  if (!studentIds.length) {
    return {
      approvedIds: new Set(),
      pendingIds: new Set()
    };
  }

  const leaveRecords = await LeaveRecord.findAll({
    where: {
      leave_date: checkDate,
      period: period
    },
    include: [{
      model: LeaveRequest,
      as: 'leaveRequest',
      attributes: ['student_id', 'status'],
      where: {
        class_id: classId,
        student_id: { [Op.in]: studentIds },
        request_mode: { [Op.in]: ['today', 'custom'] },
        status: { [Op.in]: ['approved', 'pending'] }
      }
    }]
  });

  const approvedIds = new Set();
  const pendingIds = new Set();

  leaveRecords.forEach((leaveRecord) => {
    const leaveRequest = leaveRecord.leaveRequest;
    if (!leaveRequest) {
      return;
    }

    const studentId = Number(leaveRequest.student_id);
    if (leaveRequest.status === 'approved') {
      approvedIds.add(studentId);
      pendingIds.delete(studentId);
      return;
    }

    if (!approvedIds.has(studentId)) {
      pendingIds.add(studentId);
    }
  });

  return { approvedIds, pendingIds };
}

function buildSubmissionLists({ studentsById, absentStudentIds, approvedIds, pendingIds }) {
  const selectedStudents = [];
  const truancyStudents = [];
  const questionStudents = [];

  absentStudentIds.forEach((studentId) => {
    const student = studentsById.get(studentId);
    if (!student) {
      return;
    }

    const snapshot = createStudentSnapshot(student);
    selectedStudents.push(snapshot);

    if (approvedIds.has(studentId)) {
      return;
    }

    truancyStudents.push(snapshot);
    if (pendingIds.has(studentId)) {
      questionStudents.push(snapshot);
    }
  });

  return {
    selectedStudents: sortStudentSnapshots(selectedStudents),
    truancyStudents: sortStudentSnapshots(truancyStudents),
    questionStudents: sortStudentSnapshots(questionStudents)
  };
}

function serializeClassroomCheckSubmission(record) {
  const source = typeof record?.toJSON === 'function' ? record.toJSON() : (record || {});
  const selectedStudents = sortStudentSnapshots(parseSnapshotArray(source.selected_students_json));
  const truancyStudents = sortStudentSnapshots(parseSnapshotArray(source.truancy_students_json));
  const questionStudents = sortStudentSnapshots(parseSnapshotArray(source.question_students_json));

  const serialized = {
    id: source.id,
    classId: source.class_id,
    submittedByStudentId: source.submitted_by_student_id || null,
    submittedByName: source.submitted_by_name_snapshot || '',
    checkDate: source.check_date,
    slotKind: source.slot_kind || 'free_time',
    weekday: source.weekday_snapshot || null,
    period: source.period_snapshot || null,
    subject: source.subject_snapshot || '',
    startTime: source.start_time_snapshot || '',
    endTime: source.end_time_snapshot || '',
    slotLabel: source.slot_label_snapshot || '',
    submittedAt: source.submitted_at,
    selectedStudents,
    truancyStudents,
    questionStudents,
    studentCopyText: buildStudentCopyText({ selectedStudents, truancyStudents })
  };

  serialized.teacherCopyText = buildTeacherCopyText(serialized);
  return serialized;
}

module.exports = {
  CLASSROOM_CHECK_BUFFER_MINUTES,
  buildFreeTimeSlotSnapshot,
  buildStudentCopyText,
  buildSubmissionLists,
  buildTeacherCopyText,
  createStudentSnapshot,
  getLeaveMatchSets,
  parseSnapshotArray,
  resolveClassroomCheckWindow,
  serializeClassroomCheckSubmission,
  serializeCourseCandidate,
  sortStudentSnapshots
};
