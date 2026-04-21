<template>
  <ProjectDialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    size="sm"
    panel-class="project-confirm-dialog"
    @update:model-value="handleUpdate"
  >
    <div class="project-confirm">
      <div class="project-confirm__icon" :class="iconClass" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M10.2906 3.85994L1.82059 18C1.64595 18.3024 1.55223 18.6447 1.54859 18.9939C1.54496 19.3431 1.63153 19.6874 1.79984 19.9934C1.96814 20.2994 2.21236 20.5564 2.50876 20.7398C2.80517 20.9231 3.14375 21.0264 3.49059 21.0399H20.4306C20.7774 21.0264 21.116 20.9231 21.4124 20.7398C21.7088 20.5564 21.953 20.2994 22.1213 19.9934C22.2896 19.6874 22.3762 19.3431 22.3726 18.9939C22.3689 18.6447 22.2752 18.3024 22.1006 18L13.6306 3.85994C13.443 3.56605 13.1846 3.32373 12.8791 3.15535C12.5736 2.98697 12.2303 2.89795 11.8806 2.89795C11.5309 2.89795 11.1876 2.98697 10.8821 3.15535C10.5765 3.32373 10.3181 3.56605 10.1306 3.85994H10.2906Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>

      <div class="project-confirm__content">
        <p class="project-confirm__message">{{ message }}</p>
        <ul v-if="details.length" class="project-confirm__details">
          <li v-for="detail in details" :key="detail">{{ detail }}</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="project-confirm__footer">
        <el-button class="teacher-action-button teacher-action-button--secondary" @click="handleCancel">{{ cancelText }}</el-button>
        <el-button :class="confirmButtonClass" :type="confirmType" :loading="loading" @click="handleConfirm">{{ confirmText }}</el-button>
      </div>
    </template>
  </ProjectDialog>
</template>

<script setup>
import { computed } from 'vue';
import ProjectDialog from './ProjectDialog.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: ''
  },
  details: {
    type: Array,
    default: () => []
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmType: {
    type: String,
    default: 'primary'
  },
  loading: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'warning'
  },
  width: {
    type: [String, Number],
    default: '460px'
  }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const iconClass = computed(() => `project-confirm__icon--${props.type}`);
const confirmButtonClass = computed(() => {
  const variantMap = {
    primary: 'teacher-action-button--primary',
    success: 'teacher-action-button--success',
    danger: 'teacher-action-button--danger',
    warning: 'teacher-action-button--danger'
  };

  return ['teacher-action-button', variantMap[props.confirmType] || 'teacher-action-button--primary'];
});

function handleUpdate(value) {
  emit('update:modelValue', value);
  if (!value) {
    emit('cancel');
  }
}

function handleCancel() {
  emit('update:modelValue', false);
  emit('cancel');
}

function handleConfirm() {
  emit('confirm');
}
</script>
