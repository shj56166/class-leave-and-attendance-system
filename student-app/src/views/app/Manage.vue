<template>
  <div class="manage-page">
    <section class="manage-hero">
      <p class="manage-hero__eyebrow">{{ text.heroEyebrow }}</p>
      <h2 class="manage-hero__title">{{ text.heroTitle }}</h2>
      <p class="manage-hero__text">
        {{ canUseManage ? text.heroCadreText : text.heroLockedText }}
      </p>
    </section>

    <template v-if="canUseManage">
      <section class="feature-card">
        <div class="feature-card__header">
          <div class="feature-card__title-row">
            <span class="feature-card__icon feature-card__icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="14" rx="3.4" stroke="currentColor" stroke-width="1.9" />
                <path d="M8 9.5H16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M8 13.5H12.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                <path d="M15.5 13.5H16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
            <div class="feature-card__heading">
              <h3 class="feature-card__title">{{ text.featureTitle }}</h3>
              <p class="feature-card__subtitle">{{ `${text.studentCountPrefix} ${students.length} ${text.studentCountSuffix}` }}</p>
            </div>
          </div>
          <button
            type="button"
            class="icon-button"
            :class="{ 'icon-button--spinning': contextLoading }"
            :disabled="contextLoading"
            :aria-label="text.refreshAction"
            :title="text.refreshAction"
            @click="loadContext"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 11A8 8 0 1 0 18.13 16.13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M20 4V11H13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div class="feature-card__body">
          <div v-if="hasCurrentSlotReminder" class="slot-reminder">
            <p class="slot-reminder__title">{{ text.currentSlotReminderTitle }}</p>
            <p class="slot-reminder__text">{{ currentSlotReminderText }}</p>
          </div>

          <div class="feature-card__slot">
            <p class="feature-card__slot-label">{{ text.slotLabel }}</p>
            <p class="feature-card__slot-value">{{ slotTitle }}</p>
            <p class="feature-card__slot-text">{{ slotDescription }}</p>
          </div>

          <div v-if="slotCandidates.length" class="course-candidates">
            <button
              v-for="candidate in slotCandidates"
              :key="candidate.selectionKey"
              type="button"
              class="course-candidate"
              :class="{ 'course-candidate--active': selectedCoursePeriod === candidate.period }"
              @click="selectCourseCandidate(candidate)"
            >
              <span class="course-candidate__title">{{ candidate.slotLabel }}</span>
              <span class="course-candidate__meta">
                {{ candidate.hasSubmission ? text.courseSubmittedTag : text.coursePendingTag }}
              </span>
            </button>
          </div>

          <div class="preview-panel">
            <div class="preview-panel__head">
              <div class="preview-panel__heading">
                <h4 class="preview-panel__title">{{ text.previewTitle }}</h4>
                <p class="preview-panel__description">{{ text.previewEyebrow }}</p>
              </div>
              <div class="preview-panel__tools">
                <span v-if="previewLoading" class="feature-meta-pill">{{ text.previewLoading }}</span>
                <button
                  type="button"
                  class="preview-trigger"
                  :disabled="contextLoading || !students.length || !canInteractWithCheck"
                  :aria-label="text.openPicker"
                  :title="text.openPicker"
                  @click="openPicker"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M16 21V19C16 17.8954 15.1046 17 14 17H6C4.89543 17 4 17.8954 4 19V21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="10" cy="11" r="4" stroke="currentColor" stroke-width="1.9" />
                    <path d="M17 8L19 10L22 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span>{{ text.openPickerShort }}</span>
                </button>
              </div>
            </div>

            <p v-if="!draftSelectedStudentIds.length && !currentSlotSubmission" class="preview-panel__empty">
              {{ text.previewEmptyValue }}
            </p>
            <template v-else>
              <div class="result-row result-row--preview">
                <span class="result-row__label">{{ text.selectedStudentsLabel }}</span>
                <p class="result-row__value">{{ joinStudentNames(draftPreview.selectedStudents) }}</p>
              </div>

              <div class="result-row result-row--preview">
                <span class="result-row__label">{{ text.truancyStudentsLabel }}</span>
                <p class="result-row__value result-row__value--danger">{{ joinStudentNames(draftPreview.truancyStudents) }}</p>
              </div>

              <div v-if="draftPreview.questionStudents?.length" class="result-row result-row--preview">
                <span class="result-row__label">{{ text.questionStudentsLabel }}</span>
                <p class="result-row__value result-row__value--warning">{{ joinStudentNames(draftPreview.questionStudents) }}</p>
              </div>
            </template>
          </div>
        </div>

        <div class="feature-card__footer">
          <div class="feature-card__actions">
            <div class="feature-card__icon-actions">
              <button
                type="button"
                class="icon-button"
                :disabled="submitting || !draftSelectedStudentIds.length"
                :aria-label="text.clearDraft"
                :title="text.clearDraft"
                @click="clearDraft"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 6H21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                  <path d="M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M19 6L18.133 18.142C18.0588 19.1801 17.1948 20 16.154 20H7.846C6.80517 20 5.9412 19.1801 5.867 18.142L5 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10 10V16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                  <path d="M14 10V16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <button type="button" class="primary-button" :disabled="contextLoading || submitting || !students.length || !canInteractWithCheck" @click="handleSubmitClick">
              {{ submitting ? text.submitLoading : submitButtonText }}
            </button>
          </div>
        </div>
      </section>

      <section v-if="latestSubmission" class="result-card">
        <div class="result-card__header">
          <div class="result-card__title-row">
            <span class="feature-card__icon feature-card__icon--indigo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5L9.2 16.7L19 6.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" stroke-width="1.6" opacity="0.6" />
              </svg>
            </span>
            <div class="result-card__heading">
              <h3 class="result-card__title">{{ formatSubmittedAt(latestSubmission.submittedAt) }}</h3>
              <p class="result-card__subtitle">{{ text.resultEyebrow }}</p>
            </div>
          </div>
          <div class="result-card__actions">
            <button
              type="button"
              class="icon-button icon-button--copy"
              :aria-label="text.copyButton"
              :title="text.copyButton"
              @click="copyResult"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.9" />
                <path d="M6 15H5C3.89543 15 3 14.1046 3 13V5C3 3.89543 3.89543 3 5 3H13C14.1046 3 15 3.89543 15 5V6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <div class="result-card__body">
          <div class="result-card__meta">
            <span class="feature-meta-pill">{{ `${text.submittedByPrefix} ${latestSubmission.submittedByName || text.emptyValue}` }}</span>
            <span class="feature-meta-pill">{{ latestSubmission.slotLabel || text.slotFallbackTitle }}</span>
          </div>

          <div class="result-row">
            <span class="result-row__label">{{ text.selectedStudentsLabel }}</span>
            <p class="result-row__value">{{ joinStudentNames(latestSubmission.selectedStudents) }}</p>
          </div>

          <div class="result-row">
            <span class="result-row__label">{{ text.truancyStudentsLabel }}</span>
            <p class="result-row__value result-row__value--danger">{{ joinStudentNames(latestSubmission.truancyStudents) }}</p>
          </div>

          <div v-if="latestSubmission.questionStudents?.length" class="result-row">
            <span class="result-row__label">{{ text.questionStudentsLabel }}</span>
            <p class="result-row__value result-row__value--warning">{{ joinStudentNames(latestSubmission.questionStudents) }}</p>
          </div>
        </div>
      </section>
    </template>

    <ProjectModal
      v-model="pickerVisible"
      :title="text.modalTitle"
      size="sm"
      overlay-class="classroom-check-overlay"
      panel-class="classroom-check-modal"
      body-class="classroom-check-modal__body"
    >
      <div class="modal-summary">
        <p class="modal-summary__title">{{ slotTitle }}</p>
        <p class="modal-summary__text">{{ slotDescription }}</p>
      </div>

      <label class="student-search" for="classroom-check-search">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <input
          id="classroom-check-search"
          v-model="searchKeyword"
          type="text"
          inputmode="search"
          :placeholder="text.searchPlaceholder"
          autocomplete="off"
        />
      </label>

      <div v-if="filteredStudents.length" class="student-options">
        <button
          v-for="student in filteredStudents"
          :key="student.studentId"
          type="button"
          class="student-option"
          :class="draftSelectedStudentIds.includes(student.studentId) ? 'student-option--active' : ''"
          @click="toggleStudent(student.studentId)"
        >
          <div class="student-option__body">
            <span class="student-option__name">{{ student.studentName }}</span>
            <span v-if="student.studentNumber" class="student-option__number">{{ `${text.studentNumberPrefix} ${student.studentNumber}` }}</span>
          </div>
          <span v-if="draftSelectedStudentIds.includes(student.studentId)" class="student-option__check">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
      <div v-else class="empty-state">
        <p class="empty-state__title">{{ text.emptyTitle }}</p>
        <p class="empty-state__text">{{ text.emptyText }}</p>
      </div>

      <template #footer>
        <div class="modal-footer">
          <p class="modal-footer__text">{{ modalFooterText }}</p>
          <div class="modal-footer__actions">
            <button type="button" class="ghost-button" @click="pickerVisible = false">{{ text.closeButton }}</button>
            <button type="button" class="primary-button" @click="pickerVisible = false">
              {{ text.finishPicker }}
            </button>
          </div>
        </div>
      </template>
    </ProjectModal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { showToast } from 'vant';
