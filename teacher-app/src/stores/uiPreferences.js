import { defineStore } from 'pinia';
import {
  TEACHER_UI_PREFERENCES_STORAGE_KEY,
  readStoredUiPreferences,
  syncModalPreferenceClasses
} from '../../../design-system/modal/modal-capabilities';

function persistPreferences(preferences) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(
    TEACHER_UI_PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      reduceEffects: Boolean(preferences.reduceEffects)
    })
  );
}

export const useUiPreferencesStore = defineStore('teacher-ui-preferences', {
  state: () => ({
    reduceEffects: false,
    initialized: false
  }),

  actions: {
    initialize() {
      if (this.initialized) {
        return;
      }

      const preferences = readStoredUiPreferences();
      this.reduceEffects = preferences.reduceEffects;
      this.initialized = true;
      syncModalPreferenceClasses(preferences);
    },

    syncPreferences() {
      const preferences = {
        reduceEffects: this.reduceEffects
      };

      persistPreferences(preferences);
      syncModalPreferenceClasses(preferences);
    },

    setReduceEffects(value) {
      this.reduceEffects = Boolean(value);
      this.syncPreferences();
    }
  }
});
