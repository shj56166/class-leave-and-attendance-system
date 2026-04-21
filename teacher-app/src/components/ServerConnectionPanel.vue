<template>
  <section class="server-connection-panel" :class="{ 'server-connection-panel--compact': compact }">
    <div class="server-connection-panel__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <div class="server-connection-panel__status">
        <el-tag round :type="statusTagType">
          {{ statusText }}
        </el-tag>
        <el-tag v-if="runtimeState.source" round type="info">
          {{ sourceText }}
        </el-tag>
      </div>
    </div>

    <div class="server-connection-panel__body">
      <div class="server-connection-panel__summary">
        <div class="server-connection-panel__summary-item">
          <span>当前地址</span>
          <strong>{{ runtimeState.serverOrigin || '未连接' }}</strong>
        </div>
        <div class="server-connection-panel__summary-item">
          <span>最近验证</span>
          <strong>{{ formatDateTime(runtimeState.lastVerifiedAt) }}</strong>
        </div>
      </div>

      <el-alert
        v-if="runtimeState.lastError"
        :title="runtimeState.lastError"
        type="warning"
        :closable="false"
        show-icon
      />

      <div class="server-connection-panel__form">
        <el-input
          v-model="manualOrigin"
          placeholder="Android 调试可填 192.168.1.100:3000；网页/发布环境请使用 HTTPS 地址"
          clearable
        />
        <div class="server-connection-panel__actions">
          <el-button class="teacher-action-button teacher-action-button--secondary" :loading="discovering" @click="handleAutoDiscover">自动发现</el-button>
          <el-button class="teacher-action-button teacher-action-button--secondary" :loading="verifying" @click="handleVerifyCurrent">测试当前</el-button>
          <el-button class="teacher-action-button teacher-action-button--primary" type="primary" :loading="saving" @click="handleSaveManualOrigin">保存并连接</el-button>
        </div>
      </div>

      <div v-if="runtimeState.recentOrigins.length" class="server-connection-panel__recent">
        <span class="server-connection-panel__recent-label">最近成功地址</span>
        <div class="server-connection-panel__recent-list">
          <button
            v-for="origin in runtimeState.recentOrigins"
            :key="origin"
            type="button"
            class="server-connection-panel__recent-chip"
            @click="useRecentOrigin(origin)"
          >
            {{ origin }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
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
    default: '自动发现当前局域网可用后端；Android 调试可使用 HTTP，网页与发布环境请固定使用 HTTPS 地址。'
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

const statusText = computed(() => {
  if (runtimeState.discovering || discovering.value) {
    return '自动发现中';
  }

  if (runtimeState.connectionStatus === 'connected') {
    return '服务器可用';
  }

  if (runtimeState.connectionStatus === 'checking') {
    return '检测中';
  }

  return '待连接';
});

const statusTagType = computed(() => {
  if (runtimeState.connectionStatus === 'connected') {
    return 'success';
  }

  if (runtimeState.connectionStatus === 'checking' || runtimeState.discovering) {
    return 'warning';
  }

  return 'info';
});

const sourceText = computed(() => {
  const map = {
    env: '环境默认',
    manual: '手动设置',
    auto_discovered: '自动发现'
  };

  return map[runtimeState.source] || '运行时';
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
      ElMessage.success(`已连接到 ${origin}`);
    } else {
      ElMessage.warning('未自动发现可用服务器，请手动填写地址');
    }
  } finally {
    discovering.value = false;
  }
}

async function handleVerifyCurrent() {
  verifying.value = true;
  try {
    const target = normalizeServerOrigin(manualOrigin.value || runtimeState.serverOrigin);
    if (!target) {
      ElMessage.warning('请先填写服务器地址');
      return;
    }

    const result = await verifyServerOrigin(target, {
      source: runtimeState.source || 'manual'
    });

    if (result.ok) {
      manualOrigin.value = result.origin;
      ElMessage.success('服务器连接正常');
      return;
    }

    ElMessage.error('服务器不可达，请检查地址或确认后端已启动');
  } finally {
    verifying.value = false;
  }
}

async function handleSaveManualOrigin() {
  saving.value = true;
  try {
    const target = normalizeServerOrigin(manualOrigin.value);
    if (!target) {
      ElMessage.error('服务器地址格式无效');
      return;
    }

    const result = await verifyServerOrigin(target, {
      source: 'manual'
    });

    if (!result.ok) {
      ElMessage.error('地址已保存，但当前无法连接服务器');
      return;
    }

    manualOrigin.value = target;
    await refreshServerConnection();
    ElMessage.success(`已切换到 ${target}`);
  } finally {
    saving.value = false;
  }
}

function useRecentOrigin(origin) {
  manualOrigin.value = origin;
}
</script>

<style scoped>
.server-connection-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.76),
    0 18px 34px rgba(148, 163, 184, 0.12);
}

.server-connection-panel--compact {
  padding: 14px;
  border-radius: 16px;
}

.server-connection-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.server-connection-panel__header h3 {
  margin: 0;
  color: #12316f;
  font-size: 15px;
}

.server-connection-panel__header p {
  margin: 8px 0 0;
  color: #5c739e;
  font-size: 12px;
  line-height: 1.55;
}

.server-connection-panel__status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.server-connection-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.server-connection-panel__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.server-connection-panel__summary-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: #f7fbff;
  border: 1px solid rgba(191, 219, 254, 0.9);
}

.server-connection-panel__summary-item span {
  display: block;
  font-size: 11px;
  color: #5c739e;
}

.server-connection-panel__summary-item strong {
  display: block;
  margin-top: 6px;
  color: #12316f;
  font-size: 13px;
  word-break: break-all;
}

.server-connection-panel__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.server-connection-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.server-connection-panel__recent {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.server-connection-panel__recent-label {
  font-size: 12px;
  color: #5c739e;
}

.server-connection-panel__recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.server-connection-panel__recent-chip {
  border: 1px solid rgba(59, 130, 246, 0.14);
  background: rgba(239, 246, 255, 0.9);
  color: #1d4ed8;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 720px) {
  .server-connection-panel__header,
  .server-connection-panel__actions {
    flex-direction: column;
  }

  .server-connection-panel__summary {
    grid-template-columns: 1fr;
  }

  .server-connection-panel__actions .el-button {
    width: 100%;
  }
}
</style>