import ProjectModal from '../../components/ProjectModal.vue';
import {
  getClassroomCheckContext,
  previewClassroomCheck,
  submitClassroomCheck
} from '../../api/student';
import { useUserStore } from '../../stores/user';
import { copyText as copyTextWithFallback } from '../../utils/copyText';
import { formatApiDateTimeValue } from '../../utils/date';

const NAME_SEPARATOR = '、';
const text = {
  heroEyebrow: '班级管理',
  heroTitle: '学生端管理面板',
  heroCadreText: '教室核对现在只允许在上课前 10 分钟到下课后 10 分钟内提交；时间接近多门课时，需要你先明确选择课程。',
  heroLockedText: '管理页对所有学生可见，但只有老师任命的班干才能使用实际管理功能。',
  featureTitle: '教室学生核对',
  refreshAction: '刷新名单',
  slotLabel: '当前核对课程',
  studentCountPrefix: '班级学生',
  studentCountSuffix: '人',
  openPicker: '勾选未到学生',
  openPickerShort: '勾选',
  clearDraft: '清空草稿',
  manualSubmit: '提交当前课程核对',
  updateSubmit: '更新当前课程核对',
  previewEyebrow: '即时结果',
  previewTitle: '当前勾选预览',
  previewLoading: '分析中',
  previewEmptyValue: '暂未勾选，手动提交表示全员到齐。',
  resultEyebrow: '最新核对结果',
  copyButton: '一键复制',
  submittedByPrefix: '提交人',
  selectedStudentsLabel: '勾选未到',
  truancyStudentsLabel: '旷课名单',
  questionStudentsLabel: '疑问名单',
  modalTitle: '教室学生核对',
  searchPlaceholder: '搜索学生姓名或学号',
  studentNumberPrefix: '学号',
  emptyTitle: '没有找到对应学生',
  emptyText: '试试输入姓名中的一个字，或者检查学号。',
  closeButton: '关闭',
  finishPicker: '完成勾选',
  cancelButton: '取消',
  submitLoading: '提交中...',
  slotLoadingTitle: '正在准备核对信息',
  slotFallbackTitle: '请先选择课程',
  slotLoadingDescription: '系统会先判断当前处于哪门课程的可提交窗口，再去匹配对应课程的请假情况。',
  activeCourseDescription: '系统会按当前选中的课程窗口核对请假，并生成未到、旷课和疑问名单。',
  ambiguousDescription: '当前时间同时接近多门课程，必须先选定本次要核对的课程。',
  outOfWindowTitle: '当前不在可提交时间窗内',
  outOfWindowDescription: '只有上课前 10 分钟到下课后 10 分钟内才能提交课堂核对。',
  submittedPrefix: '提交于',
  submittedFallback: '刚刚提交',
  loadContextFallback: '加载核对名单失败',
  previewFallback: '刷新实时预览失败',
  submitSuccess: '教室核对已提交',
  updateSuccess: '当前课程核对已更新',
  submitFallback: '提交教室核对失败',
  copySuccess: '已复制核对结果',
  copyFallback: '复制失败，请稍后重试',
  footerPrefix: '已勾选',
  footerMiddle: '人。',
  footerSuffix: '关闭弹窗后不会提交，仍可回到页面手动提交。',
  draftEmptyValue: '当前还没有勾选学生，留空手动提交表示全员到齐。',
  emptyValue: '无',
  currentSlotReminderTitle: '当前课程已有提交',
  selectCourseFirst: '请先选择本次要核对的课程',
  courseSubmittedTag: '已有提交',
  coursePendingTag: '待新提交'
};

