package com.qingjia.teacher;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.DhcpInfo;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

@CapacitorPlugin(name = "TeacherDeviceSettings")
public class TeacherDeviceSettingsPlugin extends Plugin {

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject result = new JSObject();
        Context context = getContext();
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);

        boolean batteryOptimizationIgnored = false;
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            batteryOptimizationIgnored = powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
        }

        result.put("notificationsEnabled", notificationManager.areNotificationsEnabled());
        result.put("batteryOptimizationIgnored", batteryOptimizationIgnored);
        result.put("canOpenAutoStartSettings", resolveAutoStartIntent() != null);
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("model", Build.MODEL == null ? "" : Build.MODEL);
        call.resolve(result);
    }

    @PluginMethod
    public void getNetworkInfo(PluginCall call) {
        JSObject result = new JSObject();
        Context context = getContext().getApplicationContext();

        String ipv4Address = "";
        String gatewayAddress = "";
        String subnetMask = "";

        try {
            WifiManager wifiManager = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                WifiInfo wifiInfo = wifiManager.getConnectionInfo();
                DhcpInfo dhcpInfo = wifiManager.getDhcpInfo();

                if (wifiInfo != null) {
                    ipv4Address = intToIpv4(wifiInfo.getIpAddress());
                }

                if (dhcpInfo != null) {
                    gatewayAddress = intToIpv4(dhcpInfo.gateway);
                    subnetMask = intToIpv4(dhcpInfo.netmask);
                }
            }
        } catch (Exception ignored) {
        }

        if (TextUtils.isEmpty(ipv4Address)) {
            ipv4Address = findFallbackIpv4Address();
        }

        result.put("ipv4Address", ipv4Address);
        result.put("gatewayAddress", gatewayAddress);
        result.put("subnetMask", subnetMask);
        result.put("subnetPrefix", resolveSubnetPrefix(ipv4Address, gatewayAddress));
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = buildAppDetailsIntent();
        }

        call.resolve(launchIntentWithFallback(intent, false));
    }

    @PluginMethod
    public void openAutoStartSettings(PluginCall call) {
        Intent intent = resolveAutoStartIntent();
        call.resolve(launchIntentWithFallback(intent, true));
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean ignored = powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());

            if (!ignored) {
                intent = new Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getContext().getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            }
        } else {
            intent = buildAppDetailsIntent();
        }

        if (!canResolve(intent)) {
            intent = buildAppDetailsIntent();
        }

        call.resolve(launchIntentWithFallback(intent, false));
    }

    private Intent buildAppDetailsIntent() {
        return new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
    }

    private void launchIntent(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private JSObject launchIntentWithFallback(Intent intent, boolean allowFallback) {
        JSObject result = new JSObject();
        Intent targetIntent = intent;
        boolean fallbackUsed = false;

        if (targetIntent == null || !canResolve(targetIntent)) {
            if (!allowFallback) {
                result.put("opened", false);
                result.put("fallbackUsed", false);
                result.put("target", "");
                return result;
            }

            targetIntent = buildAppDetailsIntent();
            fallbackUsed = true;
        }

        try {
            launchIntent(targetIntent);
            result.put("opened", true);
            result.put("fallbackUsed", fallbackUsed);
            result.put("target", resolveIntentTarget(targetIntent));
            return result;
        } catch (Exception error) {
            if (!allowFallback || fallbackUsed) {
                throw error;
            }

            Intent fallbackIntent = buildAppDetailsIntent();
            launchIntent(fallbackIntent);
            result.put("opened", true);
            result.put("fallbackUsed", true);
            result.put("target", resolveIntentTarget(fallbackIntent));
            return result;
        }
    }

    private boolean canResolve(Intent intent) {
        return intent.resolveActivity(getContext().getPackageManager()) != null;
    }

    private String resolveIntentTarget(Intent intent) {
        if (intent == null) {
            return "";
        }

        ComponentName componentName = intent.getComponent();
        if (componentName != null) {
            return componentName.flattenToShortString();
        }

        String action = intent.getAction();
        return action == null ? "" : action;
    }

    private Intent resolveAutoStartIntent() {
        Intent[] intents = new Intent[] {
            buildComponentIntent("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            buildComponentIntent("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
            buildComponentIntent("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
            buildComponentIntent("com.honor.systemmanager", "com.honor.systemmanager.optimize.process.ProtectActivity"),
            buildComponentIntent("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
            buildComponentIntent("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
            buildComponentIntent("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
            buildComponentIntent("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
            buildComponentIntent("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
        };

        for (Intent intent : intents) {
            if (intent != null && canResolve(intent)) {
                return intent;
            }
        }

        return null;
    }

    private Intent buildComponentIntent(String packageName, String className) {
        Intent intent = new Intent();
        intent.setComponent(new ComponentName(packageName, className));
        return intent;
    }

    private String intToIpv4(int address) {
        if (address == 0) {
            return "";
        }

        return (address & 0xFF) + "."
            + ((address >> 8) & 0xFF) + "."
            + ((address >> 16) & 0xFF) + "."
            + ((address >> 24) & 0xFF);
    }

    private String resolveSubnetPrefix(String ipv4Address, String gatewayAddress) {
        String candidate = !TextUtils.isEmpty(ipv4Address) ? ipv4Address : gatewayAddress;
        if (TextUtils.isEmpty(candidate)) {
            return "";
        }

        String[] parts = candidate.split("\\.");
        if (parts.length != 4) {
            return "";
        }

        return parts[0] + "." + parts[1] + "." + parts[2];
    }

    private String findFallbackIpv4Address() {
        try {
            for (NetworkInterface networkInterface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
                    if (address instanceof Inet4Address && !address.isLoopbackAddress()) {
                        return address.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }

        return "";
    }
}
