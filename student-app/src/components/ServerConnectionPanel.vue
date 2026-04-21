<template>
  <section class="server-panel" :class="{ 'server-panel--compact': compact }">
    <div class="server-panel__header">
      <div class="server-panel__heading">
        <p class="server-panel__eyebrow">Android 内网连接</p>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>

      <div class="server-panel__badges">
        <span class="server-panel__badge" :class="`server-panel__badge--${statusTone}`">
          {{ statusText }}
        </span>
        <span v-if="runtimeState.source" class="server-panel__badge server-panel__badge--muted">
          {{ sourceText }}
        </span>
      </div>
    </div>

    <div class="server-panel__summary">
      <div class="server-panel__summary-item">
        <span>当前地址</span>
        <strong>{{ runtimeState.serverOrigin || '未连接' }}</strong>
      </div>
      <div class="server-panel__summary-item">
        <span>最近验证</span>
        <strong>{{ formatDateTime(runtimeState.lastVerifiedAt) }}</strong>
      </div>
    </div>

    <p v-if="runtimeState.lastError" class="server-panel__alert">
      {{ runtimeState.lastError }}
    </p>

    <label class="server-panel__field">
      <span>服务器地址</span>
      <input
        v-model="manualOrigin"
        type="text"
        inputmode="url"
        placeholder="例如 192.168.1.100:3000"
      >
    </label>

    <div class="server-panel__actions">
      <button type="button" class="server-panel__button server-panel__button--ghost" :disabled="busy" @click="handleAutoDiscover">
        {{ discovering ? '发现中...' : '自动发现' }}
      </button>
      <button type="button" class="server-panel__button server-panel__button--ghost" :disabled="busy" @click="handleVerifyCurrent">
        {{ verifying ? '检测中...' : '测试当前' }}
      </button>
      <button type="button" class="server-panel__button server-panel__button--primary" :disabled="busy" @click="handleSaveManualOrigin">
        {{ saving ? '保存中...' : '保存并连接' }}
      </button>
    </div>

    <div v-if="runtimeState.recentOrigins.length" class="server-panel__recent">
      <span class="server-panel__recent-label">最近成功地址</span>
      <div class="server-panel__recent-list">
        <button
          v-for="origin in runtimeState.recentOrigins"
          :key="origin"
          type="button"
          class="server-panel__recent-chip"
          @click="manualOrigin = origin"
        >
          {{ origin }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import {
  discoverServerOrigin,
  getServerRuntimeState,
  normalizeServerOrigin,
  refreshServerConnection,
  verifyServerOrigin
} from '../config/serverRuntime';

const props = defineProps({
  compact: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '服务器连接'
  },
  description: {
    type: String,
    default: 'Android 包会优先自动发现当前局域网服务端，也可以手动填写并保存。'
  }
});

const runtimeState = getServerRuntimeState();
const manualOrigin = ref(runtimeState.serverOrigin || '');
const discovering = ref(false);
const verifying = ref(false);
const saving = ref(false);

watch(
  () => runtimeState.serverOrigin,
  (value) => {
    if (!manualOrigin.value) {
      manualOrigin.value = value || '';
    }
  },
  { immediate: true }
);

const busy = computed(() => discovering.value || verifying.value || saving.value);

const statusText = computed(() => {
  if (runtimeState.discovering || discovering.value) {
    return '自动发现中';
  }

  if (runtimeState.connectionStatus === 'connected') {
    return '已连接';
  }

  if (runtimeState.connectionStatus === 'checking') {
    return '检测中';
  }

  return '待连接';
});

const statusTone = computed(() => {
  if (runtimeState.connectionStatus === 'connected') {
    return 'success';
  }

  if (runtimeState.connectionStatus === 'checking' || runtimeState.discovering) {
    return 'warning';
  }

  return 'neutral';
});

const sourceText = computed(() => {
  const sourceMap = {
    env: '环境默认',
    manual: '手动设置',
    auto_discovered: '自动发现'
  };

  return sourceMap[runtimeState.source] || '运行时';
});

function formatDateTime(value) {
  if (!value) {
    return '暂无';
  }

  return new Date(value).toLocaleString('zh-CN');
}

