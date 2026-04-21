package com.qingjia.teacher;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

final class TeacherBackgroundSyncStore {
    static final String WORK_NAME_PERIODIC = "teacher_pending_leave_sync_periodic";
    static final String WORK_NAME_IMMEDIATE = "teacher_pending_leave_sync_immediate";

    private static final String PREFS_NAME = "teacher_background_sync";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SERVER_ORIGIN = "server_origin";
    private static final String KEY_AUTH_TOKEN = "auth_token";
    private static final String KEY_APP_IS_FOREGROUND = "app_is_foreground";
    private static final String KEY_LAST_RUN_AT = "last_run_at";
    private static final String KEY_LAST_SUCCESS_AT = "last_success_at";
    private static final String KEY_LAST_POLLED_AT = "last_polled_at";
    private static final String KEY_CURSOR_SUBMITTED_AT = "cursor_submitted_at";
    private static final String KEY_CURSOR_LEAVE_REQUEST_ID = "cursor_leave_request_id";
    private static final String KEY_NOTIFICATION_OWNER = "notification_owner";
    private static final String KEY_BINDING_ID = "binding_id";

    private TeacherBackgroundSyncStore() {
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static void saveConfig(
        Context context,
        boolean enabled,
        String serverOrigin,
        String authToken,
        String bindingId,
        String notificationOwner,
        String cursorSubmittedAt,
        int cursorLeaveRequestId
    ) {
        getPrefs(context)
            .edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putString(KEY_SERVER_ORIGIN, TextUtils.isEmpty(serverOrigin) ? "" : serverOrigin)
            .putString(KEY_AUTH_TOKEN, TextUtils.isEmpty(authToken) ? "" : authToken)
            .putString(KEY_BINDING_ID, TextUtils.isEmpty(bindingId) ? "" : bindingId)
            .putString(KEY_NOTIFICATION_OWNER, TextUtils.isEmpty(notificationOwner) ? "" : notificationOwner)
            .putString(KEY_CURSOR_SUBMITTED_AT, TextUtils.isEmpty(cursorSubmittedAt) ? "" : cursorSubmittedAt)
            .putInt(KEY_CURSOR_LEAVE_REQUEST_ID, Math.max(0, cursorLeaveRequestId))
            .apply();
    }

    static boolean isEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_ENABLED, false);
    }

    static boolean isConfigured(Context context) {
        return isEnabled(context)
            && !TextUtils.isEmpty(getServerOrigin(context))
            && !TextUtils.isEmpty(getAuthToken(context));
    }

    static String getServerOrigin(Context context) {
        return getPrefs(context).getString(KEY_SERVER_ORIGIN, "");
    }

    static String getAuthToken(Context context) {
        return getPrefs(context).getString(KEY_AUTH_TOKEN, "");
    }

    static void setAppForeground(Context context, boolean appIsForeground) {
        getPrefs(context).edit().putBoolean(KEY_APP_IS_FOREGROUND, appIsForeground).apply();
    }

    static boolean isAppForeground(Context context) {
        return getPrefs(context).getBoolean(KEY_APP_IS_FOREGROUND, true);
    }

    static void markRun(Context context) {
        getPrefs(context).edit().putLong(KEY_LAST_RUN_AT, System.currentTimeMillis()).apply();
    }

    static long getLastRunAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_RUN_AT, 0L);
    }

    static void markSuccess(Context context) {
        getPrefs(context).edit().putLong(KEY_LAST_SUCCESS_AT, System.currentTimeMillis()).apply();
    }

    static long getLastSuccessAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_SUCCESS_AT, 0L);
    }

    static void setLastPolledAt(Context context, long lastPolledAt) {
        getPrefs(context).edit().putLong(KEY_LAST_POLLED_AT, Math.max(0L, lastPolledAt)).apply();
    }

    static long getLastPolledAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_POLLED_AT, 0L);
    }

    static void saveCursor(Context context, String cursorSubmittedAt, int cursorLeaveRequestId) {
        getPrefs(context)
            .edit()
            .putString(KEY_CURSOR_SUBMITTED_AT, TextUtils.isEmpty(cursorSubmittedAt) ? "" : cursorSubmittedAt)
            .putInt(KEY_CURSOR_LEAVE_REQUEST_ID, Math.max(0, cursorLeaveRequestId))
            .apply();
    }

    static String getCursorSubmittedAt(Context context) {
        return getPrefs(context).getString(KEY_CURSOR_SUBMITTED_AT, "");
    }

    static int getCursorLeaveRequestId(Context context) {
        return getPrefs(context).getInt(KEY_CURSOR_LEAVE_REQUEST_ID, 0);
    }

    static String getNotificationOwner(Context context) {
        return getPrefs(context).getString(KEY_NOTIFICATION_OWNER, "");
    }

    static String getBindingId(Context context) {
        return getPrefs(context).getString(KEY_BINDING_ID, "");
    }
}
