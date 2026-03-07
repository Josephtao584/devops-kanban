<template>
  <div class="phase-transition-config">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ $t('phaseTransition.title') }}</span>
          <div class="header-actions">
            <el-button size="small" @click="openNewRuleDialog">
              <el-icon><Plus /></el-icon>
              {{ $t('phaseTransition.newRule') }}
            </el-button>
            <el-button type="primary" size="small" @click="initializeDefaults" :loading="phaseTransitionStore.initializing">
              {{ $t('phaseTransition.initializeDefaults') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Search and Filter -->
      <div class="filter-bar">
        <el-input
          v-model="searchText"
          :placeholder="$t('common.search')"
          clearable
          style="width: 200px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterPhase" :placeholder="$t('phaseTransition.filterByPhase')" clearable style="width: 150px">
          <el-option v-for="phase in phases" :key="phase" :label="phase" :value="phase" />
        </el-select>
      </div>

      <el-table :data="paginatedRules" v-loading="phaseTransitionStore.loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="fromPhase" :label="$t('phaseTransition.fromPhase')" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.fromPhase }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="toPhase" :label="$t('phaseTransition.toPhase')" width="120">
          <template #default="{ row }">
            <el-tag type="success">{{ row.toPhase }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="completionKeywords" :label="$t('phaseTransition.completionKeywords')" min-width="200">
          <template #default="{ row }">
            <div class="keywords-cell">
              <el-tag v-for="(keyword, idx) in parseKeywords(row.completionKeywords)" :key="idx" size="small" type="success" class="keyword-tag">
                {{ keyword }}
              </el-tag>
              <span v-if="!parseKeywords(row.completionKeywords).length" class="no-keywords">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="failureKeywords" :label="$t('phaseTransition.failureKeywords')" min-width="150">
          <template #default="{ row }">
            <div class="keywords-cell">
              <el-tag v-for="(keyword, idx) in parseKeywords(row.failureKeywords)" :key="idx" size="small" type="danger" class="keyword-tag">
                {{ keyword }}
              </el-tag>
              <span v-if="!parseKeywords(row.failureKeywords).length" class="no-keywords">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="rollbackPhase" :label="$t('phaseTransition.rollbackPhase')" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.rollbackPhase" type="warning">{{ row.rollbackPhase }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="priority" :label="$t('phaseTransition.priority')" width="80" align="center" />
        <el-table-column :label="$t('phaseTransition.autoTransition')" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.autoTransition" @change="handleToggleUpdate(row)" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('phaseTransition.enabled')" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="handleToggleUpdate(row)" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editRule(row)">{{ $t('common.edit') }}</el-button>
            <el-button size="small" type="danger" @click="deleteRule(row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20, 50]"
          :total="filteredRules.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <!-- Edit Rule Dialog -->
    <el-dialog v-model="dialogVisible" :title="isNewRule ? $t('phaseTransition.newRule') : $t('phaseTransition.editRule')" width="650px">
      <el-form :model="editingRule" :rules="formRules" ref="formRef" label-width="160px">
        <el-form-item :label="$t('phaseTransition.fromPhase')" prop="fromPhase">
          <el-select v-model="editingRule.fromPhase" style="width: 100%">
            <el-option v-for="phase in phases" :key="phase" :label="phase" :value="phase" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('phaseTransition.toPhase')" prop="toPhase">
          <el-select v-model="editingRule.toPhase" style="width: 100%">
            <el-option v-for="phase in phases" :key="phase" :label="phase" :value="phase" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('phaseTransition.completionKeywords')" prop="completionKeywords">
          <el-select
            v-model="editingCompletionKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :placeholder="$t('phaseTransition.keywordsHint')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="$t('phaseTransition.failureKeywords')">
          <el-select
            v-model="editingFailureKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :placeholder="$t('phaseTransition.keywordsHint')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="$t('phaseTransition.rollbackPhase')">
          <el-select v-model="editingRule.rollbackPhase" clearable style="width: 100%">
            <el-option v-for="phase in phases" :key="phase" :label="phase" :value="phase" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('phaseTransition.priority')" prop="priority">
          <el-input-number v-model="editingRule.priority" :min="1" :max="100" />
        </el-form-item>
        <el-row>
          <el-col :span="8">
            <el-form-item :label="$t('phaseTransition.autoTransition')">
              <el-switch v-model="editingRule.autoTransition" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('phaseTransition.autoRollback')">
              <el-switch v-model="editingRule.autoRollback" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('phaseTransition.enabled')">
              <el-switch v-model="editingRule.enabled" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveRule" :loading="saving">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { usePhaseTransitionStore } from '@/stores/phaseTransitionStore'

const { t } = useI18n()
const phaseTransitionStore = usePhaseTransitionStore()
const formRef = ref(null)

const saving = ref(false)
const dialogVisible = ref(false)
const isNewRule = ref(false)
const editingRule = ref({})
const editingCompletionKeywords = ref([])
const editingFailureKeywords = ref([])

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Filter
const searchText = ref('')
const filterPhase = ref('')

const phases = ['TODO', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'RELEASE', 'DONE']

// Form validation rules
const formRules = {
  fromPhase: [
    { required: true, message: t('validation.required'), trigger: 'change' }
  ],
  toPhase: [
    { required: true, message: t('validation.required'), trigger: 'change' }
  ],
  priority: [
    { required: true, message: t('validation.required'), trigger: 'blur' }
  ]
}

// Filtered rules
const filteredRules = computed(() => {
  let result = phaseTransitionStore.rules
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    result = result.filter(r =>
      r.fromPhase?.toLowerCase().includes(search) ||
      r.toPhase?.toLowerCase().includes(search)
    )
  }
  if (filterPhase.value) {
    result = result.filter(r =>
      r.fromPhase === filterPhase.value || r.toPhase === filterPhase.value
    )
  }
  return result
})

// Paginated rules
const paginatedRules = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredRules.value.slice(start, end)
})

