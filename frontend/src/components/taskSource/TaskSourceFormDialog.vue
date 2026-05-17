<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="isEditMode ? $t('taskSource.editTitle', '编辑任务源') : $t('taskSource.addTitle', '添加任务源')"
    width="520px"
    custom-class="task-source-dialog"
    :body-padding="false"
    append-to-body
  >
    <div class="dialog-content">
      <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top" size="small">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <el-form-item :label="$t('taskSource.name', '名称')" prop="name">
            <el-input v-model="formData.name" :placeholder="$t('taskSource.namePlaceholder', '输入任务源名称')" clearable maxlength="200" show-word-limit />
          </el-form-item>

          <el-form-item :label="$t('taskSource.type', '类型')" prop="type">
            <el-select v-model="formData.type" :disabled="isEditMode" @change="emit('type-change')" placeholder="选择任务源类型">
              <el-option
                v-for="type in availableTypes"
                :key="type.key"
                :label="type.name"
                :value="type.key"
              >
                <div class="type-option">
                  <span class="type-icon">{{ getTypeIcon(type.key) }}</span>
                  <span class="type-name">{{ type.name }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </div>

        <template v-if="selectedTypeConfig">
          <div class="form-section">
            <div class="section-title">配置信息</div>
            <template
              v-for="(field, key) in selectedTypeConfig.configFields"
              :key="key"
            >
              <el-form-item
                v-if="field && !field.hidden && !isFieldHidden(key)"
                :label="getFieldLabel(key, field)"
                :prop="`config.${key}`"
                :required="field.required"
              >
                <el-input
                  v-if="key === 'token'"
                  v-model="formData.config[key]"
                  type="password"
                  :placeholder="getFieldPlaceholder(key, field)"
                />
                <el-select
                  v-else-if="key === 'state'"
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                >
                  <el-option label="仅开放" value="open" />
                  <el-option label="仅关闭" value="closed" />
                  <el-option label="全部" value="all" />
                </el-select>
                <el-select
                  v-else-if="field.type === 'array'"
                  v-model="formData.config[key]"
                  multiple
                  :placeholder="$t('taskSource.selectLabels', '选择标签')"
                >
                  <el-option
                    v-for="label in availableLabels[key]"
                    :key="label"
                    :label="label"
                    :value="label"
                  />
                </el-select>
                <el-switch
                  v-else-if="field.type === 'boolean'"
                  v-model="formData.config[key]"
                />
                <el-select
                  v-else-if="field.options && field.options.length > 0"
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                >
                  <el-option
                    v-for="opt in field.options"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <el-select
                  v-else-if="key === 'agentId'"
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                  clearable
                >
                  <el-option
                    v-for="agent in agents"
                    :key="agent.id"
                    :label="agent.name"
                    :value="agent.id"
                  />
                </el-select>
                <el-input
                  v-else
                  v-model="formData.config[key]"
                  :placeholder="getFieldPlaceholder(key, field)"
                  clearable
                />
              </el-form-item>
            </template>
          </div>
        </template>

        <div class="form-section">
          <el-form-item :label="$t('taskSource.enabled', '启用')" prop="enabled">
            <el-switch v-model="formData.enabled" />
          </el-form-item>
        </div>

        <div class="form-section">
          <el-form-item :label="$t('taskSource.syncFrequency', '同步频率')">
            <el-select v-model="formData.sync_schedule" clearable :placeholder="$t('taskSource.scheduleDisabled', '不启用')">
              <el-option :label="$t('taskSource.scheduleDisabled', '不启用')" value="" />
              <el-option label="每 5 分钟" value="*/5 * * * *" />
              <el-option label="每 15 分钟" value="*/15 * * * *" />
              <el-option label="每 30 分钟" value="*/30 * * * *" />
              <el-option label="每小时" value="0 * * * *" />
              <el-option label="每 6 小时" value="0 */6 * * *" />
              <el-option label="每天" value="0 0 * * *" />
              <el-option label="自定义" value="__custom__" />
            </el-select>
            <el-input
              v-if="formData.sync_schedule === '__custom__'"
              :model-value="customCron"
              style="margin-top: 8px;"
              :placeholder="$t('taskSource.scheduleCustomPlaceholder', '输入 cron 表达式')"
              @update:model-value="emit('update:custom-cron', $event)"
            />
          </el-form-item>

          <el-form-item v-if="formData.sync_schedule && formData.sync_schedule !== '__custom__'" :label="$t('taskSource.defaultWorkflowTemplate', '默认AgentTeam模板')">
            <el-select v-model="formData.default_workflow_template_id" :placeholder="$t('taskSource.autoWorkflowNone', '不自动触发')" clearable style="width: 100%;">
              <el-option
                v-for="tpl in workflowTemplates"
                :key="tpl.template_id"
                :label="tpl.name"
                :value="tpl.template_id"
              />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">{{ $t('common.cancel', '取消') }}</el-button>
      <el-button type="primary" @click="emit('submit', formRef)" :disabled="submitting">
        {{ submitting ? '提交中...' : $t('common.confirm', '确认') }}
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseDialog from '../BaseDialog.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEditMode: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  formData: { type: Object, required: true },
  customCron: { type: String, default: '' },
  availableTypes: { type: Array, default: () => [] },
  agents: { type: Array, default: () => [] },
  workflowTemplates: { type: Array, default: () => [] },
  availableLabels: { type: Object, default: () => ({}) },
  formRules: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'update:visible',
  'type-change',
  'update:custom-cron',
  'submit'
])