const userStore = useUserStore();

function createEmptyPreview() {
  return {
    selectedStudents: [],
    truancyStudents: [],
    questionStudents: [],
    copyText: ''
  };
}

const contextLoading = ref(false);
const previewLoading = ref(false);
const submitting = ref(false);
const pickerVisible = ref(false);
const searchKeyword = ref('');
const draftSelectedStudentIds = ref([]);
const draftPreview = ref(createEmptyPreview());
const students = ref([]);
const slot = ref(null);
const slotMode = ref('out_of_window');
const slotMessage = ref('');
const slotCandidates = ref([]);
const selectedCoursePeriod = ref(null);
const latestSubmission = ref(null);
const currentSlotSubmission = ref(null);
const permissionDenied = ref(false);
let previewTimer = 0;
let previewRequestToken = 0;

const isCadre = computed(() => userStore.user?.role === 'cadre');
const canUseManage = computed(() => isCadre.value && !permissionDenied.value);
const canInteractWithCheck = computed(() => Boolean(slot.value && selectedCoursePeriod.value));
const filteredStudents = computed(() => {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    return students.value;
  }

  return students.value.filter((student) => (
    String(student.studentName || '').includes(keyword)
    || String(student.studentNumber || '').includes(keyword)
  ));
});
const slotTitle = computed(() => {
  if (slotMode.value === 'out_of_window') {
    return text.outOfWindowTitle;
  }

  if (!slot.value && slotMode.value === 'ambiguous') {
    return text.slotFallbackTitle;
  }

  if (!slot.value) {
    return text.slotLoadingTitle;
  }

  return slot.value.slotLabel || text.slotFallbackTitle;
});
const slotDescription = computed(() => {
  if (slotMode.value === 'out_of_window') {
    return slotMessage.value || text.outOfWindowDescription;
  }

  if (slotMode.value === 'ambiguous' && !slot.value) {
    return slotMessage.value || text.ambiguousDescription;
  }

  if (!slot.value) {
    return text.slotLoadingDescription;
  }

  if (currentSlotSubmission.value) {
    return `${text.activeCourseDescription} 当前会在已有提交基础上更新名单。`;
  }

  return text.activeCourseDescription;
});
const submitButtonText = computed(() => (
  currentSlotSubmission.value ? text.updateSubmit : text.manualSubmit
));
const modalFooterText = computed(() => `${text.footerPrefix} ${draftSelectedStudentIds.value.length} ${text.footerMiddle}${text.footerSuffix}`);
const hasCurrentSlotReminder = computed(() => Boolean(currentSlotSubmission.value));
const currentSlotReminderText = computed(() => {
  if (!currentSlotSubmission.value) {
    return '';
  }

  return `当前课程已由 ${currentSlotSubmission.value.submittedByName || '班干'} 于 ${formatApiDateTimeValue(currentSlotSubmission.value.submittedAt, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })} 提交。系统已载入原名单，你这次保存会直接覆盖更新这一课程的核对结果。`;
});

