const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  LeaveRequest,
  LeaveRecord,
  LeaveHistoryArchive,
  Student,
  ClassroomCheckSubmission,
  Schedule,
  SchedulePeriod,
  ClassSpecialDate,
  Class,
  StudentLoginLog
} = require('../models');
const { authMiddleware, requireStudent, requireCadre } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const {
  buildStudentLeaveItemFromArchive,
  upsertArchiveFromLeaveRequestId
} = require('../utils/leaveHistoryArchive');
const {
  buildStudentCopyText,
  buildSubmissionLists,
  createStudentSnapshot,
  getLeaveMatchSets,
  resolveClassroomCheckWindow,
  serializeClassroomCheckSubmission,
  serializeCourseCandidate,
  sortStudentSnapshots
} = require('../utils/classroomCheck');
const {
  combineDateAndTime,
  formatDateKey,
  getLocationLabel,
  getScheduleRecordsForRange,
  getTodayLeaveContext,
  getWeekendTargets,
  normalizePeriods,
  normalizeSpecialDates
} = require('../utils/scheduleContext');
const { dispatchDomainEventNow } = require('../notifications');
const { enqueueDomainEvent } = require('../notifications/outbox');
const { buildTeacherPendingLeavePayload } = require('../notifications/teacherPendingLeaveEvent');
const { TEACHER_PENDING_LEAVE_EVENT } = require('../realtime/socketServer');

const router = express.Router();

router.use(authMiddleware);

