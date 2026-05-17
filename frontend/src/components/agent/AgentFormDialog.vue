<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="isEdit ? $t('agent.editAgent') : $t('agent.createAgent')"
    width="520px"
  >
    <el-form data-testid="agent-form" label-position="top" class="agent-form" @submit.prevent="emit('save')">
      <el-form-item :label="$t('agent.agentName')">
        <el-input v-model="localForm.name" data-testid="agent-name-input" maxlength="200" show-word-limit />
      </el-form-item>

      <div class="form-grid form-grid--2">
        <el-form-item :label="$t('agent.agentType')">
          <el-select v-model="localForm.executorType" data-testid="agent-executor-type-select" style="width: 100%">
            <el-option value="CLAUDE_CODE" :label="$t('agent.types.CLAUDE_CODE')" />
            <el-option value="OPEN_CODE" :label="$t('agent.types.OPEN_CODE')" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('agent.role')">
          <el-select v-model="localForm.role" style="width: 100%" @change="emit('role-change')">
            <el-option v-for="opt in roleOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item :label="$t('agent.skills')">
        <div class="form-stack">
          <el-select v-model="localSkillToAdd" :placeholder="$t('agent.selectExistingSkill')" style="width: 100%" @change="addSkill">
            <el-option v-for="skill in availableSkillOptions" :key="skill" :value="skill" :label="skillStore.skills.find(s => s.id === skill)?.name" />
          </el-select>
          <div class="form-tag-list">
            <el-tag v-for="(skillId, index) in localForm.skills" :key="index" closable @close="removeSkill(index)">
              {{ skillStore.skills.find(s => s.id === skillId)?.name }}
            </el-tag>
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="$t('agent.mcpServers')">
        <div class="form-stack">
          <el-select v-model="localMcpToAdd" :placeholder="$t('agent.selectMcpServer')" style="width: 100%" @change="addMcp">
            <el-option v-for="server in availableMcpOptions" :key="server.id" :value="server.id" :label="server.name" />
          </el-select>
          <div class="form-tag-list">
            <el-tag v-for="(serverId, index) in localForm.mcpServers" :key="index" closable @close="removeMcp(index)">
              {{ mcpServerStore.mcpServers.find(s => s.id === serverId)?.name }}
            </el-tag>
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="$t('agent.description')">
        <el-input v-model="localForm.description" type="textarea" :rows="2" :placeholder="$t('agent.descriptionPlaceholder')" maxlength="5000" show-word-limit />
      </el-form-item>

      <el-form-item :label="$t('agent.env')">
        <div class="form-stack">
          <div v-for="(item, index) in localForm.envPairs" :key="index" class="env-pair-row">
            <el-input v-model="item.key" :placeholder="$t('agent.envKey')" class="env-input" />
            <span class="env-eq">=</span>
            <el-input v-model="item.value" :placeholder="$t('agent.envValue')" class="env-input" />
            <button type="button" class="env-remove-btn" @click="removeEnvPair(index)">×</button>
          </div>
          <button type="button" class="add-env-btn" @click="addEnvPair">+ {{ $t('agent.addEnvVar') }}</button>
        </div>
      </el-form-item>

      <el-form-item v-if="localForm.executorType === 'CLAUDE_CODE'" :label="$t('agent.settingsPath')">
        <el-input v-model="localForm.settingsPath" :placeholder="$t('agent.settingsPathPlaceholder')" maxlength="500" />
        <div class="form-hint">{{ $t('agent.settingsPathHint') }}</div>
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="localForm.enabled">{{ $t('common.enabled') }}</el-checkbox>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="saving" @click="emit('save')">{{ saving ? $t('common.loading') : $t('common.save') }}</el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSkillStore } from '../../stores/skillStore'
import { useMcpServerStore } from '../../stores/mcpServerStore'
import { ROLE_CONFIG, BUILTIN_AGENT_ROLES } from '../../constants/agent'
import BaseDialog from '../../components/BaseDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  form: { type: Object, required: true },
  saving: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'save', 'role-change', 'close'])

const { locale } = useI18n()
const skillStore = useSkillStore()
const mcpServerStore = useMcpServerStore()

const localForm = computed(() => props.form)

const localSkillToAdd = computed({
  get: () => props.form._selectedSkill || '',
  set: (val) => emit('update:selected-skill', val)
})

const localMcpToAdd = computed({
  get: () => props.form._selectedMcp || '',
  set: (val) => emit('update:selected-mcp', val)
})

const roleOptions = computed(() => {
  return Object.entries(ROLE_CONFIG)
    .filter(([key]) => !BUILTIN_AGENT_ROLES.has(key))
    .map(([key, config]) => ({
      value: key,
      label: locale.value === 'zh' ? config.name : config.nameEn
    }))
})

const availableSkillOptions = computed(() => {
  const all = skillStore.skills.map(s => s.id)
  return all.filter(id => !props.form.skills.includes(id))
})

const availableMcpOptions = computed(() => {
  return mcpServerStore.mcpServers.filter(s => !props.form.mcpServers.includes(s.id))
})

function addSkill() {
  if (localSkillToAdd.value && !props.form.skills.includes(localSkillToAdd.value)) {
    emit('add-skill', localSkillToAdd.value)
  }
}

function removeSkill(index) {
  emit('remove-skill', index)
}

function addMcp() {
  if (localMcpToAdd.value && !props.form.mcpServers.includes(localMcpToAdd.value)) {
    emit('add-mcp', localMcpToAdd.value)
  }
}

function removeMcp(index) {
  emit('remove-mcp', index)
}

function addEnvPair() {
  emit('add-env-pair')
}

function removeEnvPair(index) {
  emit('remove-env-pair', index)
}
</script>

<style scoped>
.agent-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.agent-form :deep(.el-form-item__label) {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--text-secondary) !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 6px !important;
  line-height: 1.4 !important;
}

.agent-form :deep(.el-input__wrapper),
.agent-form :deep(.el-textarea__inner) {
  background: #fff;
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: 8px;
  transition: box-shadow 0.18s ease;
}

.agent-form :deep(.el-input__wrapper:hover),
.agent-form :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--accent-color-soft, rgba(37, 198, 201, 0.5)) inset;
}

.agent-form :deep(.el-input.is-focus .el-input__wrapper),
.agent-form :deep(.el-input__wrapper.is-focus),
.agent-form :deep(.el-textarea__inner:focus) {
  box-shadow:
    0 0 0 1px var(--accent-color) inset,
    0 0 0 3px rgba(37, 198, 201, 0.12);
}

.agent-form :deep(.el-input__inner) {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid--2 {
  grid-template-columns: 1fr 1fr;
}

.form-grid--2 :deep(.el-form-item) {
  margin-bottom: 0;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.form-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.form-tag-list :deep(.el-tag) {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.12));
  border-color: transparent;
  color: var(--accent-color-strong, #0d8c8e);
  font-size: 12px;
  font-weight: 500;
}

.form-tag-list :deep(.el-tag .el-tag__close) {
  color: var(--accent-color-strong, #0d8c8e);
}

.form-tag-list :deep(.el-tag .el-tag__close:hover) {
  background: rgba(37, 198, 201, 0.2);
  color: var(--accent-color-strong, #0d8c8e);
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.env-pair-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.env-input {
  flex: 1;
}

.env-eq {
  color: var(--text-secondary);
  font-weight: 600;
  flex-shrink: 0;
}

.env-remove-btn {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.env-remove-btn:hover {
  opacity: 1;
}

.add-env-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.add-env-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}
</style>
