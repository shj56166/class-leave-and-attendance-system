const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  LeaveRequest,
  LeaveRecord,
  LeaveHistoryArchive,
  AuditLog,
  Student,
  Teacher,
  Dormitory,
  Schedule,
  SchedulePeriod,
  ClassSpecialDate,
  Class,
  StudentLoginLog,
  PushDevice,
  PushDelivery
} = require('../models');
const { authMiddleware, requireTeacher, requireAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const {
  buildTeacherHistoryItemFromArchive,
  toSnapshotRecord,
  upsertArchiveFromLeaveRequestId
} = require('../utils/leaveHistoryArchive');
const { MAX_SCHEDULE_PERIODS, normalizePeriods, normalizeSpecialDates } = require('../utils/scheduleContext');
const { buildTeacherPendingLeavePayload } = require('../notifications/teacherPendingLeaveEvent');
const jpushChannel = require('../notifications/channels/jpushChannel');

const router = express.Router();

router.use(authMiddleware, requireTeacher);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeString(value, maxLength = 255) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePermissionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot;
}

function serializePushDevice(device) {
  return {
    id: device.id,
    platform: device.platform,
    provider: device.provider,
    registrationId: device.registration_id,
    bindingId: device.binding_id,
    deviceFingerprint: device.device_fingerprint,
    manufacturer: device.manufacturer,
    model: device.model,
    appVersion: device.app_version,
    permissionSnapshot: device.permission_snapshot || {},
    authExpiresAt: device.auth_expires_at,
    isActive: Boolean(device.is_active),
    lastRegisterAt: device.last_register_at,
    lastJpushSyncAt: device.last_jpush_sync_at,
    lastSeenAt: device.last_seen_at,
    updatedAt: device.updated_at
  };
}

function serializePushDelivery(delivery) {
  return {
    id: delivery.id,
    eventType: delivery.event_type,
    leaveRequestId: delivery.leave_request_id,
    teacherId: delivery.teacher_id,
    provider: delivery.provider,
    status: delivery.status,
    responsePayload: delivery.response_payload || null,
    sentAt: delivery.sent_at,
    updatedAt: delivery.updated_at
  };
}

function isServerJpushConfigured() {
  return Boolean(process.env.JPUSH_APP_KEY && process.env.JPUSH_MASTER_SECRET);
}

function buildPushDeliveryRow(event, provider, teacherId, status, responsePayload) {
  return {
    event_type: event.eventType,
    leave_request_id: event.leaveRequestId || null,
    teacher_id: teacherId,
    provider,
    status,
    response_payload: responsePayload || null,
    sent_at: new Date()
  };
}

function resolveTeacherStatus(resultValue, teacherId) {
  const teacherStatuses = resultValue?.teacherStatuses;
  if (!teacherStatuses) {
    return null;
  }

  return teacherStatuses[String(teacherId)] || teacherStatuses[teacherId] || null;
}

async function persistJpushDeliveryResult(event, teacherIds, result) {
  const effectiveTeacherIds = Array.isArray(teacherIds) ? teacherIds : [];
  const status = result?.status || 'failed';
  const responsePayload = result?.responsePayload || null;
  const rows = effectiveTeacherIds.length > 0
    ? effectiveTeacherIds.map((teacherId) => {
        const teacherStatus = resolveTeacherStatus(result, teacherId);
        return buildPushDeliveryRow(
          event,
          'jpush',
          teacherId,
          teacherStatus?.status || status,
          teacherStatus?.responsePayload || responsePayload
        );
      })
    : [
        buildPushDeliveryRow(
          event,
          'jpush',
          null,
          status,
          responsePayload
        )
      ];

  await PushDelivery.bulkCreate(rows);
}

function normalizeCursorSubmittedAt(value) {
  if (!value) {
    return null;
  }

  const submittedAt = new Date(value);
  return Number.isNaN(submittedAt.getTime()) ? null : submittedAt;
}

function normalizeCursorLeaveRequestId(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : 0;
}

function buildPendingEventsCursor(payload = {}) {
  return {
    submittedAt: payload?.submittedAt || null,
    leaveRequestId: Number(payload?.leaveRequestId || 0) || 0
  };
}

router.get('/push-devices/status', async (req, res) => {
  try {
    const [devices, recentJpushDeliveries, recentSocketDeliveries] = await Promise.all([
      PushDevice.findAll({
        where: {
          teacher_id: req.user.id,
          is_active: true
        },
        order: [['last_seen_at', 'DESC']]
      }),
      PushDelivery.findAll({
        where: {
          teacher_id: req.user.id,
          provider: 'jpush'
        },
        order: [['sent_at', 'DESC'], ['id', 'DESC']],
        limit: 5
      }),
      PushDelivery.findAll({
        where: {
          teacher_id: req.user.id,
          provider: 'socket.io'
        },
        order: [['sent_at', 'DESC'], ['id', 'DESC']],
        limit: 5
      })
    ]);

    res.json({
      serverJpushConfigured: isServerJpushConfigured(),
      devices: devices.map(serializePushDevice),
      recentJpushDeliveries: recentJpushDeliveries.map(serializePushDelivery),
      recentSocketDeliveries: recentSocketDeliveries.map(serializePushDelivery),
      summary: {
        activeDeviceCount: devices.length,
        activeJpushDeviceCount: devices.filter((device) => device.provider === 'jpush').length,
        lastSeenAt: devices[0]?.last_seen_at || null,
        lastSocketSentAt: recentSocketDeliveries[0]?.sent_at || null
      }
    });
  } catch (error) {
    console.error('Get push device status error:', error);
    res.status(500).json({ error: 'Failed to get push device status' });
  }
});

