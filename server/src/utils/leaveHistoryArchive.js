const {
  LeaveHistoryArchive,
  LeaveRequest,
  LeaveRecord,
  AuditLog,
  Student,
  Teacher,
  Class
} = require('../models');

const AUDIT_FALLBACK_NOTICE = '该记录原始请假单已不在 leave_requests 表中，当前内容由审批日志回补生成。';

function toPlainValue(record) {
  return typeof record?.toJSON === 'function' ? record.toJSON() : record;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSnapshotRecord(record) {
  const source = toPlainValue(record);
  if (!source) {
    return null;
  }

  const leaveDate = source.leave_date || source.leaveDate || null;
  const startTime = source.start_time_snapshot
    ? String(source.start_time_snapshot).slice(0, 5)
    : (source.startTime || null);
  const endTime = source.end_time_snapshot
    ? String(source.end_time_snapshot).slice(0, 5)
    : (source.endTime || null);

  return {
    leaveDate,
    leave_date: leaveDate,
    weekday: source.weekday_snapshot ?? source.weekday ?? null,
    period: source.period_snapshot ?? source.period ?? null,
    subject: normalizeText(source.subject_snapshot || source.subject),
    startTime,
    endTime
  };
}

function toSnapshotRecord(record) {
  return normalizeSnapshotRecord(record);
}

function parseSnapshotRecords(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshotRecord(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => normalizeSnapshotRecord(item)).filter(Boolean)
        : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function buildArchivePayloadFromLeave(leave) {
  const source = toPlainValue(leave) || {};
  const records = Array.isArray(source.records)
    ? source.records.map(toSnapshotRecord).filter(Boolean)
    : [];

  return {
    class_id: source.class_id,
    student_id: source.student_id || source.student?.id || null,
    student_name_snapshot: normalizeText(source.student_name_snapshot || source.student?.student_name),
    student_number_snapshot: normalizeText(source.student_number_snapshot || source.student?.student_number),
    class_name_snapshot: normalizeText(source.class_name_snapshot || source.class?.class_name),
    leave_type: source.leave_type,
    request_mode: source.request_mode,
    status: source.status,
    reviewer_name_snapshot: normalizeText(source.reviewer_name_snapshot || source.reviewer?.real_name),
    teacher_comment_snapshot: normalizeText(source.teacher_comment),
    current_location: source.current_location || null,
    go_home: Boolean(source.go_home),
    reason: source.reason || null,
    start_time: source.start_time || null,
    end_time: source.end_time || null,
    submitted_at: source.submitted_at || source.created_at || null,
    reviewed_at: source.reviewed_at || null,
    records_snapshot: records,
    source_type: 'request',
    history_notice: null,
    original_leave_request_id: source.id,
    original_audit_log_id: null
  };
}

function buildArchivePayloadFromAuditLog(log, studentMap = new Map(), teacherMap = new Map()) {
  const source = toPlainValue(log) || {};
  const details = source.details || {};
  const studentId = Number(details.studentId) || null;
  const student = studentId ? studentMap.get(studentId) : null;
  const reviewer = teacherMap.get(Number(source.user_id)) || null;

  return {
    class_id: student?.class_id || details.classId || reviewer?.class_id || null,
    student_id: studentId,
    student_name_snapshot: normalizeText(details.studentName || student?.student_name),
    student_number_snapshot: normalizeText(details.studentNumber || student?.student_number),
    class_name_snapshot: normalizeText(details.className || student?.class?.class_name),
    leave_type: details.leaveType || 'other',
    request_mode: details.requestMode || 'custom',
    status: details.status || 'approved',
    reviewer_name_snapshot: normalizeText(details.reviewerName || reviewer?.real_name),
    teacher_comment_snapshot: normalizeText(details.comment || details.teacherComment),
    current_location: details.currentLocation || null,
    go_home: Boolean(details.goHome),
    reason: details.reason || null,
    start_time: details.startTime || null,
    end_time: details.endTime || null,
    submitted_at: details.submittedAt || null,
    reviewed_at: details.reviewedAt || source.created_at || null,
    records_snapshot: parseSnapshotRecords(details.records),
    source_type: 'audit_fallback',
    history_notice: AUDIT_FALLBACK_NOTICE,
    original_leave_request_id: Number(source.target_id) || null,
    original_audit_log_id: source.id
  };
}

function buildTeacherHistoryItemFromArchive(archive) {
  const source = toPlainValue(archive) || {};
  const records = parseSnapshotRecords(source.records_snapshot);

  return {
    id: source.id,
    requestId: source.original_leave_request_id,
    sourceType: source.source_type,
    sourceAuditLogId: source.original_audit_log_id,
    historyNotice: source.history_notice || '',
    studentId: source.student_id,
    studentName: normalizeText(source.student_name_snapshot),
    studentNumber: normalizeText(source.student_number_snapshot),
    className: normalizeText(source.class_name_snapshot),
    requestMode: normalizeText(source.request_mode),
    leaveType: normalizeText(source.leave_type),
    status: normalizeText(source.status),
    reviewerName: normalizeText(source.reviewer_name_snapshot),
    submittedAt: source.submitted_at || null,
    reviewedAt: source.reviewed_at || null,
    startTime: source.start_time || null,
    endTime: source.end_time || null,
    currentLocation: source.current_location || null,
    goHome: Boolean(source.go_home),
    reason: source.reason || '',
    teacherComment: source.teacher_comment_snapshot || '',
    records
  };
}

function buildStudentLeaveItemFromArchive(archive) {
  const source = toPlainValue(archive) || {};

  return {
    id: source.id,
    leave_type: source.leave_type,
    request_mode: source.request_mode,
    start_time: source.start_time,
    end_time: source.end_time,
    reason: source.reason,
    status: source.status,
    current_location: source.current_location,
    go_home: Boolean(source.go_home),
    teacher_comment: source.teacher_comment_snapshot || '',
    submitted_at: source.submitted_at,
    reviewed_at: source.reviewed_at,
    source_type: source.source_type,
    history_notice: source.history_notice || '',
    records: parseSnapshotRecords(source.records_snapshot)
  };
}

async function loadLeaveRequestForArchive(leaveRequestId, transaction) {
  return LeaveRequest.findByPk(leaveRequestId, {
    include: [
      { model: Student, as: 'student', attributes: ['id', 'student_name', 'student_number'], required: false },
      { model: Teacher, as: 'reviewer', attributes: ['id', 'real_name'], required: false },
      { model: Class, as: 'class', attributes: ['id', 'class_name'], required: false },
      { model: LeaveRecord, as: 'records' }
    ],
    transaction
  });
}

async function upsertArchiveFromLeaveRequestId(leaveRequestId, transaction) {
  const leave = await loadLeaveRequestForArchive(leaveRequestId, transaction);
  if (!leave) {
    return null;
  }

  const payload = buildArchivePayloadFromLeave(leave);
  const existing = await LeaveHistoryArchive.findOne({
    where: { original_leave_request_id: leave.id },
    transaction
  });

  if (existing) {
    await existing.update(payload, { transaction });
    return existing;
  }

  return LeaveHistoryArchive.create(payload, { transaction });
}

async function rebuildAllLeaveHistoryArchives(transaction) {
  await LeaveHistoryArchive.destroy({ where: {}, force: true, transaction });

  const [leaveRequests, students, teachers] = await Promise.all([
    LeaveRequest.findAll({
      include: [
        { model: Student, as: 'student', attributes: ['id', 'student_name', 'student_number', 'class_id'], required: false },
        { model: Teacher, as: 'reviewer', attributes: ['id', 'real_name', 'class_id'], required: false },
        { model: Class, as: 'class', attributes: ['id', 'class_name'], required: false },
        { model: LeaveRecord, as: 'records' }
      ],
      order: [['submitted_at', 'DESC']],
      transaction
    }),
    Student.findAll({
      include: [{ model: Class, as: 'class', attributes: ['id', 'class_name'], required: false }],
      transaction
    }),
    Teacher.findAll({ transaction })
  ]);

  if (leaveRequests.length > 0) {
    await LeaveHistoryArchive.bulkCreate(
      leaveRequests.map((leave) => buildArchivePayloadFromLeave(leave)),
      { transaction }
    );
  }

  const existingRequestIds = new Set(leaveRequests.map((leave) => Number(leave.id)));
  const auditLogs = await AuditLog.findAll({
    where: {
      action: 'approve_leave',
      target_type: 'leave_request'
    },
    order: [['created_at', 'DESC']],
    transaction
  });

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const fallbackPayloads = [];
  const seenRequestIds = new Set();

  for (const auditLog of auditLogs) {
    const requestId = Number(auditLog.target_id) || null;
    if (!requestId || existingRequestIds.has(requestId) || seenRequestIds.has(requestId)) {
      continue;
    }

    const payload = buildArchivePayloadFromAuditLog(auditLog, studentMap, teacherMap);
    if (!payload.class_id || !payload.student_name_snapshot) {
      continue;
    }

    fallbackPayloads.push(payload);
    seenRequestIds.add(requestId);
  }

  if (fallbackPayloads.length > 0) {
    await LeaveHistoryArchive.bulkCreate(fallbackPayloads, { transaction });
  }
}

module.exports = {
  AUDIT_FALLBACK_NOTICE,
  buildArchivePayloadFromLeave,
  buildArchivePayloadFromAuditLog,
  buildTeacherHistoryItemFromArchive,
  buildStudentLeaveItemFromArchive,
  parseSnapshotRecords,
  toSnapshotRecord,
  upsertArchiveFromLeaveRequestId,
  rebuildAllLeaveHistoryArchives
};