class HttpError extends Error {
  constructor(status, message, code, payload = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function isValidLeaveType(value) {
  return ['sick', 'personal', 'other'].includes(value);
}

async function loadClassScheduleBundle(classId) {
  const [periods, schedules, specialDates] = await Promise.all([
    SchedulePeriod.findAll({
      where: { class_id: classId },
      order: [['period', 'ASC']]
    }),
    Schedule.findAll({
      where: { class_id: classId },
      order: [['weekday', 'ASC'], ['period', 'ASC']]
    }),
    ClassSpecialDate.findAll({
      where: { class_id: classId },
      order: [['date', 'ASC']]
    })
  ]);

  return { periods, schedules, specialDates };
}

function buildScheduleResponse({ periods, schedules, specialDates }) {
  return {
    periods: normalizePeriods(periods).map((item) => ({
      period: item.period,
      startTime: item.startTime,
      endTime: item.endTime
    })),
    schedules: schedules.map((item) => ({
      id: item.id,
      weekday: item.weekday,
      period: item.period,
      subject: item.subject,
      teacherName: item.teacher_name || '',
      location: item.location || '教室'
    })),
    specialDates: normalizeSpecialDates(specialDates)
  };
}

async function findOverlappingLeaves(studentId, startTime, endTime, options = {}) {
  return LeaveRequest.findAll({
    where: {
      student_id: studentId,
      status: { [Op.in]: ['pending', 'approved', 'recorded'] },
      [Op.or]: [
        { start_time: { [Op.between]: [startTime, endTime] } },
        { end_time: { [Op.between]: [startTime, endTime] } },
        {
          [Op.and]: [
            { start_time: { [Op.lte]: startTime } },
            { end_time: { [Op.gte]: endTime } }
          ]
        }
      ]
    },
    transaction: options.transaction,
    lock: options.lock
  });
}

async function assertNoOverlappingLeaves(studentId, startTime, endTime, transaction) {
  await Student.findByPk(studentId, {
    attributes: ['id'],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  const overlappingLeaves = await findOverlappingLeaves(studentId, startTime, endTime, {
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (overlappingLeaves.length > 0) {
    throw new HttpError(409, '该时间段已有待审批、已批准或已报备记录，不可重复提交');
  }
}

async function buildLeaveRequestSnapshots(studentId, classId, transaction) {
  const [student, classInfo] = await Promise.all([
    Student.findByPk(studentId, {
      attributes: ['student_name', 'student_number'],
      transaction
    }),
    Class.findByPk(classId, {
      attributes: ['class_name'],
      transaction
    })
  ]);

  return {
    student_name_snapshot: student?.student_name || '',
    student_number_snapshot: student?.student_number || '',
    class_name_snapshot: classInfo?.class_name || ''
  };
}

function buildStudentClassroomCheckResponse(record) {
  const serialized = serializeClassroomCheckSubmission(record);

  return {
    id: serialized.id,
    submittedAt: serialized.submittedAt,
    submittedByName: serialized.submittedByName,
    slotKind: serialized.slotKind,
    slotLabel: serialized.slotLabel,
    period: serialized.period,
    subject: serialized.subject,
    startTime: serialized.startTime,
    endTime: serialized.endTime,
    selectedStudents: serialized.selectedStudents,
    truancyStudents: serialized.truancyStudents,
    questionStudents: serialized.questionStudents,
    copyText: serialized.studentCopyText
  };
}

function buildStudentClassroomCheckPreviewResponse(submissionLists) {
  return {
    selectedStudents: submissionLists.selectedStudents,
    truancyStudents: submissionLists.truancyStudents,
    questionStudents: submissionLists.questionStudents,
    copyText: buildStudentCopyText({
      selectedStudents: submissionLists.selectedStudents,
      truancyStudents: submissionLists.truancyStudents
    })
  };
}

async function loadActiveClassroomCheckStudents(classId) {
  return Student.findAll({
    where: { class_id: classId, status: 'active' },
    attributes: ['id', 'student_name', 'student_number'],
    order: [['student_number', 'ASC'], ['student_name', 'ASC']]
  });
}

function normalizeAbsentStudentIds(rawIds) {
  const values = Array.isArray(rawIds) ? rawIds : [];
  const hasInvalidId = values.some((item) => !Number.isInteger(Number(item)) || Number(item) <= 0);

  if (hasInvalidId) {
    return {
      error: '未到学生列表中存在无效学生 ID',
      absentStudentIds: []
    };
  }

  return {
    error: '',
    absentStudentIds: [...new Set(values.map((item) => Number(item)))]
  };
}

function buildClassroomCheckConflictPayload(resolveResult, candidateSubmissionMap = new Map()) {
  const candidates = resolveResult.candidates.map((candidate) => {
    const existingSubmission = candidateSubmissionMap.get(candidate.period) || null;
    return serializeCourseCandidate(candidate, existingSubmission);
  });

  const needsSelection = ['ambiguous', 'invalid_selection'].includes(resolveResult.mode);

  return {
    code: needsSelection
      ? 'CLASSROOM_CHECK_COURSE_SELECTION_REQUIRED'
      : 'CLASSROOM_CHECK_OUT_OF_WINDOW',
    message: resolveResult.message,
    candidates
  };
}

async function loadClassroomCheckCandidateSubmissionMap(classId, checkDate, candidates) {
  const periods = [...new Set(
    candidates
      .map((candidate) => candidate.period)
      .filter((period) => Number.isInteger(period))
  )];

  if (!periods.length) {
    return new Map();
  }

  const submissions = await ClassroomCheckSubmission.findAll({
    where: {
      class_id: classId,
      check_date: checkDate,
      slot_kind: 'active_course',
      period_snapshot: { [Op.in]: periods }
    },
    order: [['submitted_at', 'DESC'], ['id', 'DESC']]
  });

  const submissionMap = new Map();
  submissions.forEach((submission) => {
    if (!submissionMap.has(submission.period_snapshot)) {
      submissionMap.set(submission.period_snapshot, buildStudentClassroomCheckResponse(submission));
    }
  });

  return submissionMap;
}

async function resolveStudentClassroomCheckSlot(classId, bundle, now, selectedCoursePeriod) {
  const resolveResult = resolveClassroomCheckWindow({
    now,
    periods: bundle.periods,
    schedules: bundle.schedules,
    specialDates: bundle.specialDates,
    selectedCoursePeriod
  });

  const checkDate = formatDateKey(now);
  const candidateSubmissionMap = await loadClassroomCheckCandidateSubmissionMap(
    classId,
    checkDate,
    resolveResult.candidates
  );

  if (resolveResult.mode !== 'single_course') {
    const conflictPayload = buildClassroomCheckConflictPayload(resolveResult, candidateSubmissionMap);
    throw new HttpError(
      409,
      resolveResult.message,
      conflictPayload.code,
      conflictPayload
    );
  }

  const currentSlotSubmission = candidateSubmissionMap.get(resolveResult.selectedSlot.period) || null;

  return {
    checkDate,
    resolveResult,
    currentSlotSubmission,
    candidateSubmissionMap
  };
}

async function buildStudentClassroomCheckLists({ classId, absentStudentIds, slot }) {
  const students = await loadActiveClassroomCheckStudents(classId);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const invalidStudentIds = absentStudentIds.filter((studentId) => !studentsById.has(studentId));

  if (invalidStudentIds.length) {
    return {
      error: '未到名单中包含非本班学生或已停用学生'
    };
  }

  const { approvedIds, pendingIds } = await getLeaveMatchSets({
    classId,
    studentIds: absentStudentIds,
    checkDate: formatDateKey(slot.startDateTime),
    period: slot.period
  });

  return {
    students,
    submissionLists: buildSubmissionLists({
      studentsById,
      absentStudentIds,
      approvedIds,
      pendingIds
    })
  };
}

async function findLatestClassroomCheckSubmission(classId) {
  return ClassroomCheckSubmission.findOne({
    where: { class_id: classId },
    order: [['submitted_at', 'DESC'], ['id', 'DESC']]
  });
}

async function dispatchPendingLeaveNotificationSafe(req, leaveRequest) {
  if (!leaveRequest || leaveRequest.status !== 'pending') {
    return;
  }

  const payload = buildTeacherPendingLeavePayload({
    leaveRequest,
    classId: req.user.classId,
    studentId: req.user.id,
    studentName: leaveRequest.student_name_snapshot || req.currentStudent?.student_name || ''
  });

  try {
    await dispatchDomainEventNow(TEACHER_PENDING_LEAVE_EVENT, payload);
  } catch (error) {
    console.error('Dispatch teacher pending leave notification failed, enqueue fallback retry.', {
      leaveRequestId: payload.leaveRequestId,
      classId: payload.classId,
      error: error?.message || 'unknown_error'
    });

    try {
      await enqueueDomainEvent(TEACHER_PENDING_LEAVE_EVENT, payload);
    } catch (enqueueError) {
      console.error('Enqueue fallback teacher pending leave notification failed.', {
        leaveRequestId: payload.leaveRequestId,
        classId: payload.classId,
        error: enqueueError?.message || 'unknown_error'
      });
    }
  }
}

router.get('/profile', requireStudent, async (req, res) => {
  try {
    const [student, classInfo] = await Promise.all([
      Student.findByPk(req.user.id, {
        attributes: ['id', 'student_name', 'role', 'status']
      }),
      Class.findByPk(req.user.classId, {
        attributes: ['id', 'class_name']
      })
    ]);

    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }

    res.json({
      student: {
        id: student.id,
        name: student.student_name,
        classId: classInfo?.id || req.user.classId,
        className: classInfo?.class_name || '',
        role: student.role,
        status: student.status
      }
    });
  } catch (error) {
    console.error('获取学生资料错误:', error);
    res.status(500).json({ error: '获取学生资料失败' });
  }
});

router.get('/leave/context', requireStudent, async (req, res) => {
  try {
    const [bundle, student, classInfo] = await Promise.all([
      loadClassScheduleBundle(req.user.classId),
      Student.findByPk(req.user.id, { attributes: ['student_name'] }),
      Class.findByPk(req.user.classId, { attributes: ['class_name'] })
    ]);

    const now = new Date();
    const today = getTodayLeaveContext({
      now,
      periods: bundle.periods,
      schedules: bundle.schedules,
      specialDates: bundle.specialDates
    });

    if (today.currentLocation === 'dormitory' && student && classInfo) {
      today.copyText = `今日请假在宿舍：${classInfo.class_name} ${student.student_name}`;
    }

    const weekendTargets = getWeekendTargets(now, bundle.specialDates);

    res.json({
      now: now.toISOString(),
      today,
      weekendTargets
    });
  } catch (error) {
    console.error('获取请假上下文错误:', error);
    res.status(500).json({ error: '获取请假上下文失败' });
  }
});

router.post('/leave', requireStudent, async (req, res) => {
  try {
    const { mode } = req.body;

    if (!['today', 'custom', 'weekend'].includes(mode)) {
      return res.status(400).json({ error: '请假模式无效' });
    }

    const now = new Date();

    if (mode === 'today') {
      const { leaveType, reason, selectionKind, presetId, fromPeriod, toPeriod } = req.body;

      if (!isValidLeaveType(leaveType)) {
        return res.status(400).json({ error: '请假类型无效' });
      }

      const trimmedReason = String(reason || '').trim();
      if (trimmedReason.length < 5 || trimmedReason.length > 500) {
        return res.status(400).json({ error: '请假原因长度必须在 5-500 字符之间' });
      }

      const bundle = await loadClassScheduleBundle(req.user.classId);
      const context = getTodayLeaveContext({
        now,
        periods: bundle.periods,
        schedules: bundle.schedules,
        specialDates: bundle.specialDates
      });

      if (!context.available) {
        return res.status(400).json({ error: context.reason || '当前无法发起当天请假' });
      }

      let selectedFromPeriod;
      let selectedToPeriod;

      if (selectionKind === 'preset') {
        const preset = context.presets.find((item) => item.id === presetId);
        if (!preset) {
          return res.status(400).json({ error: '快捷选项无效' });
        }
        selectedFromPeriod = preset.fromPeriod;
        selectedToPeriod = preset.toPeriod;
      } else if (selectionKind === 'range') {
        selectedFromPeriod = Number(fromPeriod);
        selectedToPeriod = Number(toPeriod);
      } else {
        return res.status(400).json({ error: '当天请假选择方式无效' });
      }

      if (!Number.isInteger(selectedFromPeriod) || !Number.isInteger(selectedToPeriod) || selectedFromPeriod > selectedToPeriod) {
        return res.status(400).json({ error: '课程节次选择无效' });
      }

      const availablePeriods = new Set(context.rangeOptions.map((item) => item.period));
      if (!availablePeriods.has(selectedFromPeriod) || !availablePeriods.has(selectedToPeriod)) {
        return res.status(400).json({ error: '所选课程不在今日可请假范围内' });
      }

      const periods = normalizePeriods(bundle.periods);
      const todayKey = formatDateKey(now);
      const selectedPeriodConfig = periods.find((item) => item.period === selectedToPeriod);
      if (!selectedPeriodConfig) {
        return res.status(400).json({ error: '课程时间线配置缺失' });
      }

      const todayRecords = getScheduleRecordsForRange({
        startDateTime: now,
        endDateTime: combineDateAndTime(todayKey, selectedPeriodConfig.endTime, true),
        periods: bundle.periods,
        schedules: bundle.schedules,
        specialDates: bundle.specialDates
      }).filter((item) => item.period >= selectedFromPeriod && item.period <= selectedToPeriod);

      if (!todayRecords.length) {
        return res.status(400).json({ error: '所选时间没有命中任何课程' });
      }

      const endTime = combineDateAndTime(todayKey, selectedPeriodConfig.endTime, true);
      const overlappingLeaves = await findOverlappingLeaves(req.user.id, now, endTime);
      if (overlappingLeaves.length > 0) {
        return res.status(409).json({ error: '该时间段已有待审批、已批准或已报备记录，不可重复提交' });
      }

      const result = await sequelize.transaction(async (transaction) => {
        await assertNoOverlappingLeaves(req.user.id, now, endTime, transaction);
        const snapshots = await buildLeaveRequestSnapshots(req.user.id, req.user.classId, transaction);
        const leaveRequest = await LeaveRequest.create({
          student_id: req.user.id,
          class_id: req.user.classId,
          leave_type: leaveType,
          request_mode: 'today',
          start_time: now,
          end_time: endTime,
          reason: trimmedReason,
          status: 'pending',
          current_location: context.currentLocation,
          go_home: false,
          submitted_at: new Date(),
          ...snapshots
        }, { transaction });

        await LeaveRecord.bulkCreate(
          todayRecords.map((item) => ({
            schedule_id: item.schedule_id,
            leave_date: item.leave_date,
            weekday: item.weekday,
            period: item.period,
            subject: item.subject,
            subject_snapshot: item.subject || null,
            weekday_snapshot: item.weekday,
            period_snapshot: item.period,
            start_time_snapshot: item.startTime || null,
            end_time_snapshot: item.endTime || null,
            leave_request_id: leaveRequest.id
          })),
          { transaction }
        );

        await upsertArchiveFromLeaveRequestId(leaveRequest.id, transaction);

        return leaveRequest;
      });

      await dispatchPendingLeaveNotificationSafe(req, result);
      return res.status(201).json({ message: '当天请假提交成功', leaveRequest: result });
    }

    if (mode === 'custom') {
      const { leaveType, startTime, endTime, reason } = req.body;

      if (!isValidLeaveType(leaveType)) {
        return res.status(400).json({ error: '请假类型无效' });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({ error: '开始或结束时间格式无效' });
      }

      if (end <= start) {
        return res.status(400).json({ error: '结束时间必须晚于开始时间' });
      }

      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > 14) {
        return res.status(400).json({ error: '请假跨度不得超过 14 天' });
      }

      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (start < thirtyDaysAgo) {
        return res.status(400).json({ error: '请假开始时间不得早于 30 天前' });
      }

      const trimmedReason = String(reason || '').trim();
      if (trimmedReason.length < 5 || trimmedReason.length > 500) {
        return res.status(400).json({ error: '请假原因长度必须在 5-500 字符之间' });
      }

      const overlappingLeaves = await findOverlappingLeaves(req.user.id, start, end);
      if (overlappingLeaves.length > 0) {
        return res.status(409).json({ error: '该时间段已有待审批、已批准或已报备记录，不可重复提交' });
      }

      const bundle = await loadClassScheduleBundle(req.user.classId);
      const records = getScheduleRecordsForRange({
        startDateTime: start,
        endDateTime: end,
        periods: bundle.periods,
        schedules: bundle.schedules,
        specialDates: bundle.specialDates
      });

      if (!records.length) {
        return res.status(400).json({ error: '所选时间没有命中任何课程，请改用周末/节假日报备或重新选择时间' });
      }

      const result = await sequelize.transaction(async (transaction) => {
        await assertNoOverlappingLeaves(req.user.id, start, end, transaction);
        const snapshots = await buildLeaveRequestSnapshots(req.user.id, req.user.classId, transaction);
        const leaveRequest = await LeaveRequest.create({
          student_id: req.user.id,
          class_id: req.user.classId,
          leave_type: leaveType,
          request_mode: 'custom',
          start_time: start,
          end_time: end,
          reason: trimmedReason,
          status: 'pending',
          current_location: null,
          go_home: false,
          submitted_at: new Date(),
          ...snapshots
        }, { transaction });

        await LeaveRecord.bulkCreate(
          records.map((item) => ({
            schedule_id: item.schedule_id,
            leave_date: item.leave_date,
            weekday: item.weekday,
            period: item.period,
            subject: item.subject,
            subject_snapshot: item.subject || null,
            weekday_snapshot: item.weekday,
            period_snapshot: item.period,
            start_time_snapshot: item.startTime || null,
            end_time_snapshot: item.endTime || null,
            leave_request_id: leaveRequest.id
          })),
          { transaction }
        );

        await upsertArchiveFromLeaveRequestId(leaveRequest.id, transaction);

        return leaveRequest;
      });

      await dispatchPendingLeaveNotificationSafe(req, result);
      return res.status(201).json({ message: '请假申请提交成功', leaveRequest: result });
    }

    const { targetId } = req.body;

    const bundle = await loadClassScheduleBundle(req.user.classId);
    const weekendTargets = getWeekendTargets(now, bundle.specialDates);
    const target = weekendTargets.find((item) => item.id === targetId);
    if (!target) {
      return res.status(400).json({ error: '周末或节假日报备目标无效' });
    }

    const start = combineDateAndTime(target.startDate, '00:00');
    const end = combineDateAndTime(target.endDate, '23:59', true);
    const overlappingLeaves = await findOverlappingLeaves(req.user.id, start, end);
    if (overlappingLeaves.length > 0) {
      return res.status(409).json({ error: '该周末或节假日已有记录，不可重复提交' });
    }

    const result = await sequelize.transaction(async (transaction) => {
      await assertNoOverlappingLeaves(req.user.id, start, end, transaction);
      const snapshots = await buildLeaveRequestSnapshots(req.user.id, req.user.classId, transaction);
      const leaveRequest = await LeaveRequest.create({
        student_id: req.user.id,
        class_id: req.user.classId,
        leave_type: 'other',
        request_mode: 'weekend',
        start_time: start,
        end_time: end,
        reason: null,
        status: 'recorded',
        current_location: 'home',
        go_home: true,
        submitted_at: new Date(),
        ...snapshots
      }, { transaction });

      await upsertArchiveFromLeaveRequestId(leaveRequest.id, transaction);
      return leaveRequest;
    });

    res.status(201).json({ message: '周末/节假日回家报备成功', leaveRequest: result });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, ...(error.payload || {}) });
    }
    console.error('提交请假申请错误:', error);
    res.status(500).json({ error: '提交请假申请失败' });
  }
});

router.get('/leaves', requireStudent, async (req, res) => {
  try {
    const where = {
      student_id: req.user.id,
      source_type: { [Op.ne]: 'restore_preview' }
    };
    const { status, requestMode } = req.query;

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

    if (requestMode && ['today', 'custom', 'weekend'].includes(requestMode)) {
      where.request_mode = requestMode;
    }

    const leaves = await LeaveHistoryArchive.findAll({
      where,
      order: [['submitted_at', 'DESC']]
    });

    res.json(leaves.map(buildStudentLeaveItemFromArchive));
  } catch (error) {
    console.error('获取请假记录错误:', error);
    res.status(500).json({ error: '获取请假记录失败' });
  }
});

router.get('/schedule', requireStudent, async (req, res) => {
  try {
    const bundle = await loadClassScheduleBundle(req.user.classId);
    res.json(buildScheduleResponse(bundle));
  } catch (error) {
    console.error('获取课表错误:', error);
    res.status(500).json({ error: '获取课表失败' });
  }
});

router.get('/schedule/stats', requireStudent, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const month = now.getMonth();
      startDate = month < 7 ? new Date(now.getFullYear(), 1, 1) : new Date(now.getFullYear(), 8, 1);
    }