router.post('/push-devices/test-jpush', async (req, res) => {
  try {
    const teacherIds = [req.user.id];
    const event = {
      eventType: 'teacher.push.diagnostic',
      classId: req.user.classId,
      title: '审批提醒诊断',
      summaryText: '这是一条教师端远程推送诊断通知',
      route: '/dashboard/approval',
      source: 'jpush_remote_diagnostic',
      submittedAt: new Date().toISOString()
    };

    const result = await jpushChannel.send(event, { teacherIds });
    await persistJpushDeliveryResult(event, teacherIds, result);

    res.json({
      serverJpushConfigured: isServerJpushConfigured(),
      result
    });
  } catch (error) {
    console.error('Test JPush push error:', error);
    res.status(500).json({ error: 'Failed to send test JPush notification' });
  }
});

router.post('/push-devices/register', [
  body('registrationId').notEmpty().withMessage('registrationId is required'),
  body('bindingId').notEmpty().withMessage('bindingId is required'),
  body('deviceFingerprint').notEmpty().withMessage('deviceFingerprint is required'),
  body('platform').optional().isString(),
  body('provider').optional().isString(),
  body('manufacturer').optional().isString(),
  body('model').optional().isString(),
  body('appVersion').optional().isString(),
  body('permissionSnapshot').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const registrationId = normalizeString(req.body.registrationId, 255);
    const bindingId = normalizeString(req.body.bindingId, 80);
    const deviceFingerprint = normalizeString(req.body.deviceFingerprint, 191);
    const now = new Date();
    const authExpiresAt = Number.isFinite(Number(req.user?.exp))
      ? new Date(Number(req.user.exp) * 1000)
      : null;
    const payload = {
      teacher_id: req.user.id,
      platform: normalizeString(req.body.platform || 'android', 32) || 'android',
      provider: normalizeString(req.body.provider || 'local_notifications', 32) || 'local_notifications',
      registration_id: registrationId,
      binding_id: bindingId,
      device_fingerprint: deviceFingerprint,
      manufacturer: normalizeString(req.body.manufacturer, 100),
      model: normalizeString(req.body.model, 100),
      app_version: normalizeString(req.body.appVersion, 50),
      permission_snapshot: normalizePermissionSnapshot(req.body.permissionSnapshot),
      auth_expires_at: authExpiresAt,
      is_active: true,
      last_register_at: now,
      last_jpush_sync_at: normalizeString(req.body.provider || 'local_notifications', 32) === 'jpush'
        ? now
        : undefined,
      last_seen_at: now
    };

    const device = await sequelize.transaction(async (transaction) => {
      await PushDevice.update({
        is_active: false,
        last_seen_at: now
      }, {
        where: {
          teacher_id: {
            [Op.ne]: req.user.id
          },
          [Op.or]: [
            { device_fingerprint: deviceFingerprint },
            { registration_id: registrationId }
          ]
        },
        transaction
      });

      await PushDevice.update({
        is_active: false,
        last_seen_at: now
      }, {
        where: {
          teacher_id: req.user.id,
          device_fingerprint: deviceFingerprint,
          binding_id: {
            [Op.ne]: bindingId
          }
        },
        transaction
      });

      const existingDevice = await PushDevice.findOne({
        where: {
          teacher_id: req.user.id,
          device_fingerprint: deviceFingerprint
        },
        transaction
      });

      const nextPayload = {
        ...payload
      };

      if (nextPayload.last_jpush_sync_at === undefined) {
        delete nextPayload.last_jpush_sync_at;
      }

      return existingDevice
        ? existingDevice.update(nextPayload, { transaction })
        : PushDevice.create(nextPayload, { transaction });
    });

    res.json({
      device: serializePushDevice(device)
    });
  } catch (error) {
    console.error('Register push device error:', error);
    res.status(500).json({ error: 'Failed to register push device' });
  }
});

