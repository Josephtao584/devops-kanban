<template>
  <div v-if="step" class="step-editor-card">
    <div
      v-if="isMissing || isDisabled || typeof step.agentId !== 'number'"
      class="step-editor-state-row binding-state-row"
    >
      <el-tag v-if="isMissing" type="danger">
        {{ $t('workflowTemplate.missingAgent', { id: step.agentId }) }}
      </el-tag>
      <el-tag v-else-if="isDisabled" type="warning">
        {{ formatBoundAgentState }}
      </el-tag>
      <el-tag v-else-if="typeof step.agentId !== 'number'" type="info">
        {{ $t('workflowTemplate.unassignedAgent') }}
      </el-tag>
    </div>

    <div class="step-editor-grid">
      <div class="editor-field editor-field--full editor-field--agent">
        <label class="editor-field__label-strong">{{ $t('workflowTemplate.executor') }}</label>
        <el-select
          v-model="step.agentId"
          clearable
          class="agent-picker"
          :placeholder="$t('workflowTemplate.unassignedAgent')"
          style="width: 100%"
        >
          <el-option
            v-for="agent in agents"
            :key="agent.id"
            :label="formatWorkflowAgentOption(agent)"
            :value="agent.id"
            :disabled="agent.enabled === false"
          />
        </el-select>
      </div>

      <div class="editor-field editor-field--full">
        <label>{{ $t('workflowTemplate.stepName') }}</label>
        <el-input
          v-model="step.name"
          :placeholder="$t('workflowTemplate.stepNamePlaceholder')"
          maxlength="200"
          show-word-limit
        />
      </div>

      <div class="editor-field editor-field--full">
        <label>{{ $t('workflowTemplate.stepOptions', '选项') }}</label>
        <div class="step-options">
          <label class="step-option">
            <el-switch v-model="step.requiresConfirmation" size="small" />
            <span class="step-option__label">{{ $t('workflowTemplate.requiresConfirmation') }}</span>
          </label>
          <label class="step-option">
            <el-switch v-model="step.canEarlyExit" size="small" />
            <span class="step-option__label">{{ $t('workflowTemplate.canEarlyExit') }}</span>
          </label>
        </div>
      </div>

      <div class="editor-field editor-field--full">
        <label>{{ $t('workflowTemplate.failureLoopTo') }}</label>
        <el-select
          v-model="step.onFailureLoopTo"
          clearable
          :placeholder="$t('workflowTemplate.failureLoopToHint')"
          data-test="step-on-failure-loop-to"
        >
          <el-option
            v-for="prior in priorSteps"
            :key="prior.id"
            :value="prior.id"
            :label="prior.name || prior.id"
          />
        </el-select>
      </div>

      <div v-if="step.type === 'SPLIT_TASK'" class="editor-field editor-field--full step-type-field">
        <label>{{ $t('workflowTemplate.stepType') }}</label>
        <div class="editor-field__row">
          <el-tag type="info">{{ $t('workflowTemplate.stepTypeSplit') }}</el-tag>
          <span class="step-type-hint">
            {{ $t('workflowTemplate.stepTypeSplitHint') }}
          </span>
        </div>
      </div>
    </div>

    <div class="editor-field editor-field--full editor-field--prompt">
      <div class="editor-field__head">
        <label>{{ $t('workflowTemplate.instructionPrompt') }}</label>
        <el-button class="preview-prompt-btn" plain size="small" @click.stop="emit('preview-prompt')">
          {{ $t('workflowTemplate.previewPrompt') }}
        </el-button>
      </div>
      <div class="editor-field__hint">{{ $t('workflowTemplate.deliveryPromptGuidance') }}</div>
      <div v-if="step.type === 'SPLIT_TASK'" class="editor-field__hint split-prompt-hint">
        AI 拆分逻辑由内置的 task-splitter Skill 提供详细规则；此处 prompt 用于引导 Agent 调用该 Skill 并传入上下文。
      </div>
      <el-input
        v-model="step.instructionPrompt"
        type="textarea"
        :rows="6"
        resize="vertical"
        :placeholder="$t('workflowTemplate.instructionPromptHint')"
        :maxlength="2000"
        show-word-limit
      />
    </div>
  </div>

  <div v-else class="state-block compact">{{ $t('workflowTemplate.selectStepHint') }}</div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getAgentDisplayName,
  formatAgentOption,
  createAgentLookup,
  isMissingAgent as checkMissingAgent,
  isDisabledAgent as checkDisabledAgent,
  formatBoundAgentState as formatAgentBindingState,
} from '../../components/workflow/templateEditorShared.js'

const props = defineProps({
  step: { type: Object, default: null },
  agents: { type: Array, default: () => [] },
  agentsLoaded: { type: Boolean, default: false },
  agentsLoadFailed: { type: Boolean, default: false },
  priorSteps: { type: Array, default: () => [] }
})

const emit = defineEmits(['preview-prompt'])

const { t } = useI18n()
const getAgentById = computed(() => createAgentLookup(props.agents))
const isMissing = computed(() => {
  if (!props.agentsLoaded || props.agentsLoadFailed) return false
  return checkMissingAgent(props.step, getAgentById.value)
})
const isDisabled = computed(() => checkDisabledAgent(props.step, getAgentById.value))
const formatBoundAgentState = computed(() => formatAgentBindingState(props.step, getAgentById.value, t))
const formatWorkflowAgentOption = (agent) => formatAgentOption(agent, t)
</script>

<style scoped>
.step-editor-card {
  position: relative;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.step-editor-state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.binding-state-row {
  min-height: 24px;
}

.step-editor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 520px;
}

.step-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.step-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: #fff;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.step-option:hover {
  border-color: var(--accent-color-soft, rgba(37, 198, 201, 0.4));
  background: rgba(37, 198, 201, 0.04);
}

.step-option__label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  user-select: none;
}

.editor-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

.editor-field__head label {
  margin: 0;
}

.step-type-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.editor-field--agent {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--accent-color-soft);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.08) 0%, rgba(37, 198, 201, 0.02) 60%),
    linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
  margin-bottom: 4px;
}

.editor-field__label-strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  letter-spacing: 0.02em;
}

.editor-field__label-strong::before {
  content: '';
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: var(--accent-color);
}

.agent-picker :deep(.el-input__wrapper) {
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

.agent-picker :deep(.el-input__wrapper:hover),
.agent-picker :deep(.el-select .el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--accent-color) inset;
}

.agent-picker :deep(.el-input__inner) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.editor-field--full {
  grid-column: 1 / -1;
}

.editor-field label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.editor-field :deep(.el-input__wrapper),
.editor-field :deep(.el-textarea__inner) {
  background: #fff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

.editor-field :deep(.el-input__wrapper:hover),
.editor-field :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--accent-color-soft, rgba(37, 198, 201, 0.5)) inset;
}

.editor-field :deep(.el-input.is-focus .el-input__wrapper),
.editor-field :deep(.el-input__wrapper.is-focus),
.editor-field :deep(.el-textarea__inner:focus) {
  box-shadow:
    0 0 0 1px var(--accent-color) inset,
    0 0 0 3px rgba(37, 198, 201, 0.12);
}

.editor-field :deep(.el-input__inner) {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.editor-field__hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.editor-field--prompt {
  margin-top: 12px;
}

.preview-prompt-btn {
  flex-shrink: 0;
}

.state-block {
  padding: 28px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.state-block.compact {
  padding: 20px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
}
</style>
