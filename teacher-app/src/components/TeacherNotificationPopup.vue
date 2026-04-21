<template>
  <ProjectDialog
    :model-value="modelValue"
    title="新的待审批请假"
    width="420px"
    size="sm"
    panel-class="teacher-notification-popup"
    @update:model-value="handleUpdate"
  >
    <div class="teacher-notification-popup__body">
      <div class="teacher-notification-popup__icon" aria-hidden="true">
        <el-icon><BellFilled /></el-icon>
      </div>

      <div class="teacher-notification-popup__content">
        <p class="teacher-notification-popup__text">{{ text }}</p>
        <span class="teacher-notification-popup__hint">点击可直接进入审批页处理。</span>
      </div>
    </div>

    <template #footer>
      <div class="teacher-notification-popup__footer">
        <el-button class="teacher-action-button teacher-action-button--secondary" @click="handleClose">稍后处理</el-button>
        <el-button class="teacher-action-button teacher-action-button--primary" type="primary" @click="handleOpen">查看审批</el-button>
      </div>
    </template>
  </ProjectDialog>
</template>

<script setup>
import { computed } from 'vue';
import { BellFilled } from '@element-plus/icons-vue';
import ProjectDialog from './ProjectDialog.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  popup: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'open']);

const text = computed(() => props.popup?.text || '有新的待审批请假');

function handleUpdate(value) {
  emit('update:modelValue', value);
}

function handleClose() {
  emit('update:modelValue', false);
}

function handleOpen() {
  emit('open');
  emit('update:modelValue', false);
}
</script>

<style scoped>
.teacher-notification-popup__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.teacher-notification-popup__icon {
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(37, 99, 235, 0.28) 100%);
  color: #2563eb;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.teacher-notification-popup__icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.teacher-notification-popup__content {
  min-width: 0;
  flex: 1 1 auto;
}

.teacher-notification-popup__text {
  margin: 0 0 8px;
  color: #173b7a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.6;
}

.teacher-notification-popup__hint {
  color: #5c739e;
  font-size: 13px;
}

.teacher-notification-popup__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
