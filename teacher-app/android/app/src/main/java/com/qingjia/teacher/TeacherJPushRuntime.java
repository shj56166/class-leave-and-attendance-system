package com.qingjia.teacher;

import android.content.Context;
import android.text.TextUtils;
import android.util.Log;

import cn.jpush.android.api.JPushInterface;

final class TeacherJPushRuntime {
    private static final String TAG = "TeacherJPushRuntime";

    private TeacherJPushRuntime() {
    }

    static boolean hasConsent(Context context) {
        return TeacherJPushStore.isConsentGranted(context);
    }

    static void grantConsent(Context context) {
        TeacherJPushStore.setConsentGranted(context, true);
    }

    static boolean ensureInitialized(Context context, boolean allowResume) {
        if (!BuildConfig.JPUSH_ENABLED || !hasConsent(context)) {
            return false;
        }

        JPushInterface.setDebugMode(BuildConfig.DEBUG);
        JPushInterface.init(context);

        if (allowResume && JPushInterface.isPushStopped(context)) {
            JPushInterface.resumePush(context);
            Log.w(TAG, "JPush was stopped, resumed after consent.");
        }

        String registrationId = JPushInterface.getRegistrationID(context);
        if (!TextUtils.isEmpty(registrationId)) {
            TeacherJPushStore.saveRegistrationId(context, registrationId);
        }

        return true;
    }
}