async function handleAutoDiscover() {
  discovering.value = true;
  try {
    const origin = await discoverServerOrigin();
    if (origin) {
      manualOrigin.value = origin;
      showToast(`已连接到 ${origin}`);
      return;
    }

    showToast('未自动发现可用服务器，请手动填写');
  } finally {
    discovering.value = false;
  }
}

async function handleVerifyCurrent() {
  verifying.value = true;
  try {
    const target = normalizeServerOrigin(manualOrigin.value || runtimeState.serverOrigin);
    if (!target) {
      showToast('请先填写服务器地址');
      return;
    }

    const result = await verifyServerOrigin(target, {
      source: runtimeState.source || 'manual'
    });

    if (result.ok) {
      manualOrigin.value = result.origin;
      showToast('服务器连接正常');
      return;
    }

    showToast('当前地址不可达，请检查服务端是否已启动');
  } finally {
    verifying.value = false;
  }
}

async function handleSaveManualOrigin() {
  saving.value = true;
  try {
    const target = normalizeServerOrigin(manualOrigin.value);
    if (!target) {
      showToast('服务器地址格式无效');
      return;
    }

    const result = await verifyServerOrigin(target, {
      source: 'manual'
    });

    if (!result.ok) {
      showToast('地址已保存，但当前无法连接服务端');
      return;
    }

    manualOrigin.value = target;
    await refreshServerConnection();
    showToast(`已切换到 ${target}`);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.server-panel {
  padding: 16px;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background:
    radial-gradient(circle at top right, rgba(147, 197, 253, 0.22) 0%, rgba(147, 197, 253, 0) 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(243, 248, 255, 0.92) 100%);
  border: 1px solid rgba(217, 228, 243, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 16px 34px rgba(148, 163, 184, 0.1);
}

.server-panel--compact {
  border-radius: 20px;
  padding: 14px;
}

.server-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.server-panel__heading h3 {
  margin: 4px 0 0;
  font-size: 17px;
  font-weight: 780;
  color: #16306a;
}

.server-panel__heading p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #5f769d;
}

.server-panel__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #7890b6;
}

.server-panel__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.server-panel__badge {
  min-height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid rgba(255, 255, 255, 0.74);
}

.server-panel__badge--success {
  color: #0f8b51;
  background: rgba(236, 253, 245, 0.96);
}

.server-panel__badge--warning {
  color: #b66a12;
  background: rgba(255, 247, 219, 0.96);
}

.server-panel__badge--neutral,
.server-panel__badge--muted {
  color: #5f7397;
  background: rgba(244, 247, 252, 0.96);
}

.server-panel__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.server-panel__summary-item {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(249, 251, 255, 0.92);
  border: 1px solid rgba(222, 232, 246, 0.94);
}

.server-panel__summary-item span {
  display: block;
  font-size: 11px;
  color: #7a90b4;
}

.server-panel__summary-item strong {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #16306a;
  word-break: break-all;
}

.server-panel__alert {
  margin: 0;
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.55;
  color: #9f5d11;
  background: rgba(255, 247, 219, 0.94);
  border: 1px solid rgba(246, 221, 153, 0.9);
}

.server-panel__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-panel__field span {
  font-size: 12px;
  font-weight: 700;
  color: #5f769d;
}

.server-panel__field input {
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid rgba(204, 217, 238, 0.95);
  border-radius: 16px;
  font-size: 14px;
  color: #16306a;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.server-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.server-panel__button {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  border: 1px solid rgba(203, 216, 238, 0.95);
}

.server-panel__button:disabled {
  opacity: 0.64;
}

.server-panel__button--ghost {
  color: #42659f;
  background: rgba(247, 250, 255, 0.95);
}

.server-panel__button--primary {
  color: #ffffff;
  border-color: rgba(37, 99, 235, 0.9);
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
}

.server-panel__recent {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.server-panel__recent-label {
  font-size: 12px;
  color: #5f769d;
}

.server-panel__recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.server-panel__recent-chip {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #1f4fb8;
  background: rgba(239, 246, 255, 0.96);
  border: 1px solid rgba(191, 219, 254, 0.88);
}

@media (max-width: 520px) {
  .server-panel__header,
  .server-panel__actions {
    flex-direction: column;
  }

  .server-panel__badges {
    justify-content: flex-start;
  }

  .server-panel__summary {
    grid-template-columns: 1fr;
  }

  .server-panel__button {
    width: 100%;
  }
}
</style>
