package com.qingjia.teacher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class TeacherLocalReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !TeacherLocalReminderScheduler.ACTION_TRIGGER.equals(intent.getAction())) {
            return;
        }

        TeacherLocalReminderScheduler.handleAlarmTrigger(context.getApplicationContext());
    }
}