router.get('/notifications/pending-events', async (req, res) => {
  try {
    const cursorSubmittedAt = normalizeCursorSubmittedAt(req.query.cursorSubmittedAt)
      || normalizeCursorSubmittedAt(req.query.since)
      || new Date(Date.now() - 20 * 60 * 1000);
    const cursorLeaveRequestId = normalizeCursorLeaveRequestId(req.query.cursorLeaveRequestId);

    const pendingLeaves = await LeaveRequest.findAll({
      where: {
        class_id: req.user.classId,
        status: 'pending',
        request_mode: {
          [Op.in]: ['today', 'custom']
        },
        [Op.or]: [
          {
            submitted_at: {
              [Op.gt]: cursorSubmittedAt
            }
          },
          {
            submitted_at: cursorSubmittedAt,
            id: {
              [Op.gt]: cursorLeaveRequestId
            }
          }
        ]
      },
      order: [['submitted_at', 'ASC'], ['id', 'ASC']],
      limit: 50
    });

    const events = pendingLeaves.map((leaveRequest) => buildTeacherPendingLeavePayload({
      leaveRequest,
      classId: req.user.classId,
      studentId: leaveRequest.student_id,
      studentName: leaveRequest.student_name_snapshot || ''
    }));
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;

    res.json({
      events,
      nextCursor: lastEvent
        ? buildPendingEventsCursor(lastEvent)
        : buildPendingEventsCursor({
            submittedAt: cursorSubmittedAt.toISOString(),
            leaveRequestId: cursorLeaveRequestId
          }),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get pending notification events error:', error);
    res.status(500).json({ error: 'Failed to get pending notification events' });
  }
});

router.post('/push-devices/unregister', [
  body('bindingId').notEmpty().withMessage('bindingId is required'),
  body('deviceFingerprint').optional().isString(),
  body('registrationId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bindingId = normalizeString(req.body.bindingId, 80);
    const deviceFingerprint = normalizeString(req.body.deviceFingerprint, 191);
    const registrationId = normalizeString(req.body.registrationId, 255);

    if (!deviceFingerprint && !registrationId) {
      return res.status(400).json({ error: 'deviceFingerprint or registrationId is required' });
    }

    const where = {
      teacher_id: req.user.id,
      binding_id: bindingId
    };

    if (deviceFingerprint) {
      where.device_fingerprint = deviceFingerprint;
    }

    if (registrationId) {
      where.registration_id = registrationId;
    }

    const affectedRows = await PushDevice.update({
      is_active: false,
      last_seen_at: new Date()
    }, {
      where
    });

    res.json({
      success: true,
      affectedRows: Array.isArray(affectedRows) ? affectedRows[0] : affectedRows
    });
  } catch (error) {
    console.error('Unregister push device error:', error);
    res.status(500).json({ error: 'Failed to unregister push device' });
  }
});

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

function normalizeIncomingSpecialDate(item = {}) {
  const targetWeekday = Number(item.targetWeekday);
  const hasTargetWeekday = Number.isInteger(targetWeekday) && targetWeekday >= 1 && targetWeekday <= 7;

  return {
    date: item.date,
    type: hasTargetWeekday ? 'workday_override' : 'holiday',
    targetWeekday: hasTargetWeekday ? targetWeekday : null
  };
}

function validateSpecialDates(specialDates = []) {
  const dateSeen = new Set();

  for (const rawItem of specialDates) {
    const item = normalizeIncomingSpecialDate(rawItem);

    if (!item.date) {
      return '特殊日期不能为空';
    }

    if (dateSeen.has(item.date)) {
      return `存在重复特殊日期：${item.date}`;
    }

    dateSeen.add(item.date);
  }

  return '';
}

function sortStudentsByNumber(students = []) {
  return [...students].sort((left, right) => {
    const leftNumber = left.student_number || '';
    const rightNumber = right.student_number || '';
    return String(leftNumber).localeCompare(String(rightNumber), 'zh-CN', { numeric: true });
  });
}

function serializeDormitory(dormitory) {
  const students = sortStudentsByNumber(dormitory.students || []);

  return {
    id: dormitory.id,
    name: dormitory.name,
    studentCount: students.length,
    students: students.map((student) => ({
      id: student.id,
      studentName: student.student_name,
      studentNumber: student.student_number || '',
      status: student.status,
      role: student.role,
      dormitoryId: student.dormitory_id || null
    }))
  };
}

function getWeekdayLabel(dateValue) {
  const weekday = new Date(dateValue).getDay();
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][weekday] || '';
}

function getInclusiveDayCount(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1);
}

function getDayPartByTimeValue(timeValue) {
  const [hours = '0', minutes = '0'] = String(timeValue || '00:00').slice(0, 5).split(':');
  const totalMinutes = (Number(hours) * 60) + Number(minutes);

  if (totalMinutes < 12 * 60) {
    return 'morning';
  }

  if (totalMinutes < 18 * 60) {
    return 'afternoon';
  }

  return 'evening';
}

