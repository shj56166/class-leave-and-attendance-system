package com.qingjia.teacher;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Build;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class TeacherPendingLeaveSyncWorker extends Worker {
    private static final String NOTIFICATION_CHANNEL_ID = "teacher_pending_approval";
    private static final String NOTIFICATION_CHANNEL_NAME = "教师待审批提醒";
    private static final String DEFAULT_ROUTE = "/dashboard/approval";
    private static final String DEFAULT_EVENT_TYPE = "teacher.leave.pending.created";
    private static final String SOURCE = "background_sync";
    private static final String NOTIFICATION_OWNER_LOCAL_FALLBACK = "local_fallback";
    private static final int MORNING_START_MINUTES = 7 * 60;
    private static final int MORNING_END_MINUTES = 8 * 60 + 30;
    private static final int AFTERNOON_START_MINUTES = 14 * 60;
    private static final int AFTERNOON_END_MINUTES = 15 * 60 + 30;

    public TeacherPendingLeaveSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        TeacherBackgroundSyncStore.markRun(context);

        if (!TeacherBackgroundSyncStore.isConfigured(context)) {
            return Result.success();
        }

        if (TeacherBackgroundSyncStore.isAppForeground(context)) {
            return Result.success();
        }

        if (!isWithinFallbackWindow()) {
            TeacherBackgroundSyncStore.setLastPolledAt(context, System.currentTimeMillis());
            TeacherBackgroundSyncStore.markSuccess(context);
            return Result.success();
        }

        try {
            boolean allowLocalNotifications = shouldUseLocalFallbackNotifications(context);
            JSONObject response = fetchPendingEvents(context);
            updateCursor(context, response);

            JSONArray events = response.optJSONArray("events");
            if (events == null) {
                TeacherBackgroundSyncStore.markSuccess(context);
                return Result.success();
            }

            if (allowLocalNotifications) {
                createNotificationChannel(context);
            }

            for (int index = 0; index < events.length(); index += 1) {
                JSONObject event = events.optJSONObject(index);
                if (event == null) {
                    continue;
                }

                int leaveRequestId = event.optInt("leaveRequestId", 0);
                if (TeacherJPushStore.hasRecentDeliveredLeaveRequest(context, leaveRequestId)) {
                    continue;
                }

                if (allowLocalNotifications) {
                    showLocalNotification(context, event, leaveRequestId);
                    TeacherJPushStore.rememberDeliveredLeaveRequest(context, leaveRequestId, SOURCE);
                }
            }

            TeacherBackgroundSyncStore.markSuccess(context);
            return Result.success();
        } catch (Exception error) {
            return Result.retry();
        }
    }

    private JSONObject fetchPendingEvents(Context context) throws Exception {
        String serverOrigin = TeacherBackgroundSyncStore.getServerOrigin(context);
        String authToken = TeacherBackgroundSyncStore.getAuthToken(context);
        String cursorSubmittedAt = TeacherBackgroundSyncStore.getCursorSubmittedAt(context);
        int cursorLeaveRequestId = TeacherBackgroundSyncStore.getCursorLeaveRequestId(context);

        if (TextUtils.isEmpty(cursorSubmittedAt)) {
            cursorSubmittedAt = formatIsoTimestamp(System.currentTimeMillis() - 20L * 60L * 1000L);
        }

        String requestUrl = serverOrigin + "/api/teacher/notifications/pending-events?cursorSubmittedAt="
            + URLEncoder.encode(cursorSubmittedAt, StandardCharsets.UTF_8.name())
            + "&cursorLeaveRequestId="
            + URLEncoder.encode(String.valueOf(Math.max(0, cursorLeaveRequestId)), StandardCharsets.UTF_8.name());

        HttpURLConnection connection = (HttpURLConnection) new URL(requestUrl).openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + authToken);

        try {
            int responseCode = connection.getResponseCode();
            InputStream inputStream = responseCode >= 200 && responseCode < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            String responseText = readFully(inputStream);

            if (responseCode < 200 || responseCode >= 300) {
                throw new IllegalStateException("Background sync request failed: " + responseCode + " " + responseText);
            }

            return new JSONObject(TextUtils.isEmpty(responseText) ? "{}" : responseText);
        } finally {
            connection.disconnect();
        }
    }

    private void showLocalNotification(Context context, JSONObject event, int leaveRequestId) {
        int notificationId = leaveRequestId > 0 ? leaveRequestId : (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        JSONObject openPayload = buildOpenPayload(event, leaveRequestId);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            TeacherNotificationIntents.buildOpenIntent(context, openPayload),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(resolveNotificationTitle(event))
            .setContentText(resolveNotificationBody(event))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(resolveNotificationBody(event)))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    private JSONObject buildOpenPayload(JSONObject event, int leaveRequestId) {
        JSONObject payload = new JSONObject();

        try {
            payload.put("source", SOURCE);
            payload.put("eventType", event.optString("eventType", DEFAULT_EVENT_TYPE));
            payload.put("route", event.optString("route", DEFAULT_ROUTE));
            payload.put("summaryText", event.optString("summaryText", ""));
            payload.put("studentName", event.optString("studentName", ""));
            payload.put("requestMode", event.optString("requestMode", ""));
            payload.put("leaveType", event.optString("leaveType", ""));
            payload.put("startTime", event.optString("startTime", ""));
            payload.put("endTime", event.optString("endTime", ""));
            payload.put("submittedAt", event.optString("submittedAt", ""));

            if (leaveRequestId > 0) {
                payload.put("leaveRequestId", leaveRequestId);
            }

            int classId = event.optInt("classId", 0);
            if (classId > 0) {
                payload.put("classId", classId);
            }

            int studentId = event.optInt("studentId", 0);
            if (studentId > 0) {
                payload.put("studentId", studentId);
            }
        } catch (JSONException ignored) {
            // Ignore malformed pending-open payloads.
        }

        return payload;
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("学生提交待审批请假时的后台兜底提醒");

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.createNotificationChannel(channel);
        }
    }

    private String resolveNotificationTitle(JSONObject event) {
        String studentName = event.optString("studentName", "");
        return TextUtils.isEmpty(studentName)
            ? "有新的待审批请假"
            : studentName + " 提交了新的待审批请假";
    }

    private String resolveNotificationBody(JSONObject event) {
        String summaryText = event.optString("summaryText", "");
        return TextUtils.isEmpty(summaryText) ? "有新的待审批请假" : summaryText;
    }

    private boolean shouldUseLocalFallbackNotifications(Context context) {
        return NOTIFICATION_OWNER_LOCAL_FALLBACK.equals(TeacherBackgroundSyncStore.getNotificationOwner(context));
    }

    private boolean isWithinFallbackWindow() {
        Calendar calendar = Calendar.getInstance();
        int minutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE);
        return isMinutesInWindow(minutes, MORNING_START_MINUTES, MORNING_END_MINUTES)
            || isMinutesInWindow(minutes, AFTERNOON_START_MINUTES, AFTERNOON_END_MINUTES);
    }

    private boolean isMinutesInWindow(int minutes, int startMinutes, int endMinutes) {
        return minutes >= startMinutes && minutes <= endMinutes;
    }

    private void updateCursor(Context context, JSONObject response) {
        JSONObject nextCursor = response == null ? null : response.optJSONObject("nextCursor");
        if (nextCursor == null) {
            return;
        }

        String cursorSubmittedAt = nextCursor.optString("submittedAt", "");
        int cursorLeaveRequestId = nextCursor.optInt("leaveRequestId", 0);
        TeacherBackgroundSyncStore.saveCursor(context, cursorSubmittedAt, cursorLeaveRequestId);
        TeacherBackgroundSyncStore.setLastPolledAt(context, System.currentTimeMillis());
    }

    private String formatIsoTimestamp(long timestamp) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US);
        return formatter.format(new Date(timestamp));
    }

    private String readFully(InputStream inputStream) throws Exception {
        if (inputStream == null) {
            return "";
        }

        try (InputStream stream = inputStream; ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[2048];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
            }
            return outputStream.toString(StandardCharsets.UTF_8.name());
        }
    }
}
