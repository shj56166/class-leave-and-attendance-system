import request from '../utils/request';

const BACKUP_OPERATION_TIMEOUT = 5 * 60 * 1000;

export function teacherLogin(data) {
  return request.post('/auth/teacher/login', data);
}

export function getCurrentTeacher() {
  return request.get('/auth/teacher/me');
}

export function registerPushDevice(data, config = {}) {
  return request.post('/teacher/push-devices/register', data, {
    silentError: true,
    ...config
  });
}

export function unregisterPushDevice(data, config = {}) {
  return request.post('/teacher/push-devices/unregister', data, {
    silentError: true,
    ...config
  });
}

export function getPendingNotificationEvents(params = {}, config = {}) {
  return request.get('/teacher/notifications/pending-events', {
    params,
    silentError: true,
    ...config
  });
}

export function getPushDeviceStatus() {
  return request.get('/teacher/push-devices/status', {
    silentError: true
  });
}

export function sendTestJpushNotification() {
  return request.post('/teacher/push-devices/test-jpush', {}, {
    silentError: true
  });
}

export function exportDatabaseBackup() {
  return request.get('/teacher/backups/export', {
    responseType: 'blob',
    silentError: true,
    timeout: BACKUP_OPERATION_TIMEOUT
  });
}

export function previewDatabaseBackupImport(data) {
  return request.post('/teacher/backups/import/preview', data, {
    timeout: BACKUP_OPERATION_TIMEOUT
  });
}

export function replaceDatabaseFromPreview(data) {
  return request.post('/teacher/backups/import/replace', data, {
    timeout: BACKUP_OPERATION_TIMEOUT
  });
}

export function deleteBackupPreview(previewId) {
  return request.delete(`/teacher/backups/import/preview/${previewId}`);
}

export function getBackupStatus() {
  return request.get('/teacher/backups/status');
}

export function getBackupSettings() {
  return request.get('/teacher/backups/settings');
}

export function updateBackupSettings(data) {
  return request.put('/teacher/backups/settings', data);
}

export function getPendingLeaves(config = {}) {
  return request.get('/teacher/leaves/pending', config);
}

export function approveLeave(id, data) {
  return request.put(`/teacher/leaves/${id}/approve`, data);
}

export function getLeaves(params) {
  return request.get('/teacher/leaves', { params });
}

export function getLeaveHistory(params) {
  return request.get('/teacher/leaves/history', { params });
}

export function getStudents() {
  return request.get('/teacher/students');
}

export function addStudent(data) {
  return request.post('/teacher/students', data);
}

export function updateStudent(id, data) {
  return request.put(`/teacher/students/${id}`, data);
}

export function deleteStudent(id) {
  return request.delete(`/teacher/students/${id}`);
}

export function getDormitories() {
  return request.get('/teacher/dormitories');
}

export function createDormitory(data) {
  return request.post('/teacher/dormitories', data);
}

export function updateDormitory(id, data) {
  return request.put(`/teacher/dormitories/${id}`, data);
}

export function deleteDormitory(id) {
  return request.delete(`/teacher/dormitories/${id}`);
}

export function assignDormitoryStudents(id, data) {
  return request.put(`/teacher/dormitories/${id}/students`, data);
}

export function getSchedules() {
  return request.get('/teacher/schedules', {
    silentError: true
  });
}

export function updateSchedules(data) {
  return request.post('/teacher/schedules', data, {
    silentError: true
  });
}

export function updateSpecialDates(data) {
  return request.put('/teacher/special-dates', data, {
    silentError: true
  });
}

export function getCounselorPanel(params) {
  return request.get('/statistics/counselor-panel', {
    params,
    silentError: true
  });
}

export function getClassroomCheckHistory(params) {
  return request.get('/statistics/classroom-checks', {
    params,
    silentError: true
  });
}

export function getOverviewStatistics(params) {
  return request.get('/statistics/overview', {
    params,
    silentError: true
  });
}

export function getStudentOverviewStatistics(params) {
  return request.get('/statistics/student-overview', {
    params,
    silentError: true
  });
}

export function getIntegratedRecords(params) {
  return request.get('/statistics/records', {
    params,
    silentError: true
  });
}

export function getWeekStats() {
  return request.get('/statistics/week');
}

export function getMonthStats() {
  return request.get('/statistics/month');
}

export function getSemesterStats() {
  return request.get('/statistics/semester');
}

export function exportStats(params) {
  return request.get('/statistics/export-integrated', {
    params,
    responseType: 'blob',
    silentError: true
  });
}

export function getAuditLogs(params) {
  return request.get('/audit-logs', { params });
}

export function getAuditActions() {
  return request.get('/audit-logs/actions');
}

export function getLoginWindowStatus() {
  return request.get('/teacher/class/login-window');
}

export function toggleLoginWindow(open) {
  return request.post('/teacher/class/login-window', { open });
}

export function getStudentsEnhanced() {
  return request.get('/teacher/students/enhanced');
}

export function resetStudent(id) {
  return request.post(`/teacher/students/${id}/reset`);
}

export function getStudentLoginLogs(id, params) {
  return request.get(`/teacher/students/${id}/login-logs`, { params });
}
