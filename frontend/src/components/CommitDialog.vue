<template>
  <el-dialog
    :model-value="true"
    :title="$t('git.commit', 'Commit Changes')"
    width="550px"
    @close="$emit('close')"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="140px"
    >
      <el-form-item :label="$t('git.commitMessage', 'Message')" prop="message">
        <el-input
          v-model="form.message"
          type="textarea"
          :rows="4"
          :placeholder="$t('git.commitMessagePlaceholder', 'Enter commit message...')"
        />
      </el-form-item>

      <el-form-item :label="$t('git.addAll', 'Stage All')">
        <el-switch v-model="form.addAll" />
      </el-form-item>

      <!-- MR/PR Options -->
      <el-divider content-position="left">
        <el-checkbox v-model="form.createMR" :label="$t('git.createMR', 'Create Merge Request')" />
      </el-divider>

      <template v-if="form.createMR">
        <el-form-item :label="$t('git.targetBranch', 'Target Branch')">
          <el-select
            v-model="form.targetBranch"
            :placeholder="$t('git.selectTargetBranch', 'Select target branch')"
            style="width: 100%"
            :loading="branchesLoading"
          >
            <el-option
              v-for="branch in targetBranches"
              :key="branch.name"
              :label="branch.name"
              :value="branch.name"
            >
              <span>{{ branch.name }}</span>
              <el-tag v-if="branch.isCurrent" size="small" type="success" style="margin-left: 8px">
                {{ $t('git.current', 'Current') }}
              </el-tag>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('git.mrTitle', 'MR Title')">
          <el-input
            v-model="form.mrTitle"
            :placeholder="$t('git.mrTitlePlaceholder', 'Leave empty to use commit message')"
          />
        </el-form-item>

        <el-form-item :label="$t('git.pushAfterCommit', 'Push after commit')">
          <el-switch v-model="form.pushAfterCommit" />
          <span class="form-hint">{{ $t('git.pushHint', 'Required to create MR') }}</span>
        </el-form-item>
      </template>
    </el-form>

    <!-- Uncommitted Changes Preview -->
    <div v-if="changes.length > 0" class="changes-preview">
      <h4>{{ $t('git.filesToCommit', 'Files to be committed') }}</h4>
      <div class="file-tags">
        <el-tag
          v-for="file in changes.slice(0, 10)"
          :key="file"
          size="small"
          type="primary"
          effect="light"
        >
          {{ file }}
        </el-tag>
        <el-tag v-if="changes.length > 10" size="small" type="info" effect="plain">
          +{{ changes.length - 10 }} more
        </el-tag>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">
          {{ $t('common.cancel', 'Cancel') }}
        </el-button>
        <el-button
          v-if="form.createMR && mrLink"
          type="success"
          @click="openMRLink"
        >
          {{ $t('git.openMR', 'Open MR') }}
        </el-button>
        <el-button
          type="primary"
          :loading="committing"
          @click="handleCommit"
        >
          {{ form.createMR ? $t('git.commitAndCreateMR', 'Commit & Create MR') : $t('git.commit', 'Commit') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { commit, getUncommittedChanges, listBranches, push, listRemotes } from '../api/git'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  currentBranch: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'committed'])

const { t } = useI18n()

const formRef = ref(null)
const committing = ref(false)
const changes = ref([])
const branchesLoading = ref(false)
const branches = ref([])
const remotes = ref([])
const mrLink = ref(null)

const form = reactive({
  message: '',
  addAll: true,
  createMR: false,
  targetBranch: 'main',
  mrTitle: '',
  pushAfterCommit: true
})

const rules = {
  message: [
    { required: true, message: t('git.messageRequired', 'Commit message is required'), trigger: 'blur' },
    { min: 3, message: t('git.messageMinLength', 'Message must be at least 3 characters'), trigger: 'blur' }
  ]
}

// Filter out current branch from target branches
const targetBranches = computed(() =>
  branches.value.filter(b => !b.isCurrent && !b.isRemote)
)

const loadChanges = async () => {
  try {
    const response = await getUncommittedChanges(props.projectId, props.taskId)
    if (response.success) {
      changes.value = response.data || []
    }
  } catch (e) {
    console.error('Failed to load changes:', e)
  }
}

const loadBranches = async () => {
  branchesLoading.value = true
  try {
    const response = await listBranches(props.projectId)
    if (response.success) {
      branches.value = response.data || []
      // Set default target branch
      const mainBranch = branches.value.find(b =>
        b.name === 'main' || b.name === 'master'
      )
      if (mainBranch) {
        form.targetBranch = mainBranch.name
      }
    }
  } catch (e) {
    console.error('Failed to load branches:', e)
  } finally {
    branchesLoading.value = false
  }
}

const loadRemotes = async () => {
  try {
    const response = await listRemotes(props.projectId)
    if (response.success && response.data?.length > 0) {
      remotes.value = response.data
    }
  } catch (e) {
    console.error('Failed to load remotes:', e)
  }
}