function joinStudentNames(items = []) {
  return items.length ? items.map((item) => item.studentName).join(NAME_SEPARATOR) : text.emptyValue;
}

function formatSubmittedAt(value) {
  return value
    ? `${text.submittedPrefix} ${formatApiDateTimeValue(value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })}`
    : text.submittedFallback;
}

function openPicker() {
  if (!canInteractWithCheck.value) {
    showToast(slotMessage.value || text.selectCourseFirst);
    return;
  }

  searchKeyword.value = '';
  pickerVisible.value = true;
}

function resetDraftPreview() {
  draftPreview.value = createEmptyPreview();
  previewLoading.value = false;
}

function clearDraft() {
  draftSelectedStudentIds.value = [];
}

function toggleStudent(studentId) {
  if (draftSelectedStudentIds.value.includes(studentId)) {
    draftSelectedStudentIds.value = draftSelectedStudentIds.value.filter((item) => item !== studentId);
    return;
  }

  draftSelectedStudentIds.value = [...draftSelectedStudentIds.value, studentId];
}

function applyPreviewFromSubmission(submission) {
  draftPreview.value = {
    selectedStudents: submission?.selectedStudents || [],
    truancyStudents: submission?.truancyStudents || [],
    questionStudents: submission?.questionStudents || [],
    copyText: submission?.copyText || ''
  };
}

