<template>
  <teleport :to="teleportTarget" :disabled="!appendToBody">
    <transition name="project-modal-bloom" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
      <div
        v-if="rendered"
        v-show="modelValue"
        ref="overlayRef"
        class="project-modal-overlay project-modal-overlay--desktop"
        :class="overlayClass"
        tabindex="-1"
        @click.self="handleOverlayClick"
      >
        <div class="project-modal-shell" :class="shellClasses" :style="shellStyle">
          <div class="project-modal-bloom" aria-hidden="true"></div>
          <section
            class="project-modal-card project-modal-card--desktop"
            :class="panelClass"
            role="dialog"
            aria-modal="true"
            :aria-label="title || 'Dialog'"
          >
            <header v-if="hasHeader" class="project-modal-header" :class="{ 'project-modal-header--compact': !hasFooter }">
              <slot name="header">
                <h2 v-if="title" class="project-modal-title">{{ title }}</h2>
              </slot>
              <button
                v-if="showClose"
                type="button"
                class="project-modal-close"
                aria-label="关闭"
                @click="close"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </header>

            <div class="project-modal-body" :class="bodyClass">
              <slot />
            </div>

            <footer v-if="hasFooter" class="project-modal-footer">
              <slot name="footer" />
            </footer>
          </section>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  width: {
    type: [String, Number],
    default: '600px'
  },
  size: {
    type: String,
    default: 'md'
  },
  showClose: {
    type: Boolean,
    default: true
  },
  closeOnClickModal: {
    type: Boolean,
    default: true
  },
  destroyOnClose: {
    type: Boolean,
    default: true
  },
  lockScroll: {
    type: Boolean,
    default: true
  },
  appendToBody: {
    type: Boolean,
    default: true
  },
  overlayClass: {
    type: [String, Array, Object],
    default: ''
  },
  panelClass: {
    type: [String, Array, Object],
    default: ''
  },
  bodyClass: {
    type: [String, Array, Object],
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'after-open', 'after-close']);
const slots = useSlots();
const overlayRef = ref(null);
const rendered = ref(props.modelValue);
const transitionEpoch = ref(0);
const pendingCloseEpoch = ref(0);
const lockKey = 'projectModalLockCount';
let scrollLocked = false;
let escapeBound = false;

const teleportTarget = 'body';
const hasHeader = computed(() => Boolean(slots.header || props.title || props.showClose));
const hasFooter = computed(() => Boolean(slots.footer));
const shellClasses = computed(() => `project-modal-shell--${props.size}`);
const shellStyle = computed(() => {
  if (!props.width) {
    return undefined;
  }

  return {
    maxWidth: typeof props.width === 'number' ? `${props.width}px` : props.width
  };
});

function lockScroll() {
  if (!props.lockScroll || scrollLocked || typeof document === 'undefined') {
    return;
  }

  const body = document.body;
  const nextCount = Number(body.dataset[lockKey] || '0') + 1;
  body.dataset[lockKey] = String(nextCount);
  document.documentElement.classList.add('project-modal-scroll-lock');
  body.classList.add('project-modal-scroll-lock');
  scrollLocked = true;
}

function unlockScroll() {
  if (!props.lockScroll || !scrollLocked || typeof document === 'undefined') {
    return;
  }

  const body = document.body;
  const nextCount = Math.max(Number(body.dataset[lockKey] || '0') - 1, 0);

  if (nextCount === 0) {
    delete body.dataset[lockKey];
    document.documentElement.classList.remove('project-modal-scroll-lock');
    body.classList.remove('project-modal-scroll-lock');
    scrollLocked = false;
    return;
  }

  body.dataset[lockKey] = String(nextCount);
  scrollLocked = false;
}

function bindEscape() {
  if (escapeBound || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('keydown', handleEscape);
  escapeBound = true;
}

function unbindEscape() {
  if (!escapeBound || typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('keydown', handleEscape);
  escapeBound = false;
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    close();
  }
}

function close() {
  emit('update:modelValue', false);
}

function handleOverlayClick() {
  if (props.closeOnClickModal) {
    close();
  }
}

async function prepareOpen(epoch) {
  rendered.value = true;
  pendingCloseEpoch.value = 0;
  lockScroll();
  bindEscape();
  await nextTick();

  if (epoch !== transitionEpoch.value || !props.modelValue) {
    return;
  }

  overlayRef.value?.focus();
}

function prepareClose(epoch) {
  if (!rendered.value) {
    pendingCloseEpoch.value = 0;
    return;
  }

  pendingCloseEpoch.value = epoch;
  unbindEscape();
  unlockScroll();
}

watch(
  () => props.modelValue,
  async (visible) => {
    const epoch = transitionEpoch.value + 1;
    transitionEpoch.value = epoch;

    if (visible) {
      await prepareOpen(epoch);
      return;
    }

    prepareClose(epoch);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  pendingCloseEpoch.value = 0;
  unbindEscape();
  unlockScroll();
});

function handleAfterEnter() {
  emit('after-open');
}

function handleAfterLeave() {
  if (props.modelValue || pendingCloseEpoch.value !== transitionEpoch.value) {
    return;
  }

  if (props.destroyOnClose) {
    rendered.value = false;
  }

  pendingCloseEpoch.value = 0;
  emit('after-close');
}
</script>
