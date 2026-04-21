package com.qingjia.teacher;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

final class TeacherLocalReminderScheduler {
    static final String ACTION_TRIGGER = "com.qingjia.teacher.action.LOCAL_APPROVAL_REMINDER";

    private static final int ALARM_REQUEST_CODE = 74040;
    private static final int NOTIFICATION_ID = 74040;
    private static final String NOTIFICATION_CHANNEL_ID = "teacher_pending_approval";
    private static final String NOTIFICATION_CHANNEL_NAME = "\u6559\u5e08\u5f85\u5ba1\u6279\u63d0\u9192";
    private static final String NOTIFICATION_CHANNEL_DESCRIPTION = "\u6559\u5e08\u6bcf\u65e57\u70b940\u672c\u5730\u5ba1\u6279\u63d0\u9192";
    private static final String NOTIFICATION_TITLE = "\u8bf7\u5047\u5ba1\u6279";
    private static final String NOTIFICATION_BODY = "\u6253\u5f00APP\u67e5\u770b\u4eca\u65e5\u5ba1\u6279\u53ca\u62a5\u5907";
    private static final String NOTIFICATION_SOURCE = "local_daily_approval_reminder";

    private TeacherLocalReminderScheduler() {
    }

    static void scheduleNext(Context context) {
        if (context == null) {
            return;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pendingIntent = buildAlarmPendingIntent(context);

        if (alarmManager == null) {
            TeacherLocalReminderStore.setNextTriggerAt(context, 0L);
            return;
        }

        if (!TeacherLocalReminderStore.isConfigured(context)) {
            alarmManager.cancel(pendingIntent);
            TeacherLocalReminderStore.setNextTriggerAt(context, 0L);
            return;
        }

        long nextTriggerAt = computeNextTriggerAt(System.currentTimeMillis(), TeacherLocalReminderStore.getReminderTime(context));
        TeacherLocalReminderStore.setNextTriggerAt(context, nextTriggerAt);
        alarmManager.cancel(pendingIntent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTriggerAt, pendingIntent);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTriggerAt, pendingIntent);
            return;
        }

