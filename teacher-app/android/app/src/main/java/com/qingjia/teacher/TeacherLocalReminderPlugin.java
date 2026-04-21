package com.qingjia.teacher;

import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TeacherLocalReminder")
public class TeacherLocalReminderPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void syncConfig(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        String reminderTime = call.getString("reminderTime", TeacherLocalReminderStore.DEFAULT_REMINDER_TIME);
        String route = call.getString("route", TeacherLocalReminderStore.DEFAULT_ROUTE);
        String teacherId = call.getString("teacherId", TeacherLocalReminderStore.getTeacherId(getContext()));
        boolean hasScheduleBundle = call.getData() != null && call.getData().has("scheduleBundle");
        JSObject scheduleBundle = hasScheduleBundle ? call.getObject("scheduleBundle") : null;
        String scheduleBundleJson = scheduleBundle == null ? "" : scheduleBundle.toString();
        long lastScheduleSyncAt = 0L;

        if (scheduleBundle != null) {
            lastScheduleSyncAt = Math.max(0L, (long) scheduleBundle.optDouble("syncedAt", 0D));
        }

        TeacherLocalReminderStore.saveConfig(
            getContext(),
            enabled,
            reminderTime,
            route,
            TextUtils.isEmpty(teacherId) ? "" : teacherId,
            scheduleBundleJson,
            lastScheduleSyncAt,
            hasScheduleBundle
        );

        if (TeacherLocalReminderStore.isConfigured(getContext())) {
            TeacherLocalReminderScheduler.scheduleNext(getContext());
        } else {
            TeacherLocalReminderScheduler.cancel(getContext());
        }

        call.resolve(buildStatus());
    }

    private JSObject buildStatus() {
        JSObject result = new JSObject();
        result.put("enabled", TeacherLocalReminderStore.isEnabled(getContext()));
        result.put("configured", TeacherLocalReminderStore.isConfigured(getContext()));
        result.put("teacherId", TeacherLocalReminderStore.getTeacherId(getContext()));
        result.put("reminderTime", TeacherLocalReminderStore.getReminderTime(getContext()));
        result.put("route", TeacherLocalReminderStore.getRoute(getContext()));
        result.put("hasScheduleBundle", !TextUtils.isEmpty(TeacherLocalReminderStore.getScheduleBundleJson(getContext())));
        result.put("lastScheduleSyncAt", TeacherLocalReminderStore.getLastScheduleSyncAt(getContext()));
        result.put("nextTriggerAt", TeacherLocalReminderStore.getNextTriggerAt(getContext()));
        result.put("lastTriggeredAt", TeacherLocalReminderStore.getLastTriggeredAt(getContext()));
        result.put("lastNotifiedAt", TeacherLocalReminderStore.getLastNotifiedAt(getContext()));
        return result;
    }
}
