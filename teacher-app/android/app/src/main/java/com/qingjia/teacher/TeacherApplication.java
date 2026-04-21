package com.qingjia.teacher;

import android.app.ActivityManager;
import android.app.Application;
import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.text.TextUtils;
import android.util.Log;

import java.lang.reflect.Method;

public class TeacherApplication extends Application {
    private static final String TAG = "TeacherApplication";

    @Override
    public void onCreate() {
        super.onCreate();

        if (!BuildConfig.JPUSH_ENABLED) {
            Log.i(TAG, "JPush init skipped because JPUSH_APPKEY is not configured.");
        } else if (!hasJPushConsent()) {
            Log.i(TAG, "JPush init skipped until user grants consent.");
        } else {
            ensureJPushInitialized();
            Log.i(TAG, "JPush initialized.");
        }

        String processName = resolveCurrentProcessName();
        boolean isMainProcess = TextUtils.equals(getPackageName(), processName);
        if (!isMainProcess) {
            Log.i(TAG, "Skip background schedulers in non-main process: " + processName);
            return;
        }

        TeacherBackgroundSyncStore.setAppForeground(this, false);
        if (TeacherBackgroundSyncStore.isConfigured(this)) {
            TeacherBackgroundSyncPlugin.scheduleWork(this);
        }

        if (TeacherLocalReminderStore.isConfigured(this)) {
            TeacherLocalReminderScheduler.scheduleNext(this);
        }
    }

    private String resolveCurrentProcessName() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return Application.getProcessName();
        }

        ActivityManager activityManager = getSystemService(ActivityManager.class);
        if (activityManager == null) {
            return getPackageName();
        }

        int currentPid = Process.myPid();
        for (ActivityManager.RunningAppProcessInfo processInfo : activityManager.getRunningAppProcesses()) {
            if (processInfo != null && processInfo.pid == currentPid && processInfo.processName != null) {
                return processInfo.processName;
            }
        }

        return getPackageName();
    }

    private boolean hasJPushConsent() {
        try {
            Method method = Class
                .forName("com.qingjia.teacher.TeacherJPushRuntime")
                .getDeclaredMethod("hasConsent", Context.class);
            method.setAccessible(true);
            Object result = method.invoke(null, this);
            return result instanceof Boolean && (Boolean) result;
        } catch (Exception error) {
            Log.i(TAG, "JPush runtime unavailable in this build.");
            return false;
        }
    }

    private void ensureJPushInitialized() {
        try {
            Method method = Class
                .forName("com.qingjia.teacher.TeacherJPushRuntime")
                .getDeclaredMethod("ensureInitialized", Context.class, boolean.class);
            method.setAccessible(true);
            method.invoke(null, this, true);
        } catch (Exception error) {
            Log.i(TAG, "JPush initialization skipped because runtime classes are unavailable.");
        }
    }
}
