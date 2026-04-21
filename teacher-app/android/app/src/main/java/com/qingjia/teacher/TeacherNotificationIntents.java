package com.qingjia.teacher;

import android.content.Context;
import android.content.Intent;
import android.text.TextUtils;

import org.json.JSONException;
import org.json.JSONObject;

final class TeacherNotificationIntents {
    static final String EXTRA_PENDING_OPEN_PAYLOAD = "teacher_pending_open_payload";

    private TeacherNotificationIntents() {
    }

    static Intent buildOpenIntent(Context context, JSONObject payload) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        if (payload != null) {
            intent.putExtra(EXTRA_PENDING_OPEN_PAYLOAD, payload.toString());
        }

        return intent;
    }

    static void capturePendingOpenFromIntent(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }

        String rawPayload = intent.getStringExtra(EXTRA_PENDING_OPEN_PAYLOAD);
        if (TextUtils.isEmpty(rawPayload)) {
            return;
        }

        try {
            TeacherJPushStore.savePendingOpen(context, new JSONObject(rawPayload));
        } catch (JSONException ignored) {
            // Ignore malformed notification payloads.
        }
    }
}