function syncDraftWithCurrentSubmission() {
  if (!currentSlotSubmission.value) {
    draftSelectedStudentIds.value = [];
    resetDraftPreview();
    return;
  }

  draftSelectedStudentIds.value = (currentSlotSubmission.value.selectedStudents || []).map((student) => student.studentId);
  applyPreviewFromSubmission(currentSlotSubmission.value);
}

function selectCourseCandidate(candidate) {
  selectedCoursePeriod.value = candidate.period;
  slot.value = candidate;
  currentSlotSubmission.value = candidate.existingSubmission || null;
  syncDraftWithCurrentSubmission();
}

function applyContextResponse(response) {
  students.value = response.students || [];
  slotMode.value = response.slotMode || 'out_of_window';
  slotMessage.value = response.slotMessage || '';
  slotCandidates.value = response.slotCandidates || [];
  latestSubmission.value = response.latestSubmission || null;
  permissionDenied.value = false;

  const validStudentIds = new Set(students.value.map((student) => student.studentId));
  draftSelectedStudentIds.value = draftSelectedStudentIds.value.filter((studentId) => validStudentIds.has(studentId));

  if (slotMode.value === 'single_course' && response.slot) {
    selectedCoursePeriod.value = response.slot.period;
    slot.value = response.slot;
    currentSlotSubmission.value = response.currentSlotSubmission || response.slot.existingSubmission || null;
    syncDraftWithCurrentSubmission();
    return;
  }

  const preservedCandidate = slotCandidates.value.find((candidate) => candidate.period === Number(selectedCoursePeriod.value));
  if (preservedCandidate) {
    selectCourseCandidate(preservedCandidate);
    return;
  }

  selectedCoursePeriod.value = null;
  slot.value = null;
  currentSlotSubmission.value = null;
  draftSelectedStudentIds.value = [];
  resetDraftPreview();
}

function applyClassroomCheckConflict(data = {}) {
  slotMessage.value = data.message || data.error || '';
  slotCandidates.value = data.candidates || [];

  if (data.code === 'CLASSROOM_CHECK_COURSE_SELECTION_REQUIRED') {
    slotMode.value = 'ambiguous';
    const preservedCandidate = slotCandidates.value.find((candidate) => candidate.period === Number(selectedCoursePeriod.value));
    if (preservedCandidate) {
      selectCourseCandidate(preservedCandidate);
      return;
    }
  } else {
    slotMode.value = 'out_of_window';
  }

  selectedCoursePeriod.value = null;
  slot.value = null;
  currentSlotSubmission.value = null;
  draftSelectedStudentIds.value = [];
  resetDraftPreview();
}

