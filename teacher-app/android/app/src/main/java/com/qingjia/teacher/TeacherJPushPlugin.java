package com.qingjia.teacher;

import android.content.Context;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Iterator;

import cn.jpush.android.api.JPushInterface;

@CapacitorPlugin(name = "TeacherJPush")
public class TeacherJPushPlugin extends Plugin {
    private static volatile TeacherJPushPlugin activeInstance;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    static void dispatchRegistrationUpdated(Context context, String registrationId) {
        TeacherJPushPlugin plugin = activeInstance;
        if (plugin == null || TextUtils.isEmpty(registrationId)) {
            return;
        }

        JSObject payload = new JSObject();
        payload.put("registrationId", registrationId);
        payload.put("registeredAt", TeacherJPushStore.getLastRegistrationAt(context));
        plugin.notifyListeners("registrationUpdated", payload);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        call.resolve(buildStatus(context));
    }

    @PluginMethod
    public void getConsentStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("consentGranted", TeacherJPushRuntime.hasConsent(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void grantConsentAndEnsureInitialized(PluginCall call) {
        Context context = getContext();
        TeacherJPushRuntime.grantConsent(context);
        TeacherJPushRuntime.ensureInitialized(context, true);
        call.resolve(buildStatus(context));
    }

    @PluginMethod
    public void setPushEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        Context context = getContext();

        if (BuildConfig.JPUSH_ENABLED && TeacherJPushRuntime.hasConsent(context)) {
            if (enabled) {
                TeacherJPushRuntime.ensureInitialized(context, true);
                JPushInterface.resumePush(context);
            } else {
                JPushInterface.stopPush(context);
            }
        }

        call.resolve(buildStatus(context));
    }

    @PluginMethod
    public void consumePendingOpen(PluginCall call) {
        JSONObject payload = TeacherJPushStore.consumePendingOpen(getContext());
        JSObject result = new JSObject();
        result.put("hasPending", payload != null);

        if (payload != null) {
            result.put("payload", toJsObject(payload));
        }

        call.resolve(result);
    }

    @PluginMethod
    public void consumePendingRegistrationUpgrade(PluginCall call) {
        JSONObject payload = TeacherJPushStore.consumePendingRegistrationUpgrade(getContext());
        JSObject result = new JSObject();
        result.put("hasPending", payload != null);

        if (payload != null) {
            result.put("payload", toJsObject(payload));
        }

        call.resolve(result);
    }

    @PluginMethod
    public void rememberDeliveredNotification(PluginCall call) {
        int leaveRequestId = call.getInt("leaveRequestId", 0);
        String source = call.getString("source", "");

        TeacherJPushStore.rememberDeliveredLeaveRequest(getContext(), leaveRequestId, source);

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    private JSObject toJsObject(JSONObject source) {
        JSObject target = new JSObject();
        Iterator<String> keys = source.keys();

        while (keys.hasNext()) {
            String key = keys.next();
            target.put(key, source.opt(key));
        }

        return target;
    }

    private JSObject buildStatus(Context context) {
        String registrationId = TeacherJPushStore.getRegistrationId(context);
        boolean consentGranted = TeacherJPushRuntime.hasConsent(context);
        boolean sdkConfigured = BuildConfig.JPUSH_ENABLED;
        boolean canOperate = sdkConfigured && consentGranted;
        boolean pushStopped = canOperate && JPushInterface.isPushStopped(context);

        if (canOperate && TextUtils.isEmpty(registrationId)) {
            registrationId = JPushInterface.getRegistrationID(context);
            if (!TextUtils.isEmpty(registrationId)) {
                TeacherJPushStore.saveRegistrationId(context, registrationId);
            }
        }

        JSObject result = new JSObject();
        result.put("consentGranted", consentGranted);
        result.put("enabled", canOperate && !pushStopped);
        result.put("sdkConfigured", sdkConfigured);
        result.put("vivoPushConfigured", BuildConfig.VIVO_PUSH_CONFIGURED);
        result.put("honorPushConfigured", BuildConfig.HONOR_PUSH_CONFIGURED);
        result.put("pushStopped", pushStopped);
        result.put("pushOperational", canOperate && !pushStopped);
        result.put("registrationId", registrationId == null ? "" : registrationId);
        result.put("hasRegistrationId", !TextUtils.isEmpty(registrationId));
        result.put("lastRegistrationAt", TeacherJPushStore.getLastRegistrationAt(context));
        result.put("lastRemoteNotificationAt", TeacherJPushStore.getLastRemoteNotificationAt(context));
        return result;
    }
}
