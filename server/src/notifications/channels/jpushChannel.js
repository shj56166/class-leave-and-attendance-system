const { Op } = require('sequelize');
const { PushDevice } = require('../../models');

const JPUSH_ENDPOINT = 'https://api.jpush.cn/v3/push';
const DEFAULT_ALERT = '有新的待审批请假';
const DEFAULT_ROUTE = '/dashboard/approval';
const JPUSH_REMOTE_NOTIFICATION_SOURCE = 'jpush_remote';
const JPUSH_TIMEOUT_MS = 5000;

function logSendResult(level, payload = {}) {
  const entry = {
    provider: 'jpush',
    ...payload
  };

  const logger = level === 'error'
    ? console.error
    : level === 'warn'
      ? console.warn
      : console.info;

  logger('JPush send result:', entry);
}

function buildTeacherStatuses(teacherIds = [], status = 'skipped', reason = '') {
  return teacherIds.reduce((accumulator, teacherId) => {
    accumulator[String(teacherId)] = {
      status,
      responsePayload: reason ? { reason } : null
    };
    return accumulator;
  }, {});
}

function createSuccessResponsePayload(responsePayload, teacherId) {
  return {
    messageId: responsePayload?.msg_id || responsePayload?.message_id || null,
    sendno: responsePayload?.sendno || null,
    teacherId
  };
}