const loadRules = async () => {
  await phaseTransitionStore.fetchRules()
}

const initializeDefaults = async () => {
  const success = await phaseTransitionStore.initializeDefaultRules()
  if (success) {
    ElMessage.success(t('phaseTransition.initializeSuccess'))
  } else {
    ElMessage.error(phaseTransitionStore.error || t('phaseTransition.initializeFailed'))
  }
}

const parseKeywords = (keywordsJson) => {
  return phaseTransitionStore.parseKeywords(keywordsJson)
}

const keywordsToJson = (keywords) => {
  return phaseTransitionStore.keywordsToJson(keywords)
}

const resetForm = () => {
  editingRule.value = {
    fromPhase: '',
    toPhase: '',
    completionKeywords: '[]',
    failureKeywords: '[]',
    rollbackPhase: '',
    autoTransition: true,
    autoRollback: false,
    enabled: true,
    priority: 10
  }
  editingCompletionKeywords.value = []
  editingFailureKeywords.value = []
  isNewRule.value = false
}

const openNewRuleDialog = () => {
  resetForm()
  isNewRule.value = true
  dialogVisible.value = true
}

const editRule = (rule) => {
  editingRule.value = { ...rule }
  editingCompletionKeywords.value = parseKeywords(rule.completionKeywords)
  editingFailureKeywords.value = parseKeywords(rule.failureKeywords)
  isNewRule.value = false
  dialogVisible.value = true
}

const saveRule = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  // Validate phase transition
  if (editingRule.value.fromPhase === editingRule.value.toPhase) {
    ElMessage.error(t('phaseTransition.samePhaseError'))
    return
  }

  // Convert keywords to JSON
  editingRule.value.completionKeywords = keywordsToJson(editingCompletionKeywords.value)
  editingRule.value.failureKeywords = keywordsToJson(editingFailureKeywords.value)

  saving.value = true
  try {
    if (isNewRule.value) {
      await phaseTransitionStore.createRule(editingRule.value)
      ElMessage.success(t('phaseTransition.createSuccess'))
    } else {
      await phaseTransitionStore.updateRule(editingRule.value.id, editingRule.value)
      ElMessage.success(t('phaseTransition.updateSuccess'))
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(phaseTransitionStore.error || t('phaseTransition.updateFailed'))
  } finally {
    saving.value = false
  }
}

const handleToggleUpdate = async (rule) => {
  try {
    await phaseTransitionStore.updateRule(rule.id, rule)
  } catch (error) {
    ElMessage.error(phaseTransitionStore.error || t('phaseTransition.updateFailed'))
    loadRules() // Reload to reset state
  }
}

const deleteRule = async (rule) => {
  try {
    await ElMessageBox.confirm(
      t('phaseTransition.deleteConfirm'),
      t('common.confirm'),
      { type: 'warning' }
    )

    await phaseTransitionStore.deleteRule(rule.id)
    ElMessage.success(t('phaseTransition.deleteSuccess'))
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(phaseTransitionStore.error || t('phaseTransition.deleteFailed'))
    }
  }
}

// Reset page when filter changes
watch([searchText, filterPhase], () => {
  currentPage.value = 1
})

onMounted(() => {
  loadRules()
})
</script>

<style scoped>
.phase-transition-config {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.keywords-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.keyword-tag {
  margin: 2px;
}

.no-keywords {
  color: #999;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