async function refreshDraftPreview(selectedIds, requestToken) {
  try {
    const response = await previewClassroomCheck({
      absentStudentIds: selectedIds,
      selectedCoursePeriod: selectedCoursePeriod.value
    });

    if (requestToken !== previewRequestToken) {
      return;
    }

    draftPreview.value = {
      selectedStudents: response.selectedStudents || [],
      truancyStudents: response.truancyStudents || [],
      questionStudents: response.questionStudents || [],
      copyText: response.copyText || ''
    };
  } catch (error) {
    if (requestToken !== previewRequestToken) {
      return;
    }

    resetDraftPreview();

    if (error.response?.status === 403) {
      permissionDenied.value = true;
      pickerVisible.value = false;
      return;
    }

    if (error.response?.status === 409) {
      applyClassroomCheckConflict(error.response.data);
      return;
    }

    showToast(error.response?.data?.error || text.previewFallback);
  } finally {
    if (requestToken === previewRequestToken) {
      previewLoading.value = false;
    }
  }
}

async function loadContext() {
  if (!isCadre.value) {
    return;
  }

  contextLoading.value = true;

  try {
    const response = await getClassroomCheckContext();
    applyContextResponse(response);
  } catch (error) {
    if (error.response?.status === 403) {
      permissionDenied.value = true;
      students.value = [];
      slot.value = null;
      slotMode.value = 'out_of_window';
      slotMessage.value = '';
      slotCandidates.value = [];
      selectedCoursePeriod.value = null;
      latestSubmission.value = null;
      currentSlotSubmission.value = null;
      draftSelectedStudentIds.value = [];
      resetDraftPreview();
      return;
    }

    showToast(error.response?.data?.error || text.loadContextFallback);
  } finally {
    contextLoading.value = false;
  }
}

async function submitDraft() {
  if (!canUseManage.value || submitting.value) {
    return;
  }

  submitting.value = true;

  try {
    const response = await submitClassroomCheck({
      absentStudentIds: draftSelectedStudentIds.value,
      selectedCoursePeriod: selectedCoursePeriod.value
    });

    pickerVisible.value = false;
    await loadContext();
    showToast(response.updatedExisting ? text.updateSuccess : text.submitSuccess);
  } catch (error) {
    if (error.response?.status === 403) {
      permissionDenied.value = true;
      pickerVisible.value = false;
      resetDraftPreview();
      return;
    }

    if (error.response?.status === 409) {
      applyClassroomCheckConflict(error.response.data);
      showToast(error.response?.data?.error || text.submitFallback);
      return;
    }

    showToast(error.response?.data?.error || text.submitFallback);
  } finally {
    submitting.value = false;
  }
}

function handleSubmitClick() {
  if (!canInteractWithCheck.value) {
    showToast(slotMessage.value || text.selectCourseFirst);
    return;
  }

  submitDraft();
}

async function copyResult() {
  if (!latestSubmission.value?.copyText) {
    return;
  }

  try {
    const copied = await copyTextWithFallback(latestSubmission.value.copyText);
    if (!copied) {
      return;
    }
    showToast(text.copySuccess);
  } catch (error) {
    showToast(text.copyFallback);
  }
}

watch(
  draftSelectedStudentIds,
  (value) => {
    previewRequestToken += 1;

    if (typeof window !== 'undefined') {
      window.clearTimeout(previewTimer);
    }

    if (!canUseManage.value || !selectedCoursePeriod.value) {
      resetDraftPreview();
      return;
    }

    if (!value.length) {
      if (currentSlotSubmission.value) {
        applyPreviewFromSubmission(currentSlotSubmission.value);
        previewLoading.value = false;
        return;
      }

      resetDraftPreview();
      return;
    }

    const selectedIds = [...value];
    const requestToken = previewRequestToken;
    previewLoading.value = true;
    const schedulePreview = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    previewTimer = schedulePreview(() => {
      refreshDraftPreview(selectedIds, requestToken);
    }, 180);
  },
  { deep: false }
);

watch(
  () => isCadre.value,
  (value) => {
    if (value) {
      loadContext();
      return;
    }

    resetDraftPreview();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.clearTimeout(previewTimer);
  }
});
</script>

