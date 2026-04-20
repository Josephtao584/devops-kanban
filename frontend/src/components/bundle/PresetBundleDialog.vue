<template>
  <BaseDialog :model-value="modelValue" :title="$t('preset.library')" width="800px" @close="handleClose">
    <div class="preset-dialog">
      <div class="preset-description">{{ $t('preset.description') }}</div>

      <div v-if="loading" class="preset-loading">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span>{{ $t('common.loading') }}</span>
      </div>

      <div v-else-if="loadError" class="preset-error">
        <span>{{ loadError }}</span>
        <el-button size="small" @click="loadPresets">{{ $t('workflowTemplate.retry') }}</el-button>
      </div>

      <div v-else-if="presets.length === 0" class="preset-empty">
        {{ $t('preset.noPresets') }}
      </div>

      <div v-else class="preset-grid">
        <div
          v-for="preset in presets"
          :key="preset.name"
          class="preset-card"
        >
          <div class="preset-card__header">
            <span class="preset-card__name">{{ preset.displayName || preset.name }}</span>
            <el-tag v-if="isInstalled(preset)" type="success" size="small">
              {{ $t('preset.installed') }}
            </el-tag>
          </div>
          <div class="preset-card__desc">{{ preset.description }}</div>
          <div v-if="preset.tags && preset.tags.length" class="preset-card__tags">
            <el-tag
              v-for="tag in preset.tags"
              :key="tag"
              size="small"
              type="info"
              effect="plain"
              class="preset-tag"
            >
              {{ tag }}
            </el-tag>
          </div>
          <div class="preset-card__footer">
            <template v-if="isInstalled(preset)">
              <el-button size="small" disabled>{{ $t('preset.installed') }}</el-button>
            </template>
            <template v-else-if="installingPreset === preset.name">
              <el-button size="small" type="primary" loading>
                {{ $t('preset.installing') }}
              </el-button>
            </template>
            <template v-else>
              <el-dropdown trigger="click" @command="(cmd) => handleInstall(preset.name, cmd)">
                <el-button size="small" type="primary">
                  {{ $t('preset.install') }}
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="copy">{{ $t('preset.strategyCopy') }}</el-dropdown-item>
                    <el-dropdown-item command="overwrite">{{ $t('preset.strategyOverwrite') }}</el-dropdown-item>
                    <el-dropdown-item command="skip">{{ $t('preset.strategySkip') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ $t('common.close') }}</el-button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import BaseDialog from '../BaseDialog.vue'
import { getPresets, importPreset } from '../../api/presets.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'imported'])

const { t } = useI18n()

const loading = ref(false)
const loadError = ref('')
const presets = ref([])
const installedNames = ref(new Set())
const installingPreset = ref('')

const loadPresets = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getPresets()
    if (!res?.success) {
      loadError.value = res?.message || t('preset.loadFailed')
      return
    }
    const data = res.data || []
    presets.value = Array.isArray(data) ? data : []
    installedNames.value = new Set(
      presets.value.filter(p => p.installed).map(p => p.name)
    )
  } catch (e) {
    loadError.value = e?.message || t('preset.loadFailed')
  } finally {
    loading.value = false
  }
}

const isInstalled = (preset) => installedNames.value.has(preset.name)

const handleInstall = async (name, strategy) => {
  installingPreset.value = name
  try {
    const res = await importPreset(name, strategy)
    if (!res?.success) {
      ElMessage.error(res?.message || t('preset.installFailed'))
      return
    }
    installedNames.value.add(name)
    ElMessage.success(t('preset.installSuccess'))
    emit('imported')
  } catch (e) {
    ElMessage.error(e?.message || t('preset.installFailed'))
  } finally {
    installingPreset.value = ''
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  if (val && presets.value.length === 0) {
    loadPresets()
  }
})
</script>

<style scoped>
.preset-dialog {
  min-height: 120px;
}

.preset-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.preset-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.preset-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  color: var(--el-color-danger);
  font-size: var(--font-size-sm);
}

.preset-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preset-card:hover {
  border-color: rgba(37, 198, 201, 0.24);
  box-shadow: var(--shadow-sm);
}

.preset-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preset-card__name {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-primary);
}

.preset-card__desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.preset-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.preset-tag {
  border-radius: 4px;
}

.preset-card__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  margin-top: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
