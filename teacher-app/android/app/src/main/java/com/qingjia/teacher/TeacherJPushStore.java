package com.qingjia.teacher;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class TeacherJPushStore {
    private static final String PREFS_NAME = "teacher_jpush_bridge";
    private static final String KEY_REGISTRATION_ID = "registration_id";
    private static final String KEY_LAST_REGISTRATION_AT = "last_registration_at";
    private static final String KEY_LAST_REMOTE_NOTIFICATION_AT = "last_remote_notification_at";
    private static final String KEY_PENDING_OPEN = "pending_open";
    private static final String KEY_PENDING_REGISTRATION_UPGRADE = "pending_registration_upgrade";
    private static final String KEY_RECENT_DELIVERIES = "recent_deliveries";
    private static final String KEY_CONSENT_GRANTED = "consent_granted";
    private static final int MAX_RECENT_DELIVERIES = 60;
    private static final long RECENT_DELIVERY_TTL_MS = 48L * 60L * 60L * 1000L;

    private TeacherJPushStore() {
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static void saveRegistrationId(Context context, String registrationId) {
        if (TextUtils.isEmpty(registrationId)) {
            return;
        }

        String previousRegistrationId = getRegistrationId(context);
        long registeredAt = System.currentTimeMillis();
        getPrefs(context)
            .edit()
            .putString(KEY_REGISTRATION_ID, registrationId)
            .putLong(KEY_LAST_REGISTRATION_AT, registeredAt)
            .apply();
        if (!TextUtils.equals(previousRegistrationId, registrationId)) {
            savePendingRegistrationUpgrade(context, registrationId, registeredAt);
        }
    }

    static String getRegistrationId(Context context) {
        return getPrefs(context).getString(KEY_REGISTRATION_ID, "");
    }

    static boolean isConsentGranted(Context context) {
        return getPrefs(context).getBoolean(KEY_CONSENT_GRANTED, false);
    }

    static void setConsentGranted(Context context, boolean granted) {
        getPrefs(context).edit().putBoolean(KEY_CONSENT_GRANTED, granted).apply();
    }

    static long getLastRegistrationAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_REGISTRATION_AT, 0L);
    }

    static void markRemoteNotificationReceived(Context context) {
        getPrefs(context).edit().putLong(KEY_LAST_REMOTE_NOTIFICATION_AT, System.currentTimeMillis()).apply();
    }

    static long getLastRemoteNotificationAt(Context context) {
        return getPrefs(context).getLong(KEY_LAST_REMOTE_NOTIFICATION_AT, 0L);
    }

    static void savePendingOpen(Context context, JSONObject payload) {
        if (payload == null) {
            return;
        }

        getPrefs(context).edit().putString(KEY_PENDING_OPEN, payload.toString()).apply();
    }

    @Nullable
    static JSONObject consumePendingOpen(Context context) {
        SharedPreferences prefs = getPrefs(context);
        String raw = prefs.getString(KEY_PENDING_OPEN, "");
        prefs.edit().remove(KEY_PENDING_OPEN).apply();

        if (TextUtils.isEmpty(raw)) {
            return null;
        }

        try {
            return new JSONObject(raw);
        } catch (JSONException ignored) {
            return null;
        }
    }

    static void savePendingRegistrationUpgrade(Context context, String registrationId, long registeredAt) {
        if (TextUtils.isEmpty(registrationId)) {
            return;
        }

        JSONObject payload = new JSONObject();
        try {
            payload.put("registrationId", registrationId);
            payload.put("registeredAt", registeredAt > 0L ? registeredAt : System.currentTimeMillis());
        } catch (JSONException ignored) {
            return;
        }

        getPrefs(context).edit().putString(KEY_PENDING_REGISTRATION_UPGRADE, payload.toString()).apply();
    }

    @Nullable
    static JSONObject consumePendingRegistrationUpgrade(Context context) {
        SharedPreferences prefs = getPrefs(context);
        String raw = prefs.getString(KEY_PENDING_REGISTRATION_UPGRADE, "");
        prefs.edit().remove(KEY_PENDING_REGISTRATION_UPGRADE).apply();

        if (TextUtils.isEmpty(raw)) {
            return null;
        }

        try {
            return new JSONObject(raw);
        } catch (JSONException ignored) {
            return null;
        }
    }

    static void rememberDeliveredLeaveRequest(Context context, int leaveRequestId, String source) {
        if (leaveRequestId <= 0) {
            return;
        }

        JSONArray nextDeliveries = new JSONArray();
        long now = System.currentTimeMillis();

        try {
            JSONObject currentEntry = new JSONObject();
            currentEntry.put("leaveRequestId", leaveRequestId);
            currentEntry.put("source", TextUtils.isEmpty(source) ? "" : source);
            currentEntry.put("deliveredAt", now);
            nextDeliveries.put(currentEntry);
        } catch (JSONException ignored) {
            return;
        }

        JSONArray existingDeliveries = readRecentDeliveries(context);
        for (int index = 0; index < existingDeliveries.length() && nextDeliveries.length() < MAX_RECENT_DELIVERIES; index += 1) {
            JSONObject entry = existingDeliveries.optJSONObject(index);
            if (entry == null) {
                continue;
            }

            int existingLeaveRequestId = entry.optInt("leaveRequestId", 0);
            long deliveredAt = entry.optLong("deliveredAt", 0L);
            if (existingLeaveRequestId == leaveRequestId || deliveredAt <= 0L || now - deliveredAt > RECENT_DELIVERY_TTL_MS) {
                continue;
            }

            nextDeliveries.put(entry);
        }

        getPrefs(context).edit().putString(KEY_RECENT_DELIVERIES, nextDeliveries.toString()).apply();
    }

    static boolean hasRecentDeliveredLeaveRequest(Context context, int leaveRequestId) {
        if (leaveRequestId <= 0) {
            return false;
        }

        JSONArray recentDeliveries = readRecentDeliveries(context);
        long now = System.currentTimeMillis();
        for (int index = 0; index < recentDeliveries.length(); index += 1) {
            JSONObject entry = recentDeliveries.optJSONObject(index);
            if (entry == null) {
                continue;
            }

            if (entry.optInt("leaveRequestId", 0) != leaveRequestId) {
                continue;
            }

            long deliveredAt = entry.optLong("deliveredAt", 0L);
            if (deliveredAt > 0L && now - deliveredAt <= RECENT_DELIVERY_TTL_MS) {
                return true;
            }
        }

        return false;
    }

    private static JSONArray readRecentDeliveries(Context context) {
        String raw = getPrefs(context).getString(KEY_RECENT_DELIVERIES, "");
        if (TextUtils.isEmpty(raw)) {
            return new JSONArray();
        }

        try {
            return new JSONArray(raw);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }
}
