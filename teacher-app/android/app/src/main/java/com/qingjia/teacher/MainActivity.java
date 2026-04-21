package com.qingjia.teacher;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TeacherDeviceSettingsPlugin.class);
        registerOptionalPlugin("com.qingjia.teacher.TeacherJPushPlugin");
        registerPlugin(TeacherBackgroundSyncPlugin.class);
        registerPlugin(TeacherLocalReminderPlugin.class);
        super.onCreate(savedInstanceState);
        TeacherBackgroundSyncStore.setAppForeground(this, true);
        TeacherNotificationIntents.capturePendingOpenFromIntent(this, getIntent());

        if (this.bridge != null && this.bridge.getWebView() != null) {
            int mixedContentMode = BuildConfig.DEBUG
                ? WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                : WebSettings.MIXED_CONTENT_NEVER_ALLOW;
            this.bridge.getWebView().getSettings().setMixedContentMode(mixedContentMode);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        TeacherBackgroundSyncStore.setAppForeground(this, true);
    }

    @Override
    public void onPause() {
        TeacherBackgroundSyncStore.setAppForeground(this, false);
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        TeacherNotificationIntents.capturePendingOpenFromIntent(this, intent);
    }

    @SuppressWarnings("unchecked")
    private void registerOptionalPlugin(String className) {
        try {
            Class<?> pluginClass = Class.forName(className);
            if (Plugin.class.isAssignableFrom(pluginClass)) {
                registerPlugin((Class<? extends Plugin>) pluginClass);
            }
        } catch (ClassNotFoundException ignored) {
            // Optional native plugin is absent in the open-source build.
        }
    }
}
