<template>
  <el-dialog
    :model-value="true"
    :title="$t('git.mergeBranch', '合并分支')"
    width="500px"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <div class="merge-content">
      <el-form label-width="auto">
        <el-form-item :label="$t('git.sourceBranch', '源分支')">
          <el-tag type="info">{{ sourceBranch }}</el-tag>
        </el-form-item>
        <el-form-item :label="$t('git.targetBranch', '目标分支')">
          <el-select
            v-model="selectedTargetBranch"
            :placeholder="$t('git.selectTargetBranch', '选择目标分支')"
            filterable
            class="target-select"
          >
            <el-option
              v-for="branch in mainBranches"
              :key="branch.fullName"
              :label="branch.name"
              :value="branch.fullName"
            >
              <span>{{ branch.name }}</span>
              <el-tag v-if="branch.isCurrent" size="small" type="success" class="current-tag">
                {{ $t('git.current', '当前') }}
              </el-tag>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="mergeError"
        :title="mergeError"
        type="warning"
        show-icon
        :closable="false"
        class="merge-error"
      />

      <div v-if="mergeConflicts.files.length > 0" class="merge-conflicts">
        <el-alert
          :title="$t('git.mergeConflict', '合并冲突')"
          type="warning"
          :description="$t('git.mergeConflictHint', { count: mergeConflicts.count }, '存在 {count} 个文件的冲突')"
          show-icon
        />
        <ul class="conflict-list">
          <li v-for="file in mergeConflicts.files" :key="file">{{ file }}</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('close')">{{ $t('common.cancel', '取消') }}</el-button>
      <el-button
        type="primary"
        :disabled="!selectedTargetBranch || mergeLoading"
        @click="handleMerge"
      >
        {{ mergeLoading ? $t('git.merging', '合并中...') : $t('git.mergeBranch', '合并') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { mergeBranch, listBranches } from '../api/git'
import { useToast } from '../composables/ui/useToast'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  sourceBranch: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'merged'])

const { t } = useI18n()
const toast = useToast()

const selectedTargetBranch = ref('')
const mainBranches = ref([])
const mergeLoading = ref(false)
const mergeError = ref('')
const mergeConflicts = reactive({ count: 0, files: [] })

onMounted(async () => {
  await loadBranches()
})

const loadBranches = async () => {
  try {
    const response = await listBranches(props.projectId)
    if (response.success) {
      // 过滤出主分支（main, master）和开发分支
      mainBranches.value = response.data.filter(b => {
        const name = b.name.toLowerCase()
        return !b.isRemote &&
               (name === 'main' || name === 'master' || name === 'develop' || name === 'dev') &&
               b.name !== props.sourceBranch
      })
      // 如果没有找到主分支，显示所有非当前分支的本地分支
      if (mainBranches.value.length === 0) {
        mainBranches.value = response.data.filter(b => !b.isRemote && b.name !== props.sourceBranch)
      }
    }
  } catch (e) {
    console.error('Failed to load branches:', e)
    toast.apiError(e, t('git.loadBranchesFailed', '加载分支列表失败'))
  }
}

const handleMerge = async () => {
  if (!props.sourceBranch || !selectedTargetBranch.value) {
    return
  }

  mergeLoading.value = true
  mergeError.value = ''
  mergeConflicts.count = 0
  mergeConflicts.files = []

  try {
    const response = await mergeBranch(props.projectId, props.sourceBranch, selectedTargetBranch.value)

    if (response.success) {
      toast.success(t('git.mergeSuccess', '分支合并成功'))
      emit('merged', response.data)
      emit('close')
    } else if (response.data?.hasConflicts) {
      mergeConflicts.count = response.data.conflicts?.length || 0
      mergeConflicts.files = response.data.conflicts || []
      mergeError.value = t('git.mergeConflict', '存在合并冲突')
    } else {
      toast.error(response.message || t('git.mergeFailed', '合并失败'))
    }
  } catch (e) {
    console.error('Merge failed:', e)
    toast.apiError(e, t('git.mergeFailed', '合并失败'))
  } finally {
    mergeLoading.value = false
  }
}
</script>

<style scoped>
.merge-content {
  padding: 10px 0;
}

.target-select {
  width: 100%;
}

.current-tag {
  margin-left: 8px;
}

.merge-error {
  margin-top: 16px;
}

.merge-conflicts {
  margin-top: 16px;
}

.conflict-list {
  margin: 12px 0 0 20px;
  padding: 0;
}

.conflict-list li {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #e6a23c;
  margin: 4px 0;
}
</style>