<style scoped>
.manage-page {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  padding: clamp(18px, calc(12px + env(safe-area-inset-top, 0px)), 34px) 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.manage-hero {
  padding: 4px 2px 6px;
}

.manage-hero__eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #c76f09;
}

.manage-hero__title {
  margin: 6px 0 0;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(24px, 7.6vw, 29px);
  font-weight: 780;
  line-height: 1.08;
  letter-spacing: -0.055em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #15316e;
}

.manage-hero__text {
  margin: 10px 0 0;
  max-width: 32ch;
  font-size: 13px;
  line-height: 1.65;
  color: #5e739b;
}

.feature-card,
.result-card {
  width: 100%;
  border: 1px solid rgba(220, 230, 244, 0.92);
  border-radius: 20px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(248, 251, 255, 0.9);
  box-shadow: 0 8px 22px rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.feature-card__header,
.result-card__header {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.feature-card__title-row,
.result-card__title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-card__heading,
.preview-panel__heading {
  min-width: 0;
}

.feature-card__heading {
  min-width: 0;
}

.feature-card__title,
.result-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #15316e;
}

.feature-card__subtitle,
.result-card__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #6a7fa7;
}

.feature-card__icon {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 233, 246, 0.92);
  box-shadow: 0 6px 14px rgba(148, 163, 184, 0.08);
}

.feature-card__icon svg {
  width: 15px;
  height: 15px;
}

.feature-card__icon--blue {
  color: #3b82f6;
}

.feature-card__icon--indigo {
  color: #5b6ef5;
}

.feature-card__body,
.result-card__body {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(186, 201, 226, 0.72);
}

.slot-reminder {
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(241, 246, 255, 0.96) 0%, rgba(231, 240, 255, 0.86) 100%);
  border: 1px solid rgba(196, 212, 241, 0.92);
}

.slot-reminder__title {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #1d4ed8;
}

.slot-reminder__text {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: #54709c;
}

.feature-card__slot {
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 246, 255, 0.88) 100%);
  border: 1px solid rgba(214, 225, 242, 0.92);
}

.feature-card__slot-label {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #6a82ab;
}

.feature-card__slot-value {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 720;
  line-height: 1.45;
  color: #15316e;
}

.feature-card__slot-text {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #60779f;
}

.course-candidates {
  display: grid;
  gap: 10px;
}

.course-candidate {
  width: 100%;
  padding: 13px 14px;
  border-radius: 18px;
  border: 1px solid rgba(191, 219, 254, 0.92);
  background: rgba(255, 255, 255, 0.78);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  box-shadow: 0 10px 20px rgba(148, 163, 184, 0.08);
}

.course-candidate--active {
  border-color: rgba(37, 99, 235, 0.42);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(219, 234, 254, 0.82) 100%);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.14);
}

.course-candidate__title {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.55;
  color: #15316e;
}

.course-candidate__meta {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 800;
  color: #2563eb;
}

.feature-card__meta,
.result-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feature-meta-pill {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #4e6a98;
  background: rgba(239, 245, 255, 0.92);
  border: 1px solid rgba(211, 222, 241, 0.92);
}

.preview-panel {
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(239, 245, 255, 0.96) 0%, rgba(255, 255, 255, 0.76) 100%);
  border: 1px solid rgba(211, 222, 241, 0.92);
}

.preview-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preview-panel__description {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #6a7fa7;
}

.preview-panel__tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 760;
  color: #15316e;
}

.preview-trigger {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 10px 18px rgba(37, 99, 235, 0.08);
}

.preview-trigger svg {
  width: 16px;
  height: 16px;
}

.preview-panel__empty {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: #60779f;
}

.feature-card__footer {
  width: 100%;
}

.feature-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feature-card__icon-actions,
.result-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-button {
  flex: 1 1 auto;
}

.result-row {
  padding-top: 14px;
  border-top: 1px dashed rgba(186, 201, 226, 0.76);
}

.result-row:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.result-row__label {
  display: inline-flex;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #5473a0;
  background: rgba(240, 245, 255, 0.92);
}

.result-row__value {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.7;
  color: #15316e;
}

.result-row__value--danger {
  color: #b42318;
}