function buildPushRequestBody(event, registrationIds) {
  const alert = String(event?.summaryText || DEFAULT_ALERT).trim() || DEFAULT_ALERT;
  const route = String(event?.route || DEFAULT_ROUTE).trim() || DEFAULT_ROUTE;
  const source = String(event?.source || JPUSH_REMOTE_NOTIFICATION_SOURCE).trim() || JPUSH_REMOTE_NOTIFICATION_SOURCE;
  const title = String(
    event?.title
      || (event?.studentName
        ? `${event.studentName} 提交了新的待审批请假`
        : DEFAULT_ALERT)
  ).trim() || DEFAULT_ALERT;

  return {
    platform: ['android'],
    audience: {
      registration_id: registrationIds
    },
    notification: {
      android: {
        alert,
        title,
        builder_id: 1,
        extras: {
          source,
          eventType: event?.eventType || '',
          classId: event?.classId || null,
          leaveRequestId: event?.leaveRequestId || null,
          studentId: event?.studentId || null,
          studentName: event?.studentName || '',
          requestMode: event?.requestMode || '',
          leaveType: event?.leaveType || '',
          startTime: event?.startTime || '',
          endTime: event?.endTime || '',
          submittedAt: event?.submittedAt || '',
          summaryText: alert,
          route
        }
      }
    },
    options: {
      time_to_live: 86400
    }
  };
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function send(event, options = {}) {
  const teacherIds = Array.isArray(options.teacherIds) ? options.teacherIds : [];
  const isConfigured = Boolean(process.env.JPUSH_APP_KEY && process.env.JPUSH_MASTER_SECRET);

  if (!isConfigured) {
    const result = {
      provider: 'jpush',
      status: 'skipped',
      reason: 'not_configured',
      eventType: event?.eventType || '',
      teacherStatuses: buildTeacherStatuses(teacherIds, 'skipped', 'not_configured')
    };

    logSendResult('warn', {
      status: result.status,
      reason: result.reason,
      eventType: result.eventType,
      teacherCount: teacherIds.length
    });

    return result;
  }

  if (teacherIds.length === 0) {
    const result = {
      provider: 'jpush',
      status: 'skipped',
      reason: 'no_teachers',
      eventType: event?.eventType || '',
      teacherStatuses: {}
    };

    logSendResult('warn', {
      status: result.status,
      reason: result.reason,
      eventType: result.eventType,
      teacherCount: 0
    });

    return result;
  }

  const activeDevices = await PushDevice.findAll({
    where: {
      teacher_id: {
        [Op.in]: teacherIds
      },
      provider: 'jpush',
      is_active: true,
      auth_expires_at: {
        [Op.gt]: new Date()
      },
      registration_id: {
        [Op.ne]: ''
      }
    },
    attributes: ['teacher_id', 'registration_id', 'binding_id']
  });

  if (activeDevices.length === 0) {
    const result = {
      provider: 'jpush',
      status: 'skipped',
      reason: 'no_active_devices',
      eventType: event?.eventType || '',
      teacherStatuses: buildTeacherStatuses(teacherIds, 'skipped', 'no_active_devices')
    };

    logSendResult('warn', {
      status: result.status,
      reason: result.reason,
      eventType: result.eventType,
      teacherCount: teacherIds.length,
      registrationIdCount: 0
    });

    return result;
  }

  const registrationIds = [...new Set(
    activeDevices
      .map((device) => String(device.registration_id || '').trim())
      .filter(Boolean)
  )];
  const targetedTeacherIds = [...new Set(activeDevices.map((device) => device.teacher_id))];
  const teacherStatuses = buildTeacherStatuses(teacherIds, 'skipped', 'no_active_devices');

  const credentials = Buffer.from(
    `${process.env.JPUSH_APP_KEY}:${process.env.JPUSH_MASTER_SECRET}`,
    'utf8'
  ).toString('base64');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JPUSH_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(JPUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildPushRequestBody(event, registrationIds)),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responsePayload = await parseResponse(response);

    if (!response.ok) {
      targetedTeacherIds.forEach((teacherId) => {
        teacherStatuses[String(teacherId)] = {
          status: 'failed',
          responsePayload: {
            httpStatus: response.status,
            error: responsePayload
          }
        };
      });

      const result = {
        provider: 'jpush',
        status: 'failed',
        reason: 'http_error',
        httpStatus: response.status,
        responsePayload,
        teacherStatuses
      };

      logSendResult('error', {
        status: result.status,
        reason: result.reason,
        httpStatus: result.httpStatus,
        eventType: event?.eventType || '',
        teacherCount: teacherIds.length,
        targetedTeacherCount: targetedTeacherIds.length,
        registrationIdCount: registrationIds.length
      });

      return result;
    }

    targetedTeacherIds.forEach((teacherId) => {
      teacherStatuses[String(teacherId)] = {
        status: 'sent',
        responsePayload: createSuccessResponsePayload(responsePayload, teacherId)
      };
    });

    const result = {
      provider: 'jpush',
      status: 'sent',
      responsePayload,
      teacherStatuses,
      targetedTeacherIds,
      registrationIdCount: registrationIds.length
    };

    logSendResult('info', {
      status: result.status,
      eventType: event?.eventType || '',
      teacherCount: teacherIds.length,
      targetedTeacherCount: targetedTeacherIds.length,
      registrationIdCount: registrationIds.length,
      messageId: responsePayload?.msg_id || responsePayload?.message_id || null,
      sendno: responsePayload?.sendno || null
    });

    return result;
  } catch (error) {
    targetedTeacherIds.forEach((teacherId) => {
      teacherStatuses[String(teacherId)] = {
        status: 'failed',
        responsePayload: {
          message: error.name === 'AbortError' ? 'request_timeout' : (error.message || 'request_failed')
        }
      };
    });

    const result = {
      provider: 'jpush',
      status: 'failed',
      reason: error.name === 'AbortError' ? 'request_timeout' : 'request_failed',
      responsePayload: {
        message: error.name === 'AbortError' ? 'request_timeout' : (error.message || 'request_failed')
      },
      teacherStatuses
    };

    logSendResult('error', {
      status: result.status,
      reason: result.reason,
      eventType: event?.eventType || '',
      teacherCount: teacherIds.length,
      targetedTeacherCount: targetedTeacherIds.length,
      registrationIdCount: registrationIds.length,
      message: result.responsePayload?.message || ''
    });

    return result;
  }
}

module.exports = {
  send
};