    const records = await LeaveRecord.findAll({
      include: [{
        model: LeaveRequest,
        as: 'leaveRequest',
        where: {
          student_id: req.user.id,
          status: 'approved'
        }
      }],
      where: {
        leave_date: { [Op.gte]: formatDateKey(startDate) }
      }
    });

    const stats = {};
    records.forEach((record) => {
      const key = `${record.weekday}-${record.period}`;
      stats[key] = (stats[key] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error('获取统计错误:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

router.get('/manage/classroom-check/context', requireCadre, async (req, res) => {
  try {
    const now = new Date();
    const [bundle, students] = await Promise.all([
      loadClassScheduleBundle(req.user.classId),
      loadActiveClassroomCheckStudents(req.user.classId)
    ]);

    const resolveResult = resolveClassroomCheckWindow({
      now,
      periods: bundle.periods,
      schedules: bundle.schedules,
      specialDates: bundle.specialDates
    });
    const [latestSubmission, candidateSubmissionMap] = await Promise.all([
      findLatestClassroomCheckSubmission(req.user.classId),
      loadClassroomCheckCandidateSubmissionMap(req.user.classId, formatDateKey(now), resolveResult.candidates)
    ]);
    const currentSlotSubmission = resolveResult.mode === 'single_course' && resolveResult.selectedSlot
      ? candidateSubmissionMap.get(resolveResult.selectedSlot.period) || null
      : null;

    res.json({
      now: now.toISOString(),
      slot: resolveResult.selectedSlot
        ? serializeCourseCandidate(resolveResult.selectedSlot, currentSlotSubmission)
        : null,
      slotMode: resolveResult.mode,
      slotMessage: resolveResult.message,
      slotCandidates: resolveResult.candidates.map((candidate) => (
        serializeCourseCandidate(candidate, candidateSubmissionMap.get(candidate.period) || null)
      )),
      students: sortStudentSnapshots(students.map(createStudentSnapshot)),
      latestSubmission: latestSubmission ? buildStudentClassroomCheckResponse(latestSubmission) : null,
      currentSlotSubmission: currentSlotSubmission || null
    });
  } catch (error) {
    console.error('获取教室核对上下文错误:', error);
    res.status(500).json({ error: '获取教室核对上下文失败' });
  }
});

router.post('/manage/classroom-check/preview', requireCadre, [
  body('absentStudentIds').optional().isArray({ max: 200 }).withMessage('未到学生列表格式无效'),
  body('selectedCoursePeriod').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('课程选择参数无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { error, absentStudentIds } = normalizeAbsentStudentIds(req.body.absentStudentIds);
    if (error) {
      return res.status(400).json({ error });
    }

    const now = new Date();
    const bundle = await loadClassScheduleBundle(req.user.classId);
    const { resolveResult } = await resolveStudentClassroomCheckSlot(
      req.user.classId,
      bundle,
      now,
      req.body.selectedCoursePeriod
    );
    const classroomCheckLists = await buildStudentClassroomCheckLists({
      classId: req.user.classId,
      absentStudentIds,
      slot: resolveResult.selectedSlot
    });

    if (classroomCheckLists.error) {
      return res.status(400).json({ error: classroomCheckLists.error });
    }

    res.json(buildStudentClassroomCheckPreviewResponse(classroomCheckLists.submissionLists));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, ...(error.payload || {}) });
    }
    console.error('预览教室核对结果错误:', error);
    res.status(500).json({ error: '预览教室核对结果失败' });
  }
});

router.post('/manage/classroom-check', requireCadre, [
  body('absentStudentIds').optional().isArray({ max: 200 }).withMessage('未到学生列表格式无效'),
  body('selectedCoursePeriod').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('课程选择参数无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { error, absentStudentIds } = normalizeAbsentStudentIds(req.body.absentStudentIds);
    if (error) {
      return res.status(400).json({ error });
    }

    const now = new Date();
    const bundle = await loadClassScheduleBundle(req.user.classId);
    const { checkDate, resolveResult, currentSlotSubmission } = await resolveStudentClassroomCheckSlot(
      req.user.classId,
      bundle,
      now,
      req.body.selectedCoursePeriod
    );

    const classroomCheckLists = await buildStudentClassroomCheckLists({
      classId: req.user.classId,
      absentStudentIds,
      slot: resolveResult.selectedSlot
    });

    if (classroomCheckLists.error) {
      return res.status(400).json({ error: classroomCheckLists.error });
    }

    const submissionLists = classroomCheckLists.submissionLists;
    const slot = resolveResult.selectedSlot;
    const submissionPayload = {
      submitted_by_student_id: req.student.id,
      submitted_by_name_snapshot: req.student.student_name,
      check_date: checkDate,
      slot_kind: slot.slotKind,
      weekday_snapshot: slot.weekday,
      period_snapshot: slot.period,
      subject_snapshot: slot.subject || null,
      start_time_snapshot: slot.startTime || null,
      end_time_snapshot: slot.endTime || null,
      slot_label_snapshot: slot.slotLabel || null,
      selected_students_json: submissionLists.selectedStudents,
      truancy_students_json: submissionLists.truancyStudents,
      question_students_json: submissionLists.questionStudents,
      submitted_at: now
    };

    let submission;
    let updatedExisting = false;

    await sequelize.transaction(async (transaction) => {
      const existingSubmission = await ClassroomCheckSubmission.findOne({
        where: {
          class_id: req.user.classId,
          check_date: checkDate,
          slot_kind: 'active_course',
          period_snapshot: slot.period
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (existingSubmission) {
        await existingSubmission.update(submissionPayload, { transaction });
        submission = existingSubmission;
        updatedExisting = true;
        return;
      }

      submission = await ClassroomCheckSubmission.create({
        class_id: req.user.classId,
        ...submissionPayload
      }, { transaction });
    });

    await writeAuditLog({
      userId: req.student.id,
      userType: 'student',
      action: 'submit_classroom_check',
      targetType: 'classroom_check',
      targetId: submission.id,
      details: {
        classId: req.user.classId,
        selectedCount: submissionLists.selectedStudents.length,
        truancyCount: submissionLists.truancyStudents.length,
        questionCount: submissionLists.questionStudents.length,
        slotKind: slot.slotKind,
        period: slot.period || null,
        subject: slot.subject || '',
        updatedExisting: updatedExisting || Boolean(currentSlotSubmission)
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    const responsePayload = {
      ...buildStudentClassroomCheckResponse(submission),
      updatedExisting
    };

    res.status(updatedExisting ? 200 : 201).json(responsePayload);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, ...(error.payload || {}) });
    }
    console.error('提交教室核对错误:', error);
    res.status(500).json({ error: '提交教室核对失败' });
  }
});

router.post('/set-password', authMiddleware, [
  body('password').isLength({ min: 6, max: 6 }).withMessage('密码必须是 6 位'),
  body('password').isNumeric().withMessage('密码必须是纯数字'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('两次密码不一致')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.type !== 'student_temp' || req.user.purpose !== 'set_password') {
      return res.status(403).json({ error: '无效的临时令牌' });
    }

    const [student, classInfo] = await Promise.all([
      Student.findByPk(req.user.id),
      Class.findByPk(req.user.classId, { attributes: ['class_name'] })
    ]);
    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }

    if (req.user.jwtVersion !== student.jwt_version) {
      return res.status(401).json({ error: '临时令牌已失效，请重新登录' });
    }

    if (student.is_authenticated) {
      return res.status(400).json({ error: '密码已设置，请使用修改密码功能' });
    }

    const { password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    await sequelize.transaction(async (transaction) => {
      const lockedStudent = await Student.findByPk(req.user.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedStudent) {
        throw new HttpError(404, '学生不存在');
      }

      if (req.user.jwtVersion !== lockedStudent.jwt_version) {
        throw new HttpError(401, '临时令牌已失效，请重新登录');
      }

      if (lockedStudent.is_authenticated) {
        throw new HttpError(400, '密码已设置，请使用修改密码功能');
      }

      await lockedStudent.update({
        password_hash: passwordHash,
        is_authenticated: true,
        password_set_at: new Date(),
        password_fail_count: 0
      }, { transaction });
    });

    const token = jwt.sign(
      {
        id: student.id,
        type: 'student',
        classId: req.user.classId,
        jwtVersion: student.jwt_version
      },
      process.env.JWT_SECRET,
      { expiresIn: '180d' }
    );

    await StudentLoginLog.create({
      student_id: student.id,
      device_info: req.get('user-agent'),
      ip_address: req.ip,
      jwt_version: student.jwt_version,
      login_at: new Date()
    });

    res.json({
      token,
      message: '密码设置成功',
      student: {
        id: student.id,
        name: student.student_name,
        classId: req.user.classId,
        className: classInfo?.class_name || '',
        role: student.role
      }
    });
  } catch (error) {
    console.error('设置密码错误:', error);
    res.status(500).json({ error: '设置密码失败' });
  }
});

router.post('/change-password', requireStudent, [
  body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
  body('newPassword').isLength({ min: 6, max: 6 }).withMessage('新密码必须是 6 位'),
  body('newPassword').isNumeric().withMessage('新密码必须是纯数字')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const student = await Student.findByPk(req.user.id);
    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }

    if (!student.is_authenticated || !student.password_hash) {
      return res.status(400).json({ error: '尚未设置密码，请先设置密码' });
    }

    const { oldPassword, newPassword } = req.body;
    const isOldPasswordValid = await bcrypt.compare(oldPassword, student.password_hash);
    if (!isOldPasswordValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const nextJwtVersion = student.jwt_version + 1;
    await student.update({
      password_hash: newPasswordHash,
      password_set_at: new Date(),
      jwt_version: nextJwtVersion
    });

    const token = jwt.sign(
      {
        id: student.id,
        type: 'student',
        classId: student.class_id,
        jwtVersion: nextJwtVersion
      },
      process.env.JWT_SECRET,
      { expiresIn: '180d' }
    );

    res.json({
      message: '密码修改成功',
      token
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

module.exports = router;
