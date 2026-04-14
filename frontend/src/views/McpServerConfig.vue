<template>
  <div class="mcp-server-config page-shell">
    <!-- Header -->
    <div class="header page-header page-header--compact">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ $t('mcpServer.title') }}</h1>
        <p class="page-header__description page-description">{{ $t('mcpServer.pageDescription') }}</p>
      </div>
      <div class="header-actions">
        <template v-if="exportMode">
          <button class="btn btn-primary" :disabled="selectedForExport.length === 0" @click="handleBatchExport">
            {{ $t('mcpServer.exportConfirm', { count: selectedForExport.length }) }}
          </button>
          <button class="btn btn-secondary" @click="cancelExportMode">
            {{ $t('common.cancel') }}
          </button>
        </template>
        <template v-else>
          <button class="btn btn-secondary" @click="enterExportMode">
            {{ $t('mcpServer.exportButton') }}
          </button>
          <button class="btn btn-secondary" @click="showImportDialog = true">
            {{ $t('mcpServer.importButton') }}
          </button>
          <button class="btn btn-primary" data-testid="open-create-mcp-server" @click="openAddForm">
            + {{ $t('mcpServer.createServer') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Main content: left-right split -->
    <div class="main-content-wrapper">
      <!-- Left: server list -->
      <div class="server-list-panel">
        <div class="panel-header">
          <h3>{{ $t('mcpServer.serverList') }}</h3>
          <span class="server-count">{{ mcpServerStore.mcpServers.length }}</span>
        </div>
        <div class="server-list" v-if="!mcpServerStore.loading">
          <div
            class="server-list-item"
            v-for="server in mcpServerStore.mcpServers"
            :key="server.id"
            :class="{ 'active': selectedServer?.id === server.id }"
            @click="exportMode ? toggleExportSelect(server.id, !selectedForExport.includes(server.id)) : selectServer(server)"
          >
            <div class="server-item-info">
              <input
                v-if="exportMode"
                type="checkbox"
                :checked="selectedForExport.includes(server.id)"
                class="export-checkbox"
                @click.stop
                @change="(e) => toggleExportSelect(server.id, e.target.checked)"
              />
              <span class="server-name">{{ server.name }}</span>
            </div>
            <div class="server-item-meta">
              <span class="type-tag" :class="server.server_type">{{ server.server_type === 'stdio' ? 'Stdio' : 'HTTP' }}</span>
            </div>
          </div>
          <div v-if="mcpServerStore.mcpServers.length === 0" class="empty-list">
            {{ $t('mcpServer.noServers') }}
          </div>
        </div>
        <div v-else class="loading-state">
          {{ $t('common.loading') }}
        </div>
      </div>

      <!-- Right: detail panel -->
      <div class="server-detail-panel">
        <div v-if="!selectedServer" class="empty-detail">
          <p>{{ $t('mcpServer.selectServerHint') }}</p>
        </div>

        <div v-else class="detail-content">
          <!-- Header -->
          <div class="detail-header">
            <div class="server-title-row">
              <div class="title-left">
                <h2>{{ selectedServer.name }}</h2>
              </div>
              <div class="header-actions">
                <button class="btn btn-secondary btn-sm" :disabled="validating" @click="testConnection">
                  {{ validating ? $t('common.loading') : $t('mcpServer.testConnection') }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="openEditForm">
                  {{ $t('common.edit') }}
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete">
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Info section -->
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">{{ $t('mcpServer.serverType') }}</span>
              <span class="info-value">
                <span class="type-badge-inline" :class="selectedServer.server_type">
                  {{ selectedServer.server_type === 'stdio' ? 'Stdio' : 'HTTP' }}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('mcpServer.description') }}</span>
              <span class="info-value description-text">{{ selectedServer.description || '-' }}</span>
            </div>
          </div>

          <!-- Config section -->
          <div class="config-section">
            <span class="section-label">{{ $t('mcpServer.config') }}</span>
            <div class="config-content">
              <pre class="config-json">{{ formatConfig(selectedServer.config) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <BaseDialog
      v-model="showForm"
      :title="editingServer ? $t('mcpServer.editServer') : $t('mcpServer.createServer')"
      width="600px"
    >
      <el-button-group class="mode-toggle">
        <el-button :type="inputMode === 'form' ? 'primary' : ''" size="small" @click="switchMode('form')">{{ $t('mcpServer.formMode') }}</el-button>
        <el-button :type="inputMode === 'json' ? 'primary' : ''" size="small" @click="switchMode('json')">{{ $t('mcpServer.jsonMode') }}</el-button>
      </el-button-group>

      <!-- Form Mode -->
      <el-form v-if="inputMode === 'form'" data-testid="mcp-server-form" label-position="top" @submit.prevent="saveServer">
        <el-form-item :label="$t('mcpServer.serverName')">
          <el-input v-model="form.name" data-testid="mcp-server-name-input" :placeholder="$t('mcpServer.namePlaceholder')" />
        </el-form-item>

        <el-form-item :label="$t('mcpServer.description')">
          <el-input v-model="form.description" :placeholder="$t('mcpServer.descriptionPlaceholder')" />
        </el-form-item>

        <el-form-item :label="$t('mcpServer.serverType')">
          <el-select v-model="form.server_type" style="width: 100%">
            <el-option value="stdio" label="Stdio" />
            <el-option value="http" label="HTTP" />
          </el-select>
        </el-form-item>

        <!-- Stdio config -->
        <template v-if="form.server_type === 'stdio'">
          <el-form-item :label="$t('mcpServer.command')">
            <el-input v-model="form.config.command" :placeholder="$t('mcpServer.commandPlaceholder')" />
          </el-form-item>
          <el-form-item :label="$t('mcpServer.args')">
            <div class="dynamic-list">
              <div v-for="(_, index) in form.config.args" :key="index" class="dynamic-list-item">
                <el-input v-model="form.config.args[index]" :placeholder="`${$t('mcpServer.args')} ${index + 1}`" />
                <el-button type="danger" size="small" @click="removeArg(index)">&times;</el-button>
              </div>
              <el-button size="small" @click="addArg">{{ $t('mcpServer.addArg') }}</el-button>
            </div>
          </el-form-item>
          <el-form-item :label="$t('mcpServer.env')">
            <div class="dynamic-list">
              <div v-for="(_, index) in form.envPairs" :key="index" class="dynamic-list-item">
                <el-input v-model="form.envPairs[index].key" :placeholder="$t('mcpServer.envKeyPlaceholder')" />
                <el-input v-model="form.envPairs[index].value" :placeholder="$t('mcpServer.envValuePlaceholder')" />
                <el-button type="danger" size="small" @click="removeEnvPair(index)">&times;</el-button>
              </div>
              <el-button size="small" @click="addEnvPair">{{ $t('mcpServer.addEnv') }}</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.auto_install" :true-value="1" :false-value="0">{{ $t('mcpServer.autoInstall') }}</el-checkbox>
            <p class="form-hint">{{ $t('mcpServer.autoInstallHint') }}</p>
          </el-form-item>
          <el-form-item v-if="form.auto_install" :label="$t('mcpServer.installCommand')">
            <el-input v-model="form.install_command" :placeholder="$t('mcpServer.installCommandPlaceholder')" />
          </el-form-item>
        </template>

        <!-- HTTP config -->
        <template v-if="form.server_type === 'http'">
          <el-form-item :label="$t('mcpServer.url')">
            <el-input v-model="form.config.url" :placeholder="$t('mcpServer.urlPlaceholder')" />
          </el-form-item>
          <el-form-item :label="$t('mcpServer.headers')">
            <div class="dynamic-list">
              <div v-for="(_, index) in form.headerPairs" :key="index" class="dynamic-list-item">
                <el-input v-model="form.headerPairs[index].key" :placeholder="$t('mcpServer.headerKeyPlaceholder')" />
                <el-input v-model="form.headerPairs[index].value" :placeholder="$t('mcpServer.headerValuePlaceholder')" />
                <el-button type="danger" size="small" @click="removeHeaderPair(index)">&times;</el-button>
              </div>
              <el-button size="small" @click="addHeaderPair">{{ $t('mcpServer.addHeader') }}</el-button>
            </div>
          </el-form-item>
        </template>
      </el-form>

      <!-- JSON Mode -->
      <div v-if="inputMode === 'json'" class="json-mode">
        <el-form label-position="top">
          <el-form-item :label="$t('mcpServer.jsonEditorLabel')">
            <el-input
              v-model="jsonText"
              type="textarea"
              :rows="16"
              spellcheck="false"
              :placeholder='`{
  &quot;name&quot;: &quot;my-server&quot;,
  &quot;server_type&quot;: &quot;stdio&quot;,
  &quot;config&quot;: {
    &quot;command&quot;: &quot;npx&quot;,
    &quot;args&quot;: [&quot;-y&quot;, &quot;@upstash/context7-mcp&quot;]
  }
}`'
            />
          </el-form-item>
        </el-form>
        <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
      </div>

      <template #footer>
        <el-button @click="closeForm">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="saving" @click="saveServer">{{ saving ? $t('common.loading') : $t('common.save') }}</el-button>
      </template>
    </BaseDialog>

    <!-- Toast -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <!-- Import Dialog -->
    <McpServerImportDialog
      v-model="showImportDialog"
      @imported="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useMcpServerStore } from '../stores/mcpServerStore'
import { mcpServerApi } from '../api/mcpServer'
import BaseDialog from '../components/BaseDialog.vue'
import McpServerImportDialog from '../components/mcp/McpServerImportDialog.vue'

const { t } = useI18n()
const mcpServerStore = useMcpServerStore()

const saving = ref(false)
const showForm = ref(false)
const editingServer = ref(null)
const selectedServer = ref(null)
const inputMode = ref('form')
const jsonText = ref('')
const jsonError = ref('')
const validating = ref(false)
const exportMode = ref(false)
const selectedForExport = ref([])
const showImportDialog = ref(false)

function getDefaultForm() {
  return {
    name: '',
    description: '',
    server_type: 'stdio',
    config: { command: '', args: [] },
    envPairs: [],
    headerPairs: [],
    auto_install: 0,
    install_command: '',
  }
}

const form = ref(getDefaultForm())

// Reset config when server_type changes to avoid stale fields
watch(() => form.value.server_type, (newType) => {
  if (newType === 'stdio') {
    form.value.config = { command: '', args: [] }
    form.value.headerPairs = []
  } else {
    form.value.config = { url: '' }
    form.value.envPairs = []
  }
})

const toast = ref({ show: false, message: '', type: 'success' })
function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function formatConfig(config) {
  if (!config) return '{}'
  return JSON.stringify(config, null, 2)
}

function configFromForm() {
  const config = { ...form.value.config }
  if (form.value.server_type === 'stdio') {
    // Build env from envPairs
    const env = {}
    for (const pair of form.value.envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value
      }
    }
    if (Object.keys(env).length > 0) {
      config.env = env
    }
    // Clean up args (remove empty)
    config.args = (config.args || []).filter(a => a.trim() !== '')
    if (config.args.length === 0) delete config.args
  } else {
    // HTTP: build headers from headerPairs
    const headers = {}
    for (const pair of form.value.headerPairs) {
      if (pair.key.trim()) {
        headers[pair.key.trim()] = pair.value
      }
    }
    if (Object.keys(headers).length > 0) {
      config.headers = headers
    }
  }
  return config
}

function serializeFormToJson() {
  const payload = {
    name: form.value.name.trim(),
    server_type: form.value.server_type,
    config: configFromForm(),
  }
  const desc = form.value.description.trim()
  if (desc) payload.description = desc
  return JSON.stringify(payload, null, 2)
}

function parseJsonToForm(jsonStr) {
  const parsed = JSON.parse(jsonStr)
  if (!parsed.name) throw new Error(t('mcpServer.jsonMissingName'))
  if (!parsed.server_type || !['stdio', 'http'].includes(parsed.server_type)) {
    throw new Error(t('mcpServer.jsonInvalidServerType'))
  }
  setFormState({
    name: parsed.name,
    description: parsed.description || '',
    server_type: parsed.server_type,
    config: parsed.config || {},
  })
}

function switchMode(newMode) {
  if (newMode === inputMode.value) return
  jsonError.value = ''
  if (newMode === 'json') {
    jsonText.value = serializeFormToJson()
  } else {
    if (jsonText.value.trim()) {
      try { parseJsonToForm(jsonText.value) } catch { /* best-effort */ }
    }
  }
  inputMode.value = newMode
}

function setFormState(server) {
  if (!server) {
    form.value = getDefaultForm()
    return
  }
  const config = { ...server.config } || {}
  const envPairs = []
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      envPairs.push({ key, value: String(value) })
    }
  }
  delete config.env

  const headerPairs = []
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      headerPairs.push({ key, value: String(value) })
    }
  }
  delete config.headers

  form.value = {
    name: server.name || '',
    description: server.description || '',
    server_type: server.server_type || 'stdio',
    config: { ...config, args: [...(config.args || [])] },
    envPairs,
    headerPairs,
  }
}

const addArg = () => { form.value.config.args.push('') }
const removeArg = (index) => { form.value.config.args.splice(index, 1) }
const addEnvPair = () => { form.value.envPairs.push({ key: '', value: '' }) }
const removeEnvPair = (index) => { form.value.envPairs.splice(index, 1) }
const addHeaderPair = () => { form.value.headerPairs.push({ key: '', value: '' }) }
const removeHeaderPair = (index) => { form.value.headerPairs.splice(index, 1) }

const loadServers = async () => {
  try {
    await mcpServerStore.fetchMcpServers()
    if (mcpServerStore.mcpServers.length > 0 && !selectedServer.value) {
      selectServer(mcpServerStore.mcpServers[0])
    }
  } catch (e) {
    console.error('Failed to load MCP servers:', e)
  }
}

const selectServer = (server) => {
  selectedServer.value = server
}

const testConnection = async () => {
  if (!selectedServer.value) return
  validating.value = true
  try {
    const res = await mcpServerApi.validate({
      server_type: selectedServer.value.server_type,
      config: selectedServer.value.config,
    })
    // axios interceptor unwraps response.data, so res = { success, data: { valid, message } }
    if (res?.success && res?.data?.valid) {
      showToast(res.data.message || t('mcpServer.connectionOk'), 'success')
    } else {
      const msg = res?.data?.message || res?.message || t('mcpServer.connectionFailed')
      const details = res?.data?.details ? `\n${res.data.details}` : ''
      showToast(msg + details, 'error')
    }
  } catch (e) {
    showToast(e?.response?.data?.message || e?.message || t('mcpServer.connectionFailed'), 'error')
  } finally {
    validating.value = false
  }
}

const openAddForm = () => {
  editingServer.value = null
  setFormState(null)
  inputMode.value = 'form'
  jsonText.value = ''
  jsonError.value = ''
  showForm.value = true
}

const openEditForm = () => {
  if (!selectedServer.value) return
  editingServer.value = selectedServer.value
  setFormState(selectedServer.value)
  jsonText.value = JSON.stringify({
    name: selectedServer.value.name || '',
    description: selectedServer.value.description || undefined,
    server_type: selectedServer.value.server_type || 'stdio',
    config: selectedServer.value.config || {},
  }, null, 2)
  inputMode.value = 'form'
  jsonError.value = ''
  showForm.value = true
}

const saveServer = async () => {
  saving.value = true
  try {
    let payload
    if (inputMode.value === 'json') {
      try {
        payload = JSON.parse(jsonText.value)
      } catch (e) {
        jsonError.value = t('mcpServer.jsonParseError') + ': ' + e.message
        saving.value = false
        return
      }
      if (!payload.name) { jsonError.value = t('mcpServer.jsonMissingName'); saving.value = false; return }
      if (!payload.server_type || !['stdio', 'http'].includes(payload.server_type)) { jsonError.value = t('mcpServer.jsonInvalidServerType'); saving.value = false; return }
      if (!payload.config || typeof payload.config !== 'object') { jsonError.value = t('mcpServer.jsonMissingConfig'); saving.value = false; return }
      jsonError.value = ''
    } else {
      payload = {
        name: form.value.name.trim(),
        description: form.value.description.trim() || undefined,
        server_type: form.value.server_type,
        config: configFromForm(),
      }
    }

    const response = editingServer.value
      ? await mcpServerStore.updateMcpServer(editingServer.value.id, payload)
      : await mcpServerStore.createMcpServer(payload)

    if (!response?.success) {
      showToast(response?.message || t('messages.saveFailed', { name: t('mcpServer.title') }), 'error')
      return
    }

    if (editingServer.value && selectedServer.value?.id === editingServer.value.id) {
      selectedServer.value = mcpServerStore.mcpServers.find(s => s.id === editingServer.value.id)
    }

    closeForm()
    showToast(t('messages.saved', { name: t('mcpServer.title') }))
  } catch (e) {
    console.error('Failed to save:', e)
    showToast(e?.message || t('messages.saveFailed', { name: t('mcpServer.title') }), 'error')
  } finally {
    saving.value = false
  }
}

const confirmDelete = async () => {
  if (!selectedServer.value) return
  if (!confirm(t('mcpServer.deleteConfirm'))) return
  try {
    const deletedId = selectedServer.value.id
    const response = await mcpServerStore.deleteMcpServer(deletedId)
    if (!response?.success) {
      showToast(response?.message || t('messages.deleteFailed', { name: t('mcpServer.title') }), 'error')
      return
    }
    if (mcpServerStore.mcpServers.length > 0) {
      selectServer(mcpServerStore.mcpServers[0])
    } else {
      selectedServer.value = null
    }
    showToast(t('messages.deleted', { name: t('mcpServer.title') }))
  } catch (e) {
    showToast(e?.message || t('messages.deleteFailed', { name: t('mcpServer.title') }), 'error')
  }
}

// --- Export/Import ---

const toggleExportSelect = (serverId, checked) => {
  if (checked) {
    if (!selectedForExport.value.includes(serverId)) {
      selectedForExport.value = [...selectedForExport.value, serverId]
    }
  } else {
    selectedForExport.value = selectedForExport.value.filter(id => id !== serverId)
  }
}

const enterExportMode = () => {
  exportMode.value = true
  selectedForExport.value = []
}

const cancelExportMode = () => {
  exportMode.value = false
  selectedForExport.value = []
}

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const handleBatchExport = async () => {
  if (selectedForExport.value.length === 0) return
  try {
    const res = await mcpServerApi.exportMcpServers(selectedForExport.value)
    // Backend returns raw export file (not wrapped in success/data)
    downloadJson(res, `mcp-servers-${Date.now()}.json`)
    ElMessage.success(t('mcpServer.exportSuccess'))
    exportMode.value = false
    selectedForExport.value = []
  } catch (e) {
    ElMessage.error(e?.message || t('mcpServer.exportFailed'))
  }
}

const handleImportComplete = async () => {
  await loadServers()
}

const closeForm = () => {
  showForm.value = false
  editingServer.value = null
}

onMounted(loadServers)
</script>

<style scoped>
@import '../styles/config-page.css';

.mcp-server-config {
  padding: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.export-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

/* Left panel */
.server-list-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.server-count {
  background: var(--accent-color-soft);
  color: var(--accent-color);
  padding: 3px 9px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.server-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.server-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.server-list-item:hover {
  background: var(--bg-secondary);
  border-color: rgba(37, 198, 201, 0.35);
}

.server-list-item.active {
  background: var(--hover-bg);
  border: 1px solid var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.1);
}

.server-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.server-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-tag {
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.type-tag.stdio {
  background: #dbeafe;
  color: #1e40af;
}

.type-tag.http {
  background: #fef3c7;
  color: #92400e;
}

/* Right panel */
.server-detail-panel {
  flex: 1;
  background: var(--panel-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.server-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.server-title-row h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.type-badge-inline {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.type-badge-inline.stdio {
  color: #1e40af;
  background: rgba(219, 234, 254, 0.5);
  border: 1px solid rgba(219, 234, 254, 0.6);
}

.type-badge-inline.http {
  color: #92400e;
  background: rgba(254, 243, 199, 0.5);
  border: 1px solid rgba(254, 243, 199, 0.6);
}

/* Config section */
.config-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.config-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: auto;
}

.config-json {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* Mode toggle (handled by el-button-group, class kept for spacing) */
.mode-toggle {
  margin-bottom: 16px;
}

/* Dynamic list for form */
.dynamic-list {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-secondary);
}

.dynamic-list-item {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  align-items: center;
}

.dynamic-list-item .el-input {
  flex: 1;
}

.json-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  word-break: break-all;
}

.form-hint {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  margin-bottom: 0;
}

</style>
