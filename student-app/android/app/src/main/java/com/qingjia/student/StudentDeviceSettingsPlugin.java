package com.qingjia.student;

import android.content.Context;
import android.net.DhcpInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

@CapacitorPlugin(name = "StudentDeviceSettings")
public class StudentDeviceSettingsPlugin extends Plugin {

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
