export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

export function safeReadJson(key, fallback = null) {
  const rawValue = safeGetItem(key);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return fallback;
  }
}