const generateMRLink = (remoteUrl, sourceBranch, targetBranch, mrTitle) => {
  if (!remoteUrl || !sourceBranch || !targetBranch) return null

  let url = remoteUrl

  // Handle different URL formats
  // git@github.com:user/repo.git -> https://github.com/user/repo
  // https://github.com/user/repo.git -> https://github.com/user/repo
  if (url.startsWith('git@')) {
    url = url.replace('git@', 'https://').replace(':', '/').replace('.git', '')
  } else if (url.endsWith('.git')) {
    url = url.replace('.git', '')
  }

  // Get title: use mrTitle, fallback to first line of commit message
  const title = mrTitle || form.message.split('\n')[0] || ''

  // Determine platform and generate MR/PR link
  if (url.includes('github.com')) {
    // GitHub Pull Request
    const params = new URLSearchParams()
    if (title) params.set('title', title)
    params.set('head', sourceBranch)
    params.set('base', targetBranch)
    return `${url}/compare/${targetBranch}...${sourceBranch}?expand=1&${params.toString()}`
  } else if (url.includes('gitlab')) {
    // GitLab Merge Request
    const params = new URLSearchParams()
    params.set('merge_request[source_branch]', sourceBranch)
    params.set('merge_request[target_branch]', targetBranch)
    if (title) params.set('merge_request[title]', title)
    return `${url}/-/merge_requests/new?${params.toString()}`
  } else if (url.includes('bitbucket')) {
    // Bitbucket Pull Request
    const titleParam = title ? `&title=${encodeURIComponent(title)}` : ''
    return `${url}/pull-requests/new?source=${sourceBranch}&dest=${targetBranch}${titleParam}`
  } else if (url.includes('gitee')) {
    // Gitee Pull Request
    const titleParam = title ? `&title=${encodeURIComponent(title)}` : ''
    return `${url}/pulls/new?from=${sourceBranch}&to=${targetBranch}${titleParam}`
  }

  // Generic: return compare page
  return `${url}/compare/${targetBranch}...${sourceBranch}`
}

const handleCommit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  if (form.createMR && !form.targetBranch) {
    ElMessage.warning(t('git.selectTargetBranch', 'Please select a target branch'))
    return
  }

  committing.value = true
  try {
    const response = await commit(props.projectId, props.taskId, {
      message: form.message,
      addAll: form.addAll
    })

    if (response.success) {
      // Push if requested and creating MR
      if (form.createMR && form.pushAfterCommit) {
        try {
          await push(props.projectId, props.taskId, { setUpstream: true })
        } catch (pushError) {
          console.error('Push failed:', pushError)
          ElMessage.warning(t('git.pushFailed', 'Push failed, MR link may not work'))
        }
      }

      // Generate MR link
      if (form.createMR && remotes.value.length > 0) {
        const remoteUrl = remotes.value[0].fetchUrl
        mrLink.value = generateMRLink(
          remoteUrl,
          props.currentBranch,
          form.targetBranch,
          form.mrTitle
        )
      }

      ElMessage.success(t('git.commitSuccess', 'Changes committed successfully'))
      emit('committed', response.data)

      // If MR link generated, don't close immediately
      if (!form.createMR || !mrLink.value) {
        emit('close')
      }
    } else {
      ElMessage.error(response.message || t('git.commitFailed', 'Failed to commit changes'))
    }
  } catch (e) {
    console.error('Commit failed:', e)
    ElMessage.error(t('git.commitFailed', 'Failed to commit changes'))
  } finally {
    committing.value = false
  }
}

const openMRLink = () => {
  if (mrLink.value) {
    window.open(mrLink.value, '_blank')
    emit('close')
  }
}

watch(() => form.createMR, (val) => {
  if (val && branches.value.length === 0) {
    loadBranches()
    loadRemotes()
  }
})

onMounted(() => {
  loadChanges()
  // Preload branches if currentBranch is provided
  if (props.currentBranch) {
    loadBranches()
    loadRemotes()
  }
})
</script>

<style scoped>
:deep(.el-dialog__header) {
  margin: 0;
  padding: 20px 24px;
  border-bottom: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

:deep(.el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: #fff;
  opacity: 0.8;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  opacity: 1;
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #303133;
}

:deep(.el-textarea__inner) {
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  transition: all 0.3s ease;
  text-align: left;
}

:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

:deep(.el-divider) {
  margin: 24px 0;
}

:deep(.el-divider__text) {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  background: #fff;
  padding: 0 12px;
}

:deep(.el-divider--horizontal) {
  border-color: #ebeef5;
}

:deep(.el-select .el-input__inner) {
  border-radius: 6px;
}

:deep(.el-switch__core) {
  width: 44px !important;
}

.form-hint {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
  font-style: italic;
}

.changes-preview {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(145deg, #f8f9fa 0%, #f0f2f5 100%);
  border-radius: 10px;
  border: 1px solid #e4e7ed;
}

.changes-preview h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.changes-preview h4::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #67c23a;
  border-radius: 50%;
}

.file-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.changes-preview :deep(.el-tag) {
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  transition: all 0.2s ease;
}

.changes-preview :deep(.el-tag:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #e4e7ed;
  background: #fafbfc;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer :deep(.el-button) {
  padding: 10px 20px;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.dialog-footer :deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.dialog-footer :deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.dialog-footer :deep(.el-button--success) {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border: none;
}

.dialog-footer :deep(.el-button--success:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
}

:deep(.el-checkbox__label) {
  font-weight: 500;
  color: #303133;
}
</style>
