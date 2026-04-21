import request from '../utils/request';

// 获取班级学生列表
export function getClassStudents(classCode) {
  return request.get(`/auth/student/classes/${classCode}`);
}

// 学生登录
export function studentLogin(data) {
  return request.post('/auth/student/login', data);
}

// 提交请假申请
export function submitLeave(data) {
  return request.post('/student/leave', data);
}

// 获取请假上下文
export function getLeaveContext() {
  return request.get('/student/leave/context');
}

// 获取我的请假记录
export function getMyLeaves(params) {
  return request.get('/student/leaves', { params });
}

// 获取我的课表
export function getMySchedule() {
  return request.get('/student/schedule');
}

// 获取课表请假统计
export function getScheduleStats(params) {
  return request.get('/student/schedule/stats', { params });
}

// 首次设置密码
export function setPassword(data) {
  return request.post('/student/set-password', data);
}

// 修改密码
export function changePassword(data) {
  return request.post('/student/change-password', data);
}

export function getStudentProfile() {
  return request.get('/student/profile');
}

export function getClassroomCheckContext() {
  return request.get('/student/manage/classroom-check/context');
}

export function previewClassroomCheck(data) {
  return request.post('/student/manage/classroom-check/preview', data);
}

export function submitClassroomCheck(data) {
  return request.post('/student/manage/classroom-check', data);
}