function formatCourseRangeText(records = []) {
  if (!records.length) {
    return '未命中课程';
  }

  const sorted = [...records].sort((left, right) => {
    if (left.leave_date !== right.leave_date) {
      return String(left.leave_date).localeCompare(String(right.leave_date));
    }
    return left.period - right.period;
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (sorted.length === 1) {
    return `第 ${first.period} 节 · ${first.subject || '未命名课程'}`;
  }

  return `第 ${first.period} - ${last.period} 节`;
}

function getCoverageLabel(records = [], scheduleBundle) {
  if (!records.length) {
    return '';
  }

  const dateKeys = [...new Set(records.map((item) => item.leave_date).filter(Boolean))];
  if (dateKeys.length !== 1) {
    return '';
  }

  const weekday = records[0]?.weekday;
  const periodMap = new Map(normalizePeriods(scheduleBundle.periods).map((item) => [item.period, item]));
  const daySchedules = (scheduleBundle.schedules || [])
    .filter((item) => item.weekday === weekday && item.subject)
    .map((item) => {
      const periodConfig = periodMap.get(item.period);
      return {
        period: item.period,
        part: periodConfig ? getDayPartByTimeValue(periodConfig.startTime) : ''
      };
    })
    .filter((item) => item.part)
    .sort((left, right) => left.period - right.period);

  if (!daySchedules.length) {
    return '';
  }

  const selectedPeriods = new Set(records.map((item) => item.period));
  const selectedParts = new Set(
    daySchedules
      .filter((item) => selectedPeriods.has(item.period))
      .map((item) => item.part)
  );

  const partSchedules = {
    morning: daySchedules.filter((item) => item.part === 'morning'),
    afternoon: daySchedules.filter((item) => item.part === 'afternoon'),
    evening: daySchedules.filter((item) => item.part === 'evening')
  };

  const matchesAll = (items) => (
    items.length > 0
    && items.every((item) => selectedPeriods.has(item.period))
    && selectedPeriods.size === items.length
  );

  if (selectedParts.size === 1 && selectedParts.has('morning') && matchesAll(partSchedules.morning)) {
    return '全上午课程';
  }

  if (selectedParts.size === 1 && selectedParts.has('afternoon') && matchesAll(partSchedules.afternoon)) {
    return '全下午课程';
  }

  if (
    !partSchedules.evening.length
    && partSchedules.morning.length
    && partSchedules.afternoon.length
    && selectedParts.size === 2
    && selectedParts.has('morning')
    && selectedParts.has('afternoon')
    && matchesAll([...partSchedules.morning, ...partSchedules.afternoon])
  ) {
    return '全天课程';
  }

  return '';
}

function buildPendingLeaveSummary(leave, scheduleBundle) {
  const records = Array.isArray(leave.records) ? leave.records : [];

  return {
    timeSummary: {
      weekdayLabel: getWeekdayLabel(leave.start_time),
      dayCount: getInclusiveDayCount(leave.start_time, leave.end_time)
    },
    courseSummary: {
      rangeText: formatCourseRangeText(records),
      totalPeriods: records.length,
      coverageLabel: getCoverageLabel(records, scheduleBundle)
    }
  };
}

router.get('/leaves/pending', async (req, res) => {
  try {
    const scheduleBundle = await loadClassScheduleBundle(req.user.classId);
    const leaves = await LeaveRequest.findAll({
      where: {
        class_id: req.user.classId,
        status: 'pending'
      },
      include: [
        { model: Student, as: 'student', attributes: ['id', 'student_name', 'student_number'] },
        { model: LeaveRecord, as: 'records' }
      ],
      order: [['submitted_at', 'ASC']]
    });

    res.json(leaves.map((leave) => ({
      ...leave.toJSON(),
      ...buildPendingLeaveSummary(leave, scheduleBundle)
    })));
  } catch (error) {
    console.error('获取待审批列表错误:', error);
    res.status(500).json({ error: '获取待审批列表失败' });
  }
});

router.put('/leaves/:id/approve', [
  body('status').isIn(['approved', 'rejected']).withMessage('状态无效'),
  body('comment').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const reviewedAt = new Date();
    const leave = await sequelize.transaction(async (transaction) => {
      const pendingLeave = await LeaveRequest.findOne({
        where: {
          id: req.params.id,
          class_id: req.user.classId
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pendingLeave) {
        throw new HttpError(404, '请假申请不存在');
      }

      if (pendingLeave.status !== 'pending') {
        throw new HttpError(409, '该申请已被处理，不可重复审批');
      }

      const reviewer = await Teacher.findByPk(req.user.id, {
        attributes: ['id', 'real_name'],
        transaction
      });

      await pendingLeave.update({
        status: req.body.status,
        teacher_id: req.user.id,
        teacher_comment: req.body.comment || '',
        reviewed_at: reviewedAt,
        reviewer_name_snapshot: reviewer?.real_name || pendingLeave.reviewer_name_snapshot || ''
      }, { transaction });

      const leaveRecords = await LeaveRecord.findAll({
        where: { leave_request_id: pendingLeave.id },
        transaction
      });

      await writeAuditLog({
        userId: req.user.id,
        userType: 'teacher',
        action: 'approve_leave',
        targetType: 'leave_request',
        targetId: pendingLeave.id,
        details: {
          status: req.body.status,
          comment: req.body.comment || '',
          studentId: pendingLeave.student_id,
          requestMode: pendingLeave.request_mode,
          leaveType: pendingLeave.leave_type,
          reviewerName: reviewer?.real_name || '',
          submittedAt: pendingLeave.submitted_at,
          reviewedAt,
          startTime: pendingLeave.start_time,
          endTime: pendingLeave.end_time,
          studentName: pendingLeave.student_name_snapshot || '',
          studentNumber: pendingLeave.student_number_snapshot || '',
          className: pendingLeave.class_name_snapshot || '',
          reason: pendingLeave.reason || '',
          currentLocation: pendingLeave.current_location || null,
          goHome: Boolean(pendingLeave.go_home),
          records: leaveRecords.map(toSnapshotRecord).filter(Boolean)
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        transaction,
        throwOnError: true
      });

      await upsertArchiveFromLeaveRequestId(pendingLeave.id, transaction);
      return pendingLeave;
    });

    res.json({ message: '审批成功', leave });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('审批错误:', error);
    res.status(500).json({ error: '审批失败' });
  }
});

router.get('/leaves', async (req, res) => {
  try {
    const {
      status,
      requestMode,
      studentName,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where = { class_id: req.user.classId };

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

    if (startDate || endDate) {
      where.submitted_at = {};
      if (startDate) {
        where.submitted_at[Op.gte] = new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        where.submitted_at[Op.lte] = new Date(`${endDate}T23:59:59`);
      }
    }

    const include = [
      { model: Student, as: 'student', attributes: ['id', 'student_name', 'student_number'] },
      { model: LeaveRecord, as: 'records' },
      { model: Teacher, as: 'reviewer', attributes: ['real_name'] }
    ];

    if (studentName) {
      include[0].where = { student_name: { [Op.like]: `%${studentName}%` } };
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await LeaveRequest.findAndCountAll({
      where,
      include,
      distinct: true,
      col: 'id',
      order: [['submitted_at', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({
      total: count,
      page: Number(page),
      limit: Number(limit),
      data: rows
    });
  } catch (error) {
    console.error('获取请假记录错误:', error);
    res.status(500).json({ error: '获取请假记录失败' });
  }
});

router.get('/leaves/history', async (req, res) => {
  try {
    const {
      status = '',
      requestMode = '',
      studentName = '',
      sourceType = 'all',
      startDate = '',
      endDate = '',
      reviewedStartDate = '',
      reviewedEndDate = '',
      page = 1,
      limit = 20
    } = req.query;

    const where = {
      class_id: req.user.classId,
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

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;
    const { count, rows } = await LeaveHistoryArchive.findAndCountAll({
      where,
      order: [['submitted_at', 'DESC'], ['reviewed_at', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset
    });

    res.json({
      total: count,
      page: pageNumber,
      limit: pageSize,
      data: rows.map(buildTeacherHistoryItemFromArchive)
    });
  } catch (error) {
    console.error('获取请假历史失败:', error);
    res.status(500).json({ error: '获取请假历史失败' });
  }
});

router.get('/students', async (req, res) => {
  try {
    const students = await Student.findAll({
      where: { class_id: req.user.classId },
      order: [['student_number', 'ASC']]
    });

    res.json(students);
  } catch (error) {
    console.error('获取学生列表错误:', error);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

router.post('/students', requireAdmin, [
  body('studentName').notEmpty().withMessage('学生姓名不能为空'),
  body('studentNumber').optional(),
  body('role').optional().isIn(['student', 'cadre']).withMessage('角色无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentName, studentNumber, role } = req.body;
    const student = await Student.create({
      class_id: req.user.classId,
      student_name: studentName,
      student_number: studentNumber,
      status: 'active',
      role: role || 'student'
    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'create_student',
      targetType: 'student',
      targetId: student.id,
      details: { studentName, studentNumber, role: student.role },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ message: '添加学生成功', student });
  } catch (error) {
    console.error('添加学生错误:', error);
    res.status(500).json({ error: '添加学生失败' });
  }
});

router.put('/students/:id', requireAdmin, [
  body('role').optional().isIn(['student', 'cadre']).withMessage('角色无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentName, studentNumber, status, role } = req.body;
    const student = await sequelize.transaction(async (transaction) => {
      const lockedStudent = await Student.findOne({
        where: { id: req.params.id, class_id: req.user.classId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedStudent) {
        throw new HttpError(404, '学生不存在');
      }

      const nextStatus = status || lockedStudent.status;
      const shouldBumpJwtVersion = nextStatus !== lockedStudent.status;
      const nextJwtVersion = shouldBumpJwtVersion ? lockedStudent.jwt_version + 1 : lockedStudent.jwt_version;
      const shouldClearDormitory = nextStatus === 'inactive';

      await lockedStudent.update({
        student_name: studentName || lockedStudent.student_name,
        student_number: studentNumber !== undefined ? studentNumber : lockedStudent.student_number,
        status: nextStatus,
        dormitory_id: shouldClearDormitory ? null : lockedStudent.dormitory_id,
        role: role || lockedStudent.role,
        jwt_version: nextJwtVersion
      }, { transaction });

      await writeAuditLog({
        userId: req.user.id,
        userType: 'teacher',
        action: 'update_student',
        targetType: 'student',
        targetId: lockedStudent.id,
        details: {
          studentName,
          studentNumber,
          status: nextStatus,
          role,
          dormitoryCleared: shouldClearDormitory && Boolean(lockedStudent.dormitory_id),
          bumpedJwtVersion: shouldBumpJwtVersion,
          newJwtVersion: nextJwtVersion
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        transaction,
        throwOnError: true
      });

      return lockedStudent;
    });

    res.json({ message: '更新学生信息成功', student });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('更新学生错误:', error);
    res.status(500).json({ error: '更新学生失败' });
  }
});

router.delete('/students/:id', requireAdmin, async (req, res) => {
  try {
    const student = await Student.findOne({
      where: { id: req.params.id, class_id: req.user.classId }
    });

    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }

    const studentName = student.student_name;
    let preservedLeaveRequestCount = 0;
    let preservedLeaveRecordCount = 0;
    let preservedLoginLogCount = 0;
    let archivedStudent = null;

    await sequelize.transaction(async (transaction) => {
      const leaveRequests = await LeaveRequest.findAll({
        where: { student_id: student.id },
        attributes: ['id'],
        transaction
      });
      const leaveRequestIds = leaveRequests.map((item) => item.id);

      preservedLeaveRequestCount = leaveRequestIds.length;
      preservedLeaveRecordCount = leaveRequestIds.length
        ? await LeaveRecord.count({
            where: {
              leave_request_id: {
                [Op.in]: leaveRequestIds
              }
            },
            transaction
          })
        : 0;
      preservedLoginLogCount = await StudentLoginLog.count({
        where: { student_id: student.id },
        transaction
      });

      archivedStudent = await student.update({
        status: 'inactive',
        dormitory_id: null,
        password_hash: null,
        is_authenticated: false,
        password_fail_count: 0,
        is_locked: false,
        locked_at: null,
        password_set_at: null,
        jwt_version: Number(student.jwt_version || 0) + 1
      }, { transaction });
    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'archive_student',
      targetType: 'student',
      targetId: student.id,
      details: {
        studentName,
        preservedLeaveRequestCount,
        preservedLeaveRecordCount,
        preservedLoginLogCount,
        newStatus: 'inactive'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      message: '学生已归档，历史记录已保留',
      student: archivedStudent
    });
  } catch (error) {
    console.error('归档学生错误:', error);
    res.status(500).json({ error: '归档学生失败' });
  }
});

router.get('/dormitories', async (req, res) => {
  try {
    const dormitories = await Dormitory.findAll({
      where: { class_id: req.user.classId },
      include: [{
        model: Student,
        as: 'students',
        attributes: ['id', 'student_name', 'student_number', 'status', 'role', 'dormitory_id'],
        where: { class_id: req.user.classId, status: 'active' },
        required: false
      }],
      order: [['name', 'ASC']]
    });

    res.json({
      dormitories: dormitories.map(serializeDormitory)
    });
  } catch (error) {
    console.error('获取宿舍列表错误:', error);
    res.status(500).json({ error: '获取宿舍列表失败' });
  }
});

router.post('/dormitories', requireAdmin, [
  body('name').trim().notEmpty().withMessage('宿舍名称不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const name = String(req.body.name).trim();
    const exists = await Dormitory.findOne({
      where: { class_id: req.user.classId, name }
    });

    if (exists) {
      return res.status(409).json({ error: '该宿舍名称已存在' });
    }

    const dormitory = await Dormitory.create({
      class_id: req.user.classId,
      name
    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'create_dormitory',
      targetType: 'dormitory',
      targetId: dormitory.id,
      details: { name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      message: '新建宿舍成功',
      dormitory: {
        id: dormitory.id,
        name: dormitory.name,
        studentCount: 0,
        students: []
      }
    });
  } catch (error) {
    console.error('新建宿舍错误:', error);
    res.status(500).json({ error: '新建宿舍失败' });
  }
});

router.put('/dormitories/:id', requireAdmin, [
  body('name').trim().notEmpty().withMessage('宿舍名称不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dormitory = await Dormitory.findOne({
      where: { id: req.params.id, class_id: req.user.classId }
    });

    if (!dormitory) {
      return res.status(404).json({ error: '宿舍不存在' });
    }

    const name = String(req.body.name).trim();
    const duplicate = await Dormitory.findOne({
      where: {
        class_id: req.user.classId,
        name,
        id: { [Op.ne]: dormitory.id }
      }
    });

    if (duplicate) {
      return res.status(409).json({ error: '该宿舍名称已存在' });
    }

    await dormitory.update({ name });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'update_dormitory',
      targetType: 'dormitory',
      targetId: dormitory.id,
      details: { name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: '宿舍名称更新成功', dormitory: { id: dormitory.id, name: dormitory.name } });
  } catch (error) {
    console.error('更新宿舍错误:', error);
    res.status(500).json({ error: '更新宿舍失败' });
  }
});

router.delete('/dormitories/:id', requireAdmin, async (req, res) => {
  try {
    const dormitory = await Dormitory.findOne({
      where: { id: req.params.id, class_id: req.user.classId }
    });

    if (!dormitory) {
      return res.status(404).json({ error: '宿舍不存在' });
    }

    const studentCount = await Student.count({
      where: { class_id: req.user.classId, dormitory_id: dormitory.id, status: 'active' }
    });

    if (studentCount > 0) {
      return res.status(409).json({ error: '该宿舍下还有学生，请先移除后再删除' });
    }

    await dormitory.destroy();

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'delete_dormitory',
      targetType: 'dormitory',
      targetId: Number(req.params.id),
      details: { name: dormitory.name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: '宿舍删除成功' });
  } catch (error) {
    console.error('删除宿舍错误:', error);
    res.status(500).json({ error: '删除宿舍失败' });
  }
});

router.put('/dormitories/:id/students', requireAdmin, [
  body('studentIds').isArray().withMessage('studentIds 必须是数组'),
  body('studentIds.*').isInt().withMessage('studentIds 必须全部是整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dormitory = await Dormitory.findOne({
      where: { id: req.params.id, class_id: req.user.classId }
    });

    if (!dormitory) {
      return res.status(404).json({ error: '宿舍不存在' });
    }

    const studentIds = Array.from(new Set((req.body.studentIds || []).map((item) => Number(item))));
    const matchedStudents = studentIds.length
      ? await Student.findAll({
          where: {
            class_id: req.user.classId,
            status: 'active',
            id: { [Op.in]: studentIds }
          }
        })
      : [];

    if (matchedStudents.length !== studentIds.length) {
      return res.status(400).json({ error: '部分学生不属于当前班级' });
    }

    await sequelize.transaction(async (transaction) => {
      await Student.update(
        { dormitory_id: null },
        {
          where: {
            class_id: req.user.classId,
            dormitory_id: dormitory.id
          },
          transaction
        }
      );

      if (studentIds.length > 0) {
        await Student.update(
          { dormitory_id: dormitory.id },
          {
            where: {
              class_id: req.user.classId,
              status: 'active',
              id: { [Op.in]: studentIds }
            },
            transaction
          }
        );
      }
    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'assign_dormitory_students',
      targetType: 'dormitory',
      targetId: dormitory.id,
      details: {
        name: dormitory.name,
        studentIds
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: '宿舍成员更新成功' });
  } catch (error) {
    console.error('更新宿舍成员错误:', error);
    res.status(500).json({ error: '更新宿舍成员失败' });
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const bundle = await loadClassScheduleBundle(req.user.classId);
    res.json(buildScheduleResponse(bundle));
  } catch (error) {
    console.error('获取课表错误:', error);
    res.status(500).json({ error: '获取课表失败' });
  }
});

router.post('/schedules', requireAdmin, [
  body('periods').isArray().withMessage('时间线数据必须是数组'),
  body('schedules').isArray().withMessage('课表数据必须是数组')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { periods, schedules } = req.body;

    if (!periods.length) {
      return res.status(400).json({ error: '至少需要保留 1 节课时间线' });
    }

    if (periods.length > MAX_SCHEDULE_PERIODS) {
      return res.status(400).json({ error: `节次数量不能超过 ${MAX_SCHEDULE_PERIODS} 节` });
    }

    const periodSeen = new Set();
    const sortedPeriods = [...periods].sort((a, b) => a.period - b.period);

    for (let index = 0; index < sortedPeriods.length; index += 1) {
      const item = sortedPeriods[index];

      if (!Number.isInteger(item.period) || item.period < 1 || item.period > MAX_SCHEDULE_PERIODS) {
        return res.status(400).json({ error: `节次必须是 1 到 ${MAX_SCHEDULE_PERIODS} 之间的整数` });
      }

      if (item.period !== index + 1) {
        return res.status(400).json({ error: '节次编号必须从 1 开始连续递增，不能跳号' });
      }

      const key = String(item.period);
      if (periodSeen.has(key)) {
        return res.status(400).json({ error: `时间线存在重复节次：第 ${item.period} 节` });
      }
      periodSeen.add(key);

      if (!item.startTime || !item.endTime || item.startTime >= item.endTime) {
        return res.status(400).json({ error: `第 ${item.period} 节的开始结束时间无效` });
      }
    }

    const scheduleSeen = new Set();
    for (const item of schedules) {
      if (!Number.isInteger(item.weekday) || item.weekday < 1 || item.weekday > 7) {
        return res.status(400).json({ error: '星期必须是 1 到 7 之间的整数' });
      }

      if (!Number.isInteger(item.period) || item.period < 1 || item.period > MAX_SCHEDULE_PERIODS) {
        return res.status(400).json({ error: `课表节次必须是 1 到 ${MAX_SCHEDULE_PERIODS} 之间的整数` });
      }

      if (!periodSeen.has(String(item.period))) {
        return res.status(400).json({ error: `课表引用了不存在的节次：第 ${item.period} 节` });
      }

      if (!item.subject || !String(item.subject).trim()) {
        return res.status(400).json({ error: '课表科目不能为空' });
      }

      const key = `${item.weekday}-${item.period}`;
      if (scheduleSeen.has(key)) {
        return res.status(400).json({ error: `存在重复课表：星期 ${item.weekday} 第 ${item.period} 节` });
      }
      scheduleSeen.add(key);
    }

    await sequelize.transaction(async (transaction) => {
      await Promise.all([
        SchedulePeriod.destroy({ where: { class_id: req.user.classId }, transaction }),
        Schedule.destroy({ where: { class_id: req.user.classId }, transaction })
      ]);

      if (periods.length) {
        await SchedulePeriod.bulkCreate(periods.map((item) => ({
          class_id: req.user.classId,
          period: item.period,
          start_time: item.startTime,
          end_time: item.endTime
        })), { transaction });
      }

      if (schedules.length) {
        await Schedule.bulkCreate(schedules.map((item) => ({
          class_id: req.user.classId,
          weekday: item.weekday,
          period: item.period,
          subject: String(item.subject).trim(),
          teacher_name: String(item.teacherName || '').trim(),
          location: String(item.location || '教室').trim() || '教室'
        })), { transaction });
      }

    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
        action: 'update_schedule',
        targetType: 'schedule',
        targetId: req.user.classId,
        details: {
          periodCount: periods.length,
          scheduleCount: schedules.length
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
    });

    res.json({ message: '课表更新成功' });
  } catch (error) {
    console.error('更新课表错误:', error);
    res.status(500).json({ error: '更新课表失败' });
  }
});

router.put('/special-dates', requireAdmin, [
  body('specialDates').isArray().withMessage('特殊日期数据必须是数组')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const incomingSpecialDates = Array.isArray(req.body.specialDates)
      ? req.body.specialDates.map(normalizeIncomingSpecialDate)
      : [];

    const validationError = validateSpecialDates(incomingSpecialDates);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await sequelize.transaction(async (transaction) => {
      await ClassSpecialDate.destroy({
        where: { class_id: req.user.classId },
        transaction
      });

      if (incomingSpecialDates.length) {
        await ClassSpecialDate.bulkCreate(incomingSpecialDates.map((item) => ({
          class_id: req.user.classId,
          date: item.date,
          type: item.type,
          target_weekday: item.targetWeekday,
          label: null
        })), { transaction });
      }
    });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: 'update_special_dates',
      targetType: 'schedule',
      targetId: req.user.classId,
      details: {
        specialDateCount: incomingSpecialDates.length
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    const bundle = await loadClassScheduleBundle(req.user.classId);
    res.json({
      message: '特殊日期更新成功',
      specialDates: normalizeSpecialDates(bundle.specialDates)
    });
  } catch (error) {
    console.error('更新特殊日期错误:', error);
    res.status(500).json({ error: '更新特殊日期失败' });
  }
});

router.post('/class/login-window', requireAdmin, [
  body('open').isBoolean().withMessage('open 必须是布尔值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const classInfo = await Class.findByPk(req.user.classId);
    if (!classInfo) {
      return res.status(404).json({ error: '班级不存在' });
    }

    await classInfo.update({ login_window_open: req.body.open });

    await writeAuditLog({
      userId: req.user.id,
      userType: 'teacher',
      action: req.body.open ? 'open_login_window' : 'close_login_window',
      targetType: 'class',
      targetId: classInfo.id,
      details: { loginWindowOpen: req.body.open },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      message: req.body.open ? '登录窗口已开启' : '登录窗口已关闭',
      loginWindowOpen: req.body.open
    });
  } catch (error) {
    console.error('切换登录窗口错误:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

router.get('/class/login-window', async (req, res) => {
  try {
    const classInfo = await Class.findByPk(req.user.classId);
    if (!classInfo) {
      return res.status(404).json({ error: '班级不存在' });
    }

    res.json({ loginWindowOpen: classInfo.login_window_open });
  } catch (error) {
    console.error('获取登录窗口状态错误:', error);
    res.status(500).json({ error: '获取状态失败' });
  }
});

router.post('/students/:id/reset', requireAdmin, async (req, res) => {
  try {
    let nextJwtVersion = 0;
    const student = await sequelize.transaction(async (transaction) => {
      const lockedStudent = await Student.findOne({
        where: { id: req.params.id, class_id: req.user.classId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!lockedStudent) {
        throw new HttpError(404, '学生不存在');
      }

      nextJwtVersion = lockedStudent.jwt_version + 1;

      await lockedStudent.update({
        password_hash: null,
        is_authenticated: false,
        jwt_version: nextJwtVersion,
        password_fail_count: 0,
        is_locked: false,
        locked_at: null,
        password_set_at: null
      }, { transaction });

      await writeAuditLog({
        userId: req.user.id,
        userType: 'teacher',
        action: 'reset_student',
        targetType: 'student',
        targetId: lockedStudent.id,
        details: {
          studentName: lockedStudent.student_name,
          newJwtVersion: nextJwtVersion
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        transaction,
        throwOnError: true
      });

      return lockedStudent;
    });

    res.json({
      message: '学生已重置为新用户状态，所有设备已退出',
      student: {
        id: student.id,
        name: student.student_name,
        isAuthenticated: false,
        jwtVersion: nextJwtVersion
      }
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('重置学生错误:', error);
    res.status(500).json({ error: '重置失败' });
  }
});

router.get('/students/:id/login-logs', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const student = await Student.findOne({
      where: { id: req.params.id, class_id: req.user.classId }
    });

    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }

    const logs = await StudentLoginLog.findAll({
      where: { student_id: req.params.id },
      order: [['login_at', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });

    const total = await StudentLoginLog.count({
      where: { student_id: req.params.id }
    });

    res.json({
      student: {
        id: student.id,
        name: student.student_name,
        isAuthenticated: student.is_authenticated,
        isLocked: student.is_locked,
        jwtVersion: student.jwt_version
      },
      logs: logs.map((log) => ({
        id: log.id,
        deviceInfo: log.device_info,
        ipAddress: log.ip_address,
        jwtVersion: log.jwt_version,
        loginAt: log.login_at,
        isCurrentVersion: log.jwt_version === student.jwt_version
      })),
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('获取登录日志错误:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

router.get('/students/enhanced', async (req, res) => {
  try {
    const students = await Student.findAll({
      where: { class_id: req.user.classId },
      include: [{
        model: Dormitory,
        as: 'dormitory',
        attributes: ['id', 'name'],
        required: false
      }],
      attributes: [
        'id',
        'student_name',
        'student_number',
        'dormitory_id',
        'role',
        'status',
        'is_authenticated',
        'is_locked',
        'jwt_version',
        'password_fail_count',
        'password_set_at',
        'locked_at',
        'created_at'
      ],
      order: [['student_number', 'ASC']]
    });

    const studentsWithDeviceCount = await Promise.all(
      students.map(async (student) => {
        const deviceCount = await StudentLoginLog.count({
          where: {
            student_id: student.id,
            jwt_version: student.jwt_version
          },
          distinct: true,
          col: 'device_info'
        });

        const lastLogin = await StudentLoginLog.findOne({
          where: { student_id: student.id },
          order: [['login_at', 'DESC']]
        });

        return {
          ...student.toJSON(),
          dormitoryId: student.dormitory_id || null,
          dormitoryName: student.dormitory?.name || '',
          deviceCount,
          lastLoginAt: lastLogin?.login_at || null
        };
      })
    );

    res.json({
      students: studentsWithDeviceCount,
      total: students.length
    });
  } catch (error) {
    console.error('获取学生增强列表错误:', error);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

module.exports = router;
