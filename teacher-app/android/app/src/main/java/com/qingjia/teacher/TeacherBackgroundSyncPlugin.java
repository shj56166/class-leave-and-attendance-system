package com.qingjia.teacher;

import android.content.Context;
import android.text.TextUtils;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "TeacherBackgroundSync")
public class TeacherBackgroundSyncPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus(getContext()));
    }

    @PluginMethod
    public void syncConfig(PluginCall call) {
        Context context = getContext();
        boolean enabled = call.getBoolean("enabled", false);
        String serverOrigin = call.getString("serverOrigin", "");
        String authToken = call.getString("authToken", "");
        String bindingId = call.getString("bindingId", "");
        String notificationOwner = call.getString("notificationOwner", "");
        String cursorSubmittedAt = call.getString("cursorSubmittedAt", "");
        int cursorLeaveRequestId = call.getInt("cursorLeaveRequestId", 0);
        boolean configured = enabled && !TextUtils.isEmpty(serverOrigin) && !TextUtils.isEmpty(authToken);

        TeacherBackgroundSyncStore.saveConfig(
            context,
            configured,
            serverOrigin,
            authToken,
            bindingId,
            notificationOwner,
            cursorSubmittedAt,
            cursorLeaveRequestId
        );

        if (configured) {
            scheduleWork(context);
        } else {
            cancelWork(context);
        }

        call.resolve(buildStatus(context));
    }

    static void scheduleWork(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        PeriodicWorkRequest periodicWork = new PeriodicWorkRequest.Builder(
            TeacherPendingLeaveSyncWorker.class,
            15,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build();

        OneTimeWorkRequest immediateWork = new OneTimeWorkRequest.Builder(TeacherPendingLeaveSyncWorker.class)
            .setConstraints(constraints)
            .build();

        WorkManager workManager = WorkManager.getInstance(context);
        workManager.enqueueUniquePeriodicWork(
            TeacherBackgroundSyncStore.WORK_NAME_PERIODIC,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicWork
        );
        workManager.enqueueUniqueWork(
            TeacherBackgroundSyncStore.WORK_NAME_IMMEDIATE,
            ExistingWorkPolicy.REPLACE,
            immediateWork
        );
    }

    static void cancelWork(Context context) {
        WorkManager workManager = WorkManager.getInstance(context);
        workManager.cancelUniqueWork(TeacherBackgroundSyncStore.WORK_NAME_PERIODIC);
        workManager.cancelUniqueWork(TeacherBackgroundSyncStore.WORK_NAME_IMMEDIATE);
    }

    private JSObject buildStatus(Context context) {
        JSObject result = new JSObject();
        result.put("enabled", TeacherBackgroundSyncStore.isEnabled(context));
        result.put("configured", TeacherBackgroundSyncStore.isConfigured(context));
        result.put("appIsForeground", TeacherBackgroundSyncStore.isAppForeground(context));
        result.put("lastRunAt", TeacherBackgroundSyncStore.getLastRunAt(context));
        result.put("lastSuccessAt", TeacherBackgroundSyncStore.getLastSuccessAt(context));
        result.put("lastPolledAt", TeacherBackgroundSyncStore.getLastPolledAt(context));
        result.put("notificationOwner", TeacherBackgroundSyncStore.getNotificationOwner(context));
        result.put("bindingId", TeacherBackgroundSyncStore.getBindingId(context));
        result.put("cursorSubmittedAt", TeacherBackgroundSyncStore.getCursorSubmittedAt(context));
        result.put("cursorLeaveRequestId", TeacherBackgroundSyncStore.getCursorLeaveRequestId(context));
        result.put("windows", buildWindows());
        return result;
    }

    private JSArray buildWindows() {
        JSArray windows = new JSArray();

        JSObject morningWindow = new JSObject();
        morningWindow.put("id", "morning");
        morningWindow.put("label", "早间兜底");
        morningWindow.put("start", "07:00");
        morningWindow.put("end", "08:30");
        windows.put(morningWindow);

        JSObject afternoonWindow = new JSObject();
        afternoonWindow.put("id", "afternoon");
        afternoonWindow.put("label", "午后兜底");
        afternoonWindow.put("start", "14:00");
        afternoonWindow.put("end", "15:30");
        windows.put(afternoonWindow);

        return windows;
    }
}