const formRef = ref(null)

const selectedTypeConfig = computed(() => {
  if (!props.formData.type) return null
  return props.availableTypes.find(t => t.key === props.formData.type) || null
})

const isFieldHidden = (key) => {
  const mode = props.formData.config?.descriptionMode
  if (key === 'descriptionTemplate' && mode === 'ai') return true
  if (key === 'agentId' && mode !== 'ai') return true
  return false
}

const commonLabels = {
  repo: '仓库',
  token: '访问令牌',
  state: 'Issue 状态',
  labels: '标签筛选',
  baseUrl: 'API 地址',
  userId: '用户标识',
  category: '分类',
  status: '状态',
  pageSize: '每页数量',
  listPath: '列表路径',
  detailPath: '详情路径',
  detailIdField: '详情 ID 字段',
  rejectUnauthorized: '接受自签名证书',
  directoryPath: '目录路径',
  fileExtensions: '文件扩展名',
  descriptionMode: '描述模式',
  descriptionTemplate: '描述模板',
  agentId: '分析 Agent'
}

const internalApiLabels = {
  baseUrl: 'API 基础地址',
  listPath: '列表接口路径',
  detailPath: '详情接口路径模板',
  detailIdField: '详情ID字段'
}

const commonPlaceholders = {
  repo: '例如: owner/repo',
  token: 'ghp_xxx...',
  state: '选择 Issue 状态',
  labels: '选择标签',
  baseUrl: 'https://codehub.huawei.com/api/v4',
  userId: '输入用户标识',
  category: '例如: 5',
  pageSize: '例如: 10',
  listPath: '/devops-workitem/api/v1/query/workitems',
  detailPath: '/devops-workitem/api/v1/query/{number}/document_detail',
  detailIdField: '例如: number',
  rejectUnauthorized: '关闭后接受自签名证书',
  directoryPath: '服务器本地目录的绝对路径',
  fileExtensions: '如 txt,md,pdf',
  descriptionTemplate: '支持 {filename} 等变量',
  agentId: '选择 Agent'
}

const internalApiPlaceholders = {
  baseUrl: '例如: https://internal.example.com',
  token: '例如: Bearer xxx 或 ApiKey xxx',
  listPath: '例如: /api/tasks',
  detailPath: '例如: /api/tasks/{id}',
  detailIdField: '例如: id 或 data.taskId'
}

const getFieldLabel = (key, field) => {
  if (props.formData.type === 'INTERNAL_API' && internalApiLabels[key]) {
    return internalApiLabels[key]
  }
  return commonLabels[key] || field.description || key
}

const getFieldPlaceholder = (key, field) => {
  if (field?.default !== undefined) {
    return `默认: ${field.default}`
  }
  if (props.formData.type === 'INTERNAL_API' && internalApiPlaceholders[key]) {
    return internalApiPlaceholders[key]
  }
  return commonPlaceholders[key] || field.description || ''
}

const getTypeIcon = (_type) => ''
</script>

<style scoped>
.dialog-content {
  padding: 16px 20px;
}

.form-section {
  margin-bottom: 16px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.type-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.type-icon {
  font-size: 16px;
}

.type-name {
  font-size: 13px;
}

:deep(.el-form-item) {
  margin-bottom: 14px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  padding-bottom: 4px;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

:deep(.el-select) {
  width: 100%;
}
</style>
