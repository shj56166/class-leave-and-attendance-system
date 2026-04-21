const { createSocketIoChannel } = require('./channels/socketIoChannel');
const jpushChannel = require('./channels/jpushChannel');
const aliyunPushChannel = require('./channels/aliyunPushChannel');
const { TEACHER_PENDING_LEAVE_EVENT } = require('../realtime/socketServer');
const { Teacher, PushDelivery } = require('../models');

let socketIoChannel = createSocketIoChannel(null);

function configureNotificationChannels({ io }) {
  socketIoChannel = createSocketIoChannel(io);
}

function buildTeacherPendingLeaveEvent(payload) {
  return {
    eventType: TEACHER_PENDING_LEAVE_EVENT,
    classId: payload.classId,
    leaveRequestId: payload.leaveRequestId,
    studentId: payload.studentId,
    studentName: payload.studentName,
    requestMode: payload.requestMode,
    leaveType: payload.leaveType,
    startTime: payload.startTime,
    endTime: payload.endTime,
    submittedAt: payload.submittedAt,
    summaryText: payload.summaryText
  };
}

function buildDeliveryRow(event, provider, teacherId, status, responsePayload) {
  return {
    event_type: event.eventType,
    leave_request_id: event.leaveRequestId,
    teacher_id: teacherId,
    provider,
    status,
    response_payload: responsePayload,
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

async function notifyTeacherPendingLeave(payload) {
  const event = buildTeacherPendingLeaveEvent(payload);
  const teachers = await Teacher.findAll({
    where: { class_id: payload.classId },
    attributes: ['id']
  });
  const teacherIds = teachers.map((teacher) => teacher.id);

  const results = await Promise.allSettled([
    socketIoChannel.sendToTeacherClass(payload.classId, event),
    jpushChannel.send(event, { teacherIds }),
    aliyunPushChannel.send(event, { teacherIds })
  ]);

  const providers = ['socket.io', 'jpush', 'aliyun_push'];
  const deliveryRows = [];

  results.forEach((result, index) => {
    const provider = providers[index];
    const responsePayload = result.status === 'fulfilled'
      ? result.value
      : { message: result.reason?.message || 'unknown_error' };
    const status = result.status === 'fulfilled'
      ? (result.value?.status || 'sent')
      : 'failed';

    if (teacherIds.length === 0) {
      deliveryRows.push(buildDeliveryRow(event, provider, null, status, responsePayload));
      return;
    }

    teacherIds.forEach((teacherId) => {
      const teacherStatus = result.status === 'fulfilled'
        ? resolveTeacherStatus(result.value, teacherId)
        : null;

      deliveryRows.push(
        buildDeliveryRow(
          event,
          provider,
          teacherId,
          teacherStatus?.status || status,
          teacherStatus?.responsePayload || responsePayload
        )
      );
    });
  });

  if (deliveryRows.length > 0) {
    await PushDelivery.bulkCreate(deliveryRows);
  }

  return event;
}

async function dispatchDomainEventNow(eventName, payload) {
  if (eventName === TEACHER_PENDING_LEAVE_EVENT) {
    return notifyTeacherPendingLeave(payload);
  }

  return null;
}

module.exports = {
  dispatchDomainEventNow,
  notifyTeacherPendingLeave,
  configureNotificationChannels
};