        alarmManager.set(AlarmManager.RTC_WAKEUP, nextTriggerAt, pendingIntent);
    }

    static void cancel(Context context) {
        if (context == null) {
            return;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(buildAlarmPendingIntent(context));
        }
        TeacherLocalReminderStore.setNextTriggerAt(context, 0L);
    }

    static void handleAlarmTrigger(Context context) {
        if (context == null) {
            return;
        }

        long now = System.currentTimeMillis();
        TeacherLocalReminderStore.setLastTriggeredAt(context, now);

        if (!TeacherLocalReminderStore.isConfigured(context)) {
            cancel(context);
            return;
        }

        maybeShowReminderNotification(context, now);
        scheduleNext(context);
    }

    private static void maybeShowReminderNotification(Context context, long now) {
        String dateKey = formatDateKey(now);
        if (dateKey.equals(TeacherLocalReminderStore.getLastNotifiedDate(context))) {
            return;
        }

        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return;
        }

        if (!shouldNotifyToday(context, now)) {
            return;
        }

        createNotificationChannel(context);

        JSONObject payload = new JSONObject();
        try {
            payload.put("source", NOTIFICATION_SOURCE);
            payload.put("route", TeacherLocalReminderStore.getRoute(context));
            payload.put("summaryText", NOTIFICATION_BODY);
        } catch (JSONException ignored) {
            // Ignore malformed local reminder payloads.
        }

        PendingIntent openIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            TeacherNotificationIntents.buildOpenIntent(context, payload),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(NOTIFICATION_TITLE)
            .setContentText(NOTIFICATION_BODY)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(NOTIFICATION_BODY))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openIntent);

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        TeacherLocalReminderStore.markNotified(context, now, dateKey);
    }

    private static boolean shouldNotifyToday(Context context, long now) {
        String rawBundle = TeacherLocalReminderStore.getScheduleBundleJson(context);
        if (TextUtils.isEmpty(rawBundle)) {
            return isWorkday(now);
        }

        try {
            JSONObject bundle = new JSONObject(rawBundle);
            JSONArray schedules = bundle.optJSONArray("schedules");
            if (schedules == null) {
                return isWorkday(now);
            }

            JSONArray specialDates = bundle.optJSONArray("specialDates");
            DayDecision decision = resolveDayDecision(now, specialDates);
            if (!decision.useScheduleBundle) {
                return isWorkday(now);
            }

            if (!decision.isWorkday || decision.effectiveWeekday < 1 || decision.effectiveWeekday > 7) {
                return false;
            }

            return hasScheduleForWeekday(schedules, decision.effectiveWeekday);
        } catch (JSONException error) {
            return isWorkday(now);
        }
    }

    private static boolean hasScheduleForWeekday(JSONArray schedules, int weekday) {
        for (int index = 0; index < schedules.length(); index += 1) {
            JSONObject item = schedules.optJSONObject(index);
            if (item == null) {
                continue;
            }

            if (item.optInt("weekday", 0) != weekday) {
                continue;
            }

            String subject = String.valueOf(item.optString("subject", "")).trim();
            if (!TextUtils.isEmpty(subject)) {
                return true;
            }
        }

        return false;
    }

    private static DayDecision resolveDayDecision(long now, JSONArray specialDates) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        int currentWeekday = normalizeWeekday(calendar.get(Calendar.DAY_OF_WEEK));
        String dateKey = formatDateKey(now);

        if (specialDates != null) {
            for (int index = 0; index < specialDates.length(); index += 1) {
                JSONObject item = specialDates.optJSONObject(index);
                if (item == null || !dateKey.equals(item.optString("date", ""))) {
                    continue;
                }

                int targetWeekday = resolveTargetWeekday(item, currentWeekday);
                if (targetWeekday < 1 || targetWeekday > 7) {
                    return new DayDecision(true, false, 0);
                }

                return new DayDecision(true, true, targetWeekday);
            }
        }

        boolean isWorkday = currentWeekday >= 1 && currentWeekday <= 5;
        return new DayDecision(true, isWorkday, isWorkday ? currentWeekday : 0);
    }

    private static int resolveTargetWeekday(JSONObject specialDate, int currentWeekday) {
        int explicitTargetWeekday = optWeekday(specialDate, "targetWeekday");
        if (explicitTargetWeekday > 0) {
            return explicitTargetWeekday;
        }

        explicitTargetWeekday = optWeekday(specialDate, "target_weekday");
        if (explicitTargetWeekday > 0) {
            return explicitTargetWeekday;
        }

        return "workday_override".equals(specialDate.optString("type", "")) ? currentWeekday : 0;
    }

    private static int optWeekday(JSONObject value, String key) {
        if (value == null || !value.has(key)) {
            return 0;
        }

        int weekday = value.optInt(key, 0);
        return weekday >= 1 && weekday <= 7 ? weekday : 0;
    }

    private static int normalizeWeekday(int calendarDayOfWeek) {
        return calendarDayOfWeek == Calendar.SUNDAY ? 7 : calendarDayOfWeek - 1;
    }

    private static boolean isWorkday(long now) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        int weekday = normalizeWeekday(calendar.get(Calendar.DAY_OF_WEEK));
        return weekday >= 1 && weekday <= 5;
    }

    private static long computeNextTriggerAt(long now, String reminderTime) {
        String[] parts = String.valueOf(reminderTime).split(":");
        int hour = 7;
        int minute = 40;

        try {
            if (parts.length == 2) {
                hour = Integer.parseInt(parts[0]);
                minute = Integer.parseInt(parts[1]);
            }
        } catch (NumberFormatException ignored) {
            hour = 7;
            minute = 40;
        }

        Calendar target = Calendar.getInstance();
        target.setTimeInMillis(now);
        target.set(Calendar.HOUR_OF_DAY, hour);
        target.set(Calendar.MINUTE, minute);
        target.set(Calendar.SECOND, 0);
        target.set(Calendar.MILLISECOND, 0);

        if (target.getTimeInMillis() <= now) {
            target.add(Calendar.DAY_OF_YEAR, 1);
        }

        return target.getTimeInMillis();
    }

    private static String formatDateKey(long timestamp) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return formatter.format(new Date(timestamp));
    }

    private static PendingIntent buildAlarmPendingIntent(Context context) {
        Intent intent = new Intent(context, TeacherLocalReminderReceiver.class);
        intent.setAction(ACTION_TRIGGER);
        return PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(NOTIFICATION_CHANNEL_DESCRIPTION);

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.createNotificationChannel(channel);
        }
    }

    private static final class DayDecision {
        final boolean useScheduleBundle;
        final boolean isWorkday;
        final int effectiveWeekday;

        DayDecision(boolean useScheduleBundle, boolean isWorkday, int effectiveWeekday) {
            this.useScheduleBundle = useScheduleBundle;
            this.isWorkday = isWorkday;
            this.effectiveWeekday = effectiveWeekday;
        }
    }
}
