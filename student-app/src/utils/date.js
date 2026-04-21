export function normalizeApiDateTimeValue(value) {
  if (!value) {
    return '';
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00`;
  }

  return normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
}

export function parseApiDateTimeValue(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = normalizeApiDateTimeValue(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateKey(value) {
  const parsed = parseApiDateTimeValue(value);
  if (!parsed) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatApiDateTimeValue(value, options, fallback = '-') {
  if (!value) {
    return fallback;
  }

  const parsed = parseApiDateTimeValue(value);
  if (!parsed) {
    return String(value);
  }

  return new Intl.DateTimeFormat('zh-CN', options).format(parsed);
}

export function resolveLeaveRecordDate(record = {}) {
  const snakeCaseDate = String(record?.leave_date || '').trim();
  if (snakeCaseDate) {
    return snakeCaseDate;
  }

  return String(record?.leaveDate || '').trim();
}
