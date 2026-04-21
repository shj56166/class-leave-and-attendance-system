package com.qingjia.teacher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class TeacherLocalReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }

        if (TeacherLocalReminderStore.isConfigured(context)) {
            TeacherLocalReminderScheduler.scheduleNext(context.getApplicationContext());
        } else {
            TeacherLocalReminderScheduler.cancel(context.getApplicationContext());
        }
    }
}
