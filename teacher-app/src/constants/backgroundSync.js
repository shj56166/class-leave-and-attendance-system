export const TEACHER_BACKGROUND_SYNC_WINDOWS = [
  {
    id: 'morning',
    label: '早间兜底',
    start: '07:00',
    end: '08:30'
  },
  {
    id: 'afternoon',
    label: '午后兜底',
    start: '14:00',
    end: '15:30'
  }
];

export function formatTeacherBackgroundSyncWindows() {
  return TEACHER_BACKGROUND_SYNC_WINDOWS
    .map((window) => `${window.label} ${window.start}-${window.end}`)
    .join(' / ');
}
