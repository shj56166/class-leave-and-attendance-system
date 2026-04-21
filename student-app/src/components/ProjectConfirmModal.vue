<template>
  <ProjectModal
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
      <div class="project-confirm__footer project-confirm__footer--mobile">
        <button
          type="button"
          class="project-confirm__button project-confirm__button--ghost"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="project-confirm__button"
          :class="confirmButtonClass"
          :disabled="loading"
          @click="handleConfirm"
        >
          {{ loading ? loadingText : confirmText }}
        </button>
      </div>
    </template>
  </ProjectModal>
</template>

<script setup>
import { computed } from 'vue';
import ProjectModal from './ProjectModal.vue';

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
  loadingText: {
    type: String,
    default: '处理中...'
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
const confirmButtonClass = computed(() => `project-confirm__button--${props.type}`);

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

<style scoped>
.project-confirm__footer--mobile {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.project-confirm__button {
  min-height: 42px;
  border-radius: 16px;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
}

.project-confirm__button:disabled {
  opacity: 0.62;
}

.project-confirm__button--ghost {
  color: #5f7398;
  background: rgba(239, 244, 255, 0.92);
  border: 1px solid rgba(211, 222, 241, 0.92);
}

.project-confirm__button--warning {
  color: #ffffff;
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 12px 24px rgba(217, 119, 6, 0.18);
}

.project-confirm__button--danger {
  color: #ffffff;
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 12px 24px rgba(220, 38, 38, 0.18);
}

.project-confirm__button--primary {
  color: #ffffff;
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}

.project-confirm__button:active {
  transform: scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .project-confirm__button {
    transition-duration: 0.01ms !important;
  }
}
</style>
