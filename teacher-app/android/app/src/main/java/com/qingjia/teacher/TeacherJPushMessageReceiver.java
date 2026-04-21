package com.qingjia.teacher;

import android.content.Context;
import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import cn.jpush.android.api.CmdMessage;
import cn.jpush.android.api.CustomMessage;
import cn.jpush.android.api.NotificationMessage;
import cn.jpush.android.service.JPushMessageReceiver;

public class TeacherJPushMessageReceiver extends JPushMessageReceiver {
    private static final String TAG = "TeacherJPushReceiver";
    private static final String DEFAULT_EVENT_TYPE = "teacher.leave.pending.created";
    private static final String DEFAULT_ROUTE = "/dashboard/approval";

    @Override
    public void onRegister(Context context, String registrationId) {
        Log.i(TAG, "JPush registration updated: " + registrationId);
        TeacherJPushStore.saveRegistrationId(context, registrationId);
        TeacherJPushPlugin.dispatchRegistrationUpdated(context, registrationId);
    }

    @Override
    public void onMessage(Context context, CustomMessage customMessage) {
        Log.d(TAG, "Received custom JPush message: " + String.valueOf(customMessage));
    }

    @Override
    public void onNotifyMessageArrived(Context context, NotificationMessage message) {
        TeacherJPushStore.markRemoteNotificationReceived(context);
        TeacherJPushStore.rememberDeliveredLeaveRequest(context, extractLeaveRequestId(message), "jpush_remote");
        Log.d(TAG, "JPush notification arrived: " + String.valueOf(message));
    }

    @Override
    public void onNotifyMessageOpened(Context context, NotificationMessage message) {
        Log.i(TAG, "JPush notification opened.");
        TeacherJPushStore.markRemoteNotificationReceived(context);
        TeacherJPushStore.savePendingOpen(context, buildOpenPayload(message));
        openMainActivity(context);
    }

    @Override
    public void onNotifyMessageDismiss(Context context, NotificationMessage message) {
        Log.d(TAG, "JPush notification dismissed: " + String.valueOf(message));
    }

    @Override
    public void onCommandResult(Context context, CmdMessage cmdMessage) {
        Log.d(TAG, "JPush command result: " + String.valueOf(cmdMessage));
    }

    private void openMainActivity(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        context.startActivity(intent);
    }

    private JSONObject buildOpenPayload(NotificationMessage message) {
        JSONObject payload = new JSONObject();
        JSONObject extras = parseExtras(message == null ? "" : message.notificationExtras);

        try {
            payload.put("source", optString(extras, "source", "jpush_remote"));
            payload.put("eventType", optString(extras, "eventType", DEFAULT_EVENT_TYPE));
            payload.put("route", optString(extras, "route", DEFAULT_ROUTE));
            payload.put("summaryText", optString(extras, "summaryText", message == null ? "" : message.notificationContent));
            payload.put("studentName", optString(extras, "studentName", ""));
            payload.put("requestMode", optString(extras, "requestMode", ""));
            payload.put("leaveType", optString(extras, "leaveType", ""));
            payload.put("startTime", optString(extras, "startTime", ""));
            payload.put("endTime", optString(extras, "endTime", ""));
            payload.put("submittedAt", optString(extras, "submittedAt", ""));

            int leaveRequestId = optInt(extras, "leaveRequestId");
            if (leaveRequestId > 0) {
                payload.put("leaveRequestId", leaveRequestId);
            }

            int classId = optInt(extras, "classId");
            if (classId > 0) {
                payload.put("classId", classId);
            }

            int studentId = optInt(extras, "studentId");
            if (studentId > 0) {
                payload.put("studentId", studentId);
            }
        } catch (JSONException error) {
            Log.w(TAG, "Failed to build notification open payload.", error);
        }

        return payload;
    }

    private JSONObject parseExtras(String rawExtras) {
        if (TextUtils.isEmpty(rawExtras)) {
            return new JSONObject();
        }

        try {
            return new JSONObject(rawExtras);
        } catch (JSONException ignored) {
            return new JSONObject();
        }
    }

    private String optString(JSONObject source, String key, String fallback) {
        String value = source.optString(key, fallback);
        return TextUtils.isEmpty(value) ? fallback : value;
    }

    private int optInt(JSONObject source, String key) {
        return source.optInt(key, 0);
    }

    private int extractLeaveRequestId(NotificationMessage message) {
        JSONObject extras = parseExtras(message == null ? "" : message.notificationExtras);
        return optInt(extras, "leaveRequestId");
    }
}
