<template>
  <div class="git-worktree-panel">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>
            <el-icon><FolderOpened /></el-icon>
            {{ $t('git.worktrees', 'Worktrees') }}
          </span>
          <div class="header-actions">
            <el-button
              size="small"
              :loading="loading"
              @click="loadWorktrees"
            >
              <el-icon><Refresh /></el-icon>
            </el-button>
            <el-button
              size="small"
              @click="handlePrune"
            >
              {{ $t('git.prune', 'Prune') }}
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="worktrees"
        style="width: 100%"
        size="small"
      >
        <el-table-column prop="taskId" :label="$t('git.taskId', 'Task ID')" width="80" />
        <el-table-column prop="branch" :label="$t('git.branch', 'Branch')">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.branch }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="headCommitHash" :label="$t('git.commit', 'Commit')" width="80">
          <template #default="{ row }">
            <el-tooltip :content="row.headCommitMessage" placement="top">
              <code class="commit-hash">{{ row.headCommitHash }}</code>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="isDirty" :label="$t('git.status', 'Status')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isDirty ? 'warning' : 'success'" size="small">
              {{ row.isDirty ? $t('git.dirty', 'Dirty') : $t('git.clean', 'Clean') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions', 'Actions')" width="180">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                @click="showStatus(row)"
              >
                <el-icon><View /></el-icon>
              </el-button>
              <el-button
                size="small"
                @click="showDiff(row)"
              >
                <el-icon><Document /></el-icon>
              </el-button>
              <el-button
                size="small"
                @click="openCommitDialog(row)"
              >
                <el-icon><Check /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="handlePush(row)"
              >
                <el-icon><Upload /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="success"
                @click="openMergeDialog(row)"
              >
                <el-icon><Connection /></el-icon>
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && worktrees.length === 0" :description="$t('git.noWorktrees', 'No worktrees found')" />
    </el-card>

    <!-- Status Dialog -->
    <el-dialog
      v-model="statusDialogVisible"
      :title="$t('git.statusDetail', 'Git Status')"
      width="600px"
    >
      <div v-if="currentStatus" class="status-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="$t('git.branch', 'Branch')">
            {{ currentStatus.branch }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('git.aheadBehind', 'Ahead/Behind')">
            {{ currentStatus.aheadCount }} / {{ currentStatus.behindCount }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div v-if="currentStatus.hasUncommittedChanges">
          <h4>{{ $t('git.uncommittedChanges', 'Uncommitted Changes') }}</h4>

          <div v-if="currentStatus.added?.length" class="file-section">
            <strong>{{ $t('git.added', 'Added') }}:</strong>
            <ul>
              <li v-for="file in currentStatus.added" :key="file.path">
                {{ file.path }}
              </li>
            </ul>
          </div>

          <div v-if="currentStatus.modified?.length" class="file-section">
            <strong>{{ $t('git.modified', 'Modified') }}:</strong>
            <ul>
              <li v-for="file in currentStatus.modified" :key="file.path">
                {{ file.path }}
              </li>
            </ul>
          </div>

          <div v-if="currentStatus.deleted?.length" class="file-section">
            <strong>{{ $t('git.deleted', 'Deleted') }}:</strong>
            <ul>
              <li v-for="file in currentStatus.deleted" :key="file.path">
                {{ file.path }}
              </li>
            </ul>
          </div>

          <div v-if="currentStatus.untracked?.length" class="file-section">
            <strong>{{ $t('git.untracked', 'Untracked') }}:</strong>
            <ul>
              <li v-for="file in currentStatus.untracked" :key="file.path">
                {{ file.path }}
              </li>
            </ul>
          </div>
        </div>

        <el-alert
          v-else
          :title="$t('git.noChanges', 'No uncommitted changes')"
          type="success"
          show-icon
        />
      </div>
    </el-dialog>

    <!-- Diff Dialog -->
    <el-dialog
      v-model="diffDialogVisible"
      :title="$t('git.diff', 'Diff')"
      width="80%"
      top="5vh"
    >
      <div v-if="currentDiff" class="diff-content">
        <pre class="diff-output">{{ currentDiff.content }}</pre>
      </div>
    </el-dialog>

    <!-- Commit Dialog -->
    <CommitDialog
      v-if="commitDialogVisible"
      :project-id="projectId"
      :task-id="selectedWorktree?.taskId"
      @close="commitDialogVisible = false"
      @committed="handleCommitted"
    />

    <!-- Merge Dialog -->
    <el-dialog
      v-model="mergeDialogVisible"
      :title="$t('git.mergeBranch', 'Merge Branch')"
      width="500px"
    >
      <div class="merge-content">
        <el-form label-width="auto">
          <el-form-item :label="$t('git.sourceBranch', 'Source Branch')">
            <el-tag type="info">{{ mergeSourceBranch }}</el-tag>
          </el-form-item>
          <el-form-item :label="$t('git.targetBranch', 'Target Branch')">
            <el-select
              v-model="mergeTargetBranch"
              :placeholder="$t('git.selectTargetBranch', 'Select target branch')"
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
                  {{ $t('git.current', 'Current') }}
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

        <div v-if="mergeConflicts.length > 0" class="merge-conflicts">
          <el-alert
            :title="$t('git.mergeConflict', 'Merge Conflict')"
            type="warning"
            :description="$t('git.mergeConflictHint', { count: mergeConflicts.length }, 'Conflicts in {count} file(s)')"
            show-icon
          />
          <ul class="conflict-list">
            <li v-for="file in mergeConflicts" :key="file">{{ file }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="mergeDialogVisible = false">{{ $t('common.cancel', 'Cancel') }}</el-button>
        <el-button
          type="primary"
          :disabled="!mergeTargetBranch || mergeLoading"
          @click="handleMerge"
        >
          {{ mergeLoading ? $t('git.merging', 'Merging...') : $t('git.mergeBranch', 'Merge') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { FolderOpened, Refresh, View, Document, Check, Upload, Connection } from '@element-plus/icons-vue'
import {
  listWorktrees,
  getWorktreeStatus,
  pruneWorktrees,
  getStatus,
  getDiff,
  push,
  mergeBranch,
  listBranches
} from '../api/git'
import CommitDialog from './CommitDialog.vue'
import { useToast } from '../composables/ui/useToast'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['committed'])

const { t } = useI18n()
const toast = useToast()

const loading = ref(false)
const worktrees = ref([])
const statusDialogVisible = ref(false)
const diffDialogVisible = ref(false)
const commitDialogVisible = ref(false)
const mergeDialogVisible = ref(false)
const currentStatus = ref(null)
const currentDiff = ref(null)
const selectedWorktree = ref(null)
const mainBranches = ref([])
const mergeSourceBranch = ref('')
const mergeTargetBranch = ref('')
const mergeLoading = ref(false)
const mergeError = ref('')
const mergeConflicts = ref([])

const loadWorktrees = async () => {
  loading.value = true
  try {
    const response = await listWorktrees(props.projectId)
    if (response.success) {
      worktrees.value = response.data || []
    } else {
      toast.error(response.message || t('git.loadFailed', 'Failed to load worktrees'))
    }
  } catch (e) {
    console.error('Failed to load worktrees:', e)
    toast.apiError(e, t('git.loadFailed', 'Failed to load worktrees'))
  } finally {
    loading.value = false
  }
}

const handlePrune = async () => {
  try {
    const response = await pruneWorktrees(props.projectId)
    if (response.success) {
      toast.success(t('git.pruned', 'Worktree references pruned'))
      loadWorktrees()
    } else {
      toast.error(response.message)
    }
  } catch (e) {
    toast.apiError(e, t('git.pruneFailed', 'Failed to prune worktrees'))
  }
}

const showStatus = async (worktree) => {
  selectedWorktree.value = worktree
  try {
    const response = await getStatus(props.projectId, worktree.taskId)
    if (response.success) {
      currentStatus.value = response.data
      statusDialogVisible.value = true
    } else {
      toast.error(response.message)
    }
  } catch (e) {
    toast.apiError(e, t('git.statusFailed', 'Failed to get status'))
  }
}

const showDiff = async (worktree) => {
  selectedWorktree.value = worktree
  try {
    const response = await getDiff(props.projectId, worktree.taskId)
    if (response.success) {
      currentDiff.value = response.data
      diffDialogVisible.value = true
    } else {
      toast.error(response.message)
    }
  } catch (e) {
    toast.apiError(e, t('git.diffFailed', 'Failed to get diff'))
  }
}

const openCommitDialog = (worktree) => {
  selectedWorktree.value = worktree
  commitDialogVisible.value = true
}

const handleCommitted = () => {
  loadWorktrees()
  emit('committed')
}

const handlePush = async (worktree) => {
  try {
    const response = await push(props.projectId, worktree.taskId)
    if (response.success) {
      toast.success(t('git.pushed', 'Changes pushed successfully'))
    } else {
      toast.error(response.message || t('git.pushFailed', 'Push failed'))
    }
  } catch (e) {
    toast.apiError(e, t('git.pushFailed', 'Push failed'))
  }
}

const openMergeDialog = async (worktree) => {
  selectedWorktree.value = worktree
  mergeSourceBranch.value = worktree.branch
  mergeTargetBranch.value = ''
  mergeError.value = ''
  mergeConflicts.value = []

  // 加载分支列表
  try {
    const response = await listBranches(props.projectId)
    if (response.success) {
      // 过滤出主分支（main, master）和开发分支
      mainBranches.value = response.data.filter(b => {
        const name = b.name.toLowerCase()
        return !b.isRemote && (name === 'main' || name === 'master' || name === 'develop' || name === 'dev')
      })
      // 如果没有找到主分支，显示所有本地分支
      if (mainBranches.value.length === 0) {
        mainBranches.value = response.data.filter(b => !b.isRemote && b.name !== worktree.branch)
      }
    }
  } catch (e) {
    console.error('Failed to load branches:', e)
  }

  mergeDialogVisible.value = true
}

const handleMerge = async () => {
  if (!mergeSourceBranch.value || !mergeTargetBranch.value) {
    return
  }

  mergeLoading.value = true
  mergeError.value = ''
  mergeConflicts.value = []

  try {
    const response = await mergeBranch(props.projectId, mergeSourceBranch.value, mergeTargetBranch.value)

    if (response.success) {
      toast.success(t('git.mergeSuccess', 'Branch merged successfully'))
      mergeDialogVisible.value = false
      loadWorktrees()
    } else if (response.data?.hasConflicts) {
      mergeConflicts.value = response.data.conflicts || []
      mergeError.value = t('git.mergeConflict', 'Merge conflicts detected')
    } else {
      toast.error(response.message || t('git.mergeFailed', 'Merge failed'))
    }
  } catch (e) {
    console.error('Merge failed:', e)
    toast.apiError(e, t('git.mergeFailed', 'Merge failed'))
  } finally {
    mergeLoading.value = false
  }
}

onMounted(() => {
  loadWorktrees()
})
</script>

<style scoped>
.git-worktree-panel {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.commit-hash {
  font-size: 12px;
  color: #409eff;
}

.status-content {
  max-height: 60vh;
  overflow-y: auto;
}

.file-section {
  margin-top: 12px;
}

.file-section ul {
  margin: 4px 0 0 16px;
  padding: 0;
  list-style-type: disc;
}

.file-section li {
  margin: 2px 0;
  font-size: 13px;
}

.diff-content {
  background: #1e1e1e;
  border-radius: 4px;
  padding: 16px;
  max-height: 70vh;
  overflow: auto;
}

.diff-output {
  margin: 0;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
}

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
