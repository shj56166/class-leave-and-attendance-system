const { TEACHER_PENDING_LEAVE_EVENT } = require('../realtime/socketServer');

function getRequestModeSummaryText(requestMode) {
  return requestMode === 'today' ? '当天请假' : '请假申请';
}

function getLeaveTypeSummaryText(leaveType) {
  return {
    sick: '病假',
    personal: '事假',
    other: '请假'
  }[leaveType] || '请假';
}

function buildPendingLeaveSummaryText({ studentName, requestMode, leaveType }) {
  const normalizedStudentName = studentName || '有学生';
  return `${normalizedStudentName}提交了${getLeaveTypeSummaryText(leaveType)}${getRequestModeSummaryText(requestMode)}`;
}

function buildTeacherPendingLeavePayload({ leaveRequest, classId, studentId, studentName }) {
  return {
    eventType: TEACHER_PENDING_LEAVE_EVENT,
    classId: leaveRequest.class_id || classId,
    leaveRequestId: leaveRequest.id,
    studentId: leaveRequest.student_id || studentId,
    studentName: studentName || leaveRequest.student_name_snapshot || '',
    requestMode: leaveRequest.request_mode,
    leaveType: leaveRequest.leave_type,
    startTime: leaveRequest.start_time,
    endTime: leaveRequest.end_time,
    submittedAt: leaveRequest.submitted_at,
    summaryText: buildPendingLeaveSummaryText({
      studentName: studentName || leaveRequest.student_name_snapshot || '',
      requestMode: leaveRequest.request_mode,
      leaveType: leaveRequest.leave_type
    })
  };
}

module.exports = {
  buildPendingLeaveSummaryText,
  buildTeacherPendingLeavePayload
};
