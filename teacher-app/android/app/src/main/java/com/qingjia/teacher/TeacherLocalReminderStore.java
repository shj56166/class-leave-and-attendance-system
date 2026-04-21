package com.qingjia.teacher;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

final class TeacherLocalReminderStore {
    static final String DEFAULT_REMINDER_TIME = "07:40";
    static final String DEFAULT_ROUTE = "/dashboard/approval";

    private static final String PREFS_NAME = "teacher_local_reminder";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_REMINDER_TIME = "reminder_time";
    private static final String KEY_ROUTE = "route";
    private static final String KEY_TEACHER_ID = "teacher_id";
    private static final String KEY_SCHEDULE_BUNDLE_JSON = "schedule_bundle_json";
    private static final String KEY_LAST_SCHEDULE_SYNC_AT = "last_schedule_sync_at";
    private static final String KEY_NEXT_TRIGGER_AT = "next_trigger_at";
    private static final String KEY_LAST_TRIGGERED_AT = "last_triggered_at";
    private static final String KEY_LAST_NOTIFIED_AT = "last_notified_at";
    private static final String KEY_LAST_NOTIFIED_DATE = "last_notified_date";

    private TeacherLocalReminderStore() {
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static void saveConfig(
        Context context,
        boolean enabled,
        String reminderTime,
        String route,
        String teacherId,
        String scheduleBundleJson,
        long lastScheduleSyncAt,
        boolean updateScheduleBundle
    ) {
        SharedPreferences.Editor editor = getPrefs(context)
            .edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putString(KEY_REMINDER_TIME, normalizeReminderTime(reminderTime))
            .putString(KEY_ROUTE, TextUtils.isEmpty(route) ? DEFAULT_ROUTE : route.trim())
            .putString(KEY_TEACHER_ID, TextUtils.isEmpty(teacherId) ? "" : teacherId.trim());

        if (updateScheduleBundle) {
            editor
                .putString(KEY_SCHEDULE_BUNDLE_JSON, TextUtils.isEmpty(scheduleBundleJson) ? "" : scheduleBundleJson)
                .putLong(KEY_LAST_SCHEDULE_SYNC_AT, Math.max(0L, lastScheduleSyncAt));
        }

        editor.apply();
    }

    static boolean isEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_ENABLED, false);
    }

    static boolean isConfigured(Context context) {
        return isEnabled(context) && !TextUtils.isEmpty(getTeacherId(context));
    }

    static String getReminderTime(Context context) {
        return normalizeReminderTime(getPrefs(context).getString(KEY_REMINDER_TIME, DEFAULT_REMINDER_TIME));
    }

    static String getRoute(Context context) {
        return getPrefs(context).getString(KEY_ROUTE, DEFAULT_ROUTE);
    }

    static String getTeacherId(Context context) {
        return getPrefs(context).getString(KEY_TEACHER_ID, "");
    }

    static String getScheduleBundleJson(Context context) {
        return getPrefs(context).getString(KEY_SCHEDULE_BUNDLE_JSON, "");
    }

    static long getLastScheduleSyncAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_SCHEDULE_SYNC_AT, 0L);
    }

    static void setNextTriggerAt(Context context, long nextTriggerAt) {
        getPrefs(context).edit().putLong(KEY_NEXT_TRIGGER_AT, Math.max(0L, nextTriggerAt)).apply();
    }

    static long getNextTriggerAt(Context context) {
        return getPrefs(context).getLong(KEY_NEXT_TRIGGER_AT, 0L);
    }

    static void setLastTriggeredAt(Context context, long lastTriggeredAt) {
        getPrefs(context).edit().putLong(KEY_LAST_TRIGGERED_AT, Math.max(0L, lastTriggeredAt)).apply();
    }

    static long getLastTriggeredAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_TRIGGERED_AT, 0L);
    }

    static void markNotified(Context context, long notifiedAt, String dateKey) {
        getPrefs(context)
            .edit()
            .putLong(KEY_LAST_NOTIFIED_AT, Math.max(0L, notifiedAt))
            .putString(KEY_LAST_NOTIFIED_DATE, TextUtils.isEmpty(dateKey) ? "" : dateKey)
            .apply();
    }

    static long getLastNotifiedAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_NOTIFIED_AT, 0L);
    }

    static String getLastNotifiedDate(Context context) {
        return getPrefs(context).getString(KEY_LAST_NOTIFIED_DATE, "");
    }

    private static String normalizeReminderTime(String reminderTime) {
        String value = TextUtils.isEmpty(reminderTime) ? DEFAULT_REMINDER_TIME : reminderTime.trim();
        if (!value.matches("^\\d{2}:\\d{2}$")) {
            return DEFAULT_REMINDER_TIME;
        }

        String[] parts = value.split(":");
        int hour;
        int minute;

        try {
            hour = Integer.parseInt(parts[0]);
            minute = Integer.parseInt(parts[1]);
        } catch (NumberFormatException error) {
            return DEFAULT_REMINDER_TIME;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            return DEFAULT_REMINDER_TIME;
        }

        return String.format(java.util.Locale.US, "%02d:%02d", hour, minute);
    }
}
