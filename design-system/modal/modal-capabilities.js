const BLUR_CLASS = 'ui-can-blur';
const NO_BLUR_CLASS = 'ui-no-blur';
const REDUCED_MOTION_CLASS = 'ui-reduced-motion';
const USER_DISABLE_BLUR_CLASS = 'ui-user-disable-blur';
const USER_REDUCE_EFFECTS_CLASS = 'ui-user-reduce-effects';

export const TEACHER_UI_PREFERENCES_STORAGE_KEY = 'teacher_ui_preferences';

function normalizePreferences(value) {
  return {
    reduceEffects: Boolean(value?.reduceEffects)
  };
}

function canUseBlur() {
  if (typeof window === 'undefined' || typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }

  return CSS.supports('backdrop-filter: blur(1px)') || CSS.supports('-webkit-backdrop-filter: blur(1px)');
}

function updateBlurClass(root) {
  const blurSupported = canUseBlur();
  root.classList.toggle(BLUR_CLASS, blurSupported);
  root.classList.toggle(NO_BLUR_CLASS, !blurSupported);
}

function bindReducedMotion(root) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const applyReducedMotion = () => {
    root.classList.toggle(REDUCED_MOTION_CLASS, mediaQuery.matches);
  };

  applyReducedMotion();

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', applyReducedMotion);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(applyReducedMotion);
  }
}

export function readStoredUiPreferences() {
  if (typeof localStorage === 'undefined') {
    return normalizePreferences();
  }

  try {
    const rawValue = localStorage.getItem(TEACHER_UI_PREFERENCES_STORAGE_KEY);

    if (!rawValue) {
      return normalizePreferences();
    }

    return normalizePreferences(JSON.parse(rawValue));
  } catch (error) {
    return normalizePreferences();
  }
}

export function syncModalPreferenceClasses(preferences) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const normalized = normalizePreferences(preferences);

  root.classList.toggle(USER_REDUCE_EFFECTS_CLASS, normalized.reduceEffects);
  root.classList.toggle(USER_DISABLE_BLUR_CLASS, normalized.reduceEffects);
}

export function setupModalCapabilities() {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  updateBlurClass(root);
  bindReducedMotion(root);
  syncModalPreferenceClasses(readStoredUiPreferences());
}