.result-row__value--warning {
  color: #b76b00;
}

.icon-button,
.primary-button,
.ghost-button {
  min-height: 42px;
  border: 0;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 800;
}

.icon-button {
  width: 42px;
  min-width: 42px;
  padding: 0;
  color: #5c739d;
  background: rgba(240, 245, 255, 0.9);
  border: 1px solid rgba(211, 222, 241, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 10px 18px rgba(148, 163, 184, 0.08);
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.icon-button--copy {
  color: #5b6ef5;
  background: rgba(240, 242, 255, 0.96);
  border-color: rgba(209, 216, 255, 0.92);
}

.icon-button--spinning svg {
  animation: manage-spin 0.85s linear infinite;
}

.primary-button {
  color: #ffffff;
  background: linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
  flex: 1 1 auto;
}

.ghost-button {
  color: #5c739d;
  background: rgba(240, 245, 255, 0.9);
  border: 1px solid rgba(211, 222, 241, 0.92);
}

.icon-button:disabled,
.preview-trigger:disabled,
.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.64;
}

.student-search {
  margin-top: 14px;
  min-height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.student-search svg {
  width: 18px;
  height: 18px;
  color: #4c71b1;
  flex: 0 0 auto;
}

.student-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: #183a7b;
}

.student-search input::placeholder {
  color: #87a1c8;
}

.modal-summary__title {
  margin: 0;
  font-size: 17px;
  font-weight: 760;
  line-height: 1.45;
  color: #15316e;
}

.modal-summary__text {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #60779f;
}

.student-options {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.student-option {
  width: 100%;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 251, 255, 0.64) 100%);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
  text-align: left;
}

.student-option--active {
  border-color: rgba(37, 99, 235, 0.34);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(219, 234, 254, 0.72) 100%);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.16);
}

.student-option__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.student-option__name {
  font-size: 16px;
  font-weight: 700;
  color: #15316e;
}

.student-option__number {
  font-size: 12px;
  color: #6b80a6;
}

.student-option__check {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
  flex: 0 0 auto;
}

.student-option__check svg {
  width: 16px;
  height: 16px;
}

.empty-state {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  color: #63799f;
}

.empty-state__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 760;
  color: #15316e;
}

.empty-state__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.modal-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-footer__text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #60779f;
}

.modal-footer__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 375px) {
  .manage-page {
    padding: clamp(16px, calc(10px + env(safe-area-inset-top, 0px)), 28px) 12px 8px;
  }

  .feature-card,
  .result-card {
    padding: 13px;
    border-radius: 18px;
  }

  .feature-card__actions {
    align-items: stretch;
    gap: 12px;
  }

  .feature-card__header,
  .result-card__header,
  .preview-panel__head {
    gap: 10px;
  }

  .result-card__actions {
    flex-shrink: 0;
  }
}

@keyframes manage-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-button--spinning svg {
    animation: none;
  }
}
</style>

<style>
.classroom-check-overlay {
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0%, rgba(191, 219, 254, 0.14) 22%, rgba(15, 23, 42, 0.3) 68%),
    rgba(224, 242, 254, 0.16);
}

.ui-can-blur .classroom-check-overlay {
  backdrop-filter: blur(22px) saturate(135%);
  -webkit-backdrop-filter: blur(22px) saturate(135%);
}

.classroom-check-modal {
  max-height: min(82vh, 720px);
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 250, 252, 0.62) 100%);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    0 35px 80px rgba(15, 23, 42, 0.16),
    0 20px 44px rgba(59, 130, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.ui-can-blur .classroom-check-modal {
  backdrop-filter: blur(30px) saturate(145%);
  -webkit-backdrop-filter: blur(30px) saturate(145%);
}

.classroom-check-modal .project-modal-title {
  font-size: 23px;
  font-weight: 760;
  letter-spacing: -0.04em;
  color: #102a74;
}

.classroom-check-modal__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 14px 16px;
  overflow-y: auto;
}

.classroom-check-modal .project-modal-footer {
  padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.58);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.34) 100%);
}
</style>
