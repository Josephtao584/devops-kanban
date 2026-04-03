<template>
  <div class="mcp-server-config page-shell">
    <!-- Header -->
    <div class="header page-header page-header--compact">
      <h1 class="page-header__title">{{ $t('mcpServer.title') }}</h1>
      <button class="btn btn-primary" data-testid="open-create-mcp-server" @click="openAddForm">
        + {{ $t('mcpServer.createServer') }}
      </button>
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
            @click="selectServer(server)"
          >
            <div class="server-item-info">
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
    <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingServer ? $t('mcpServer.editServer') : $t('mcpServer.createServer') }}</h2>
          <div class="mode-toggle">
            <button type="button" class="mode-toggle-btn" :class="{ active: inputMode === 'form' }" @click="switchMode('form')">{{ $t('mcpServer.formMode') }}</button>
            <button type="button" class="mode-toggle-btn" :class="{ active: inputMode === 'json' }" @click="switchMode('json')">{{ $t('mcpServer.jsonMode') }}</button>
          </div>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Form Mode -->
          <form v-if="inputMode === 'form'" data-testid="mcp-server-form" @submit.prevent="saveServer">
            <div class="form-group">
              <label>{{ $t('mcpServer.serverName') }}</label>
              <input v-model="form.name" data-testid="mcp-server-name-input" type="text" required :placeholder="$t('mcpServer.namePlaceholder')" />
            </div>

            <div class="form-group">
              <label>{{ $t('mcpServer.description') }}</label>
              <input v-model="form.description" type="text" :placeholder="$t('mcpServer.descriptionPlaceholder')" />
            </div>

            <div class="form-group">
              <label>{{ $t('mcpServer.serverType') }}</label>
              <select v-model="form.server_type" required>
                <option value="stdio">Stdio</option>
                <option value="http">HTTP</option>
              </select>
            </div>

            <!-- Stdio config -->
            <template v-if="form.server_type === 'stdio'">
              <div class="form-group">
                <label>{{ $t('mcpServer.command') }}</label>
                <input v-model="form.config.command" type="text" required :placeholder="$t('mcpServer.commandPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('mcpServer.args') }}</label>
                <div class="dynamic-list">
                  <div v-for="(_, index) in form.config.args" :key="index" class="dynamic-list-item">
                    <input v-model="form.config.args[index]" type="text" :placeholder="`${$t('mcpServer.args')} ${index + 1}`" />
                    <button type="button" class="btn btn-danger btn-sm remove-item-btn" @click="removeArg(index)">&times;</button>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" @click="addArg">{{ $t('mcpServer.addArg') }}</button>
                </div>
              </div>
              <div class="form-group">
                <label>{{ $t('mcpServer.env') }}</label>
                <div class="dynamic-list">
                  <div v-for="(_, index) in form.envPairs" :key="index" class="dynamic-list-item">
                    <input v-model="form.envPairs[index].key" type="text" :placeholder="$t('mcpServer.envKeyPlaceholder')" />
                    <input v-model="form.envPairs[index].value" type="text" :placeholder="$t('mcpServer.envValuePlaceholder')" />
                    <button type="button" class="btn btn-danger btn-sm remove-item-btn" @click="removeEnvPair(index)">&times;</button>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" @click="addEnvPair">{{ $t('mcpServer.addEnv') }}</button>
                </div>
              </div>
            </template>

            <!-- HTTP config -->
            <template v-if="form.server_type === 'http'">
              <div class="form-group">
                <label>{{ $t('mcpServer.url') }}</label>
                <input v-model="form.config.url" type="text" required :placeholder="$t('mcpServer.urlPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('mcpServer.headers') }}</label>
                <div class="dynamic-list">
                  <div v-for="(_, index) in form.headerPairs" :key="index" class="dynamic-list-item">
                    <input v-model="form.headerPairs[index].key" type="text" :placeholder="$t('mcpServer.headerKeyPlaceholder')" />
                    <input v-model="form.headerPairs[index].value" type="text" :placeholder="$t('mcpServer.headerValuePlaceholder')" />
                    <button type="button" class="btn btn-danger btn-sm remove-item-btn" @click="removeHeaderPair(index)">&times;</button>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" @click="addHeaderPair">{{ $t('mcpServer.addHeader') }}</button>
                </div>
              </div>
            </template>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeForm">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </form>

          <!-- JSON Mode -->
          <div v-if="inputMode === 'json'" class="json-mode">
            <div class="form-group">
              <label>{{ $t('mcpServer.jsonEditorLabel') }}</label>
              <textarea
                v-model="jsonText"
                class="json-textarea"
                spellcheck="false"
                :placeholder='`{
  &quot;name&quot;: &quot;my-server&quot;,
  &quot;server_type&quot;: &quot;stdio&quot;,
  &quot;config&quot;: {
    &quot;command&quot;: &quot;npx&quot;,
    &quot;args&quot;: [&quot;-y&quot;, &quot;@upstash/context7-mcp&quot;]
  }
}`'
              ></textarea>
            </div>
            <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeForm">
                {{ $t('common.cancel') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="saving" @click="saveServer">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMcpServerStore } from '../stores/mcpServerStore'

const { t } = useI18n()
const mcpServerStore = useMcpServerStore()

const saving = ref(false)
const showForm = ref(false)
const editingServer = ref(null)
const selectedServer = ref(null)
const inputMode = ref('form')
const jsonText = ref('')
const jsonError = ref('')

function getDefaultForm() {
  return {
    name: '',
    description: '',
    server_type: 'stdio',
    config: { command: '', args: [] },
    envPairs: [],
    headerPairs: [],
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

const closeForm = () => {
  showForm.value = false
  editingServer.value = null
}

onMounted(loadServers)
</script>

<style scoped>
.mcp-server-config {
  padding: 0;
}

.header {
  align-items: center;
}

.header .btn {
  min-height: 36px;
}

.main-content-wrapper {
  display: flex;
  gap: var(--page-gap);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--page-padding);
  background: var(--bg-secondary);
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

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
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
  border-color: rgba(99, 102, 241, 0.35);
}

.server-list-item.active {
  background: var(--hover-bg);
  border: 1px solid var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.1);
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

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
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

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.empty-detail p {
  font-size: var(--font-size-sm);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
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

.header-actions {
  display: flex;
  gap: 10px;
}

/* Info section */
.info-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.info-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
  font-size: 13px;
}

.description-text {
  word-break: break-word;
  line-height: 1.5;
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

.section-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
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

.dynamic-list-item input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.dynamic-list-item input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.remove-item-btn {
  flex-shrink: 0;
  padding: 4px 8px;
}

/* Buttons, modal, toast - shared with AgentConfig */
.btn { padding: 6px 12px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: var(--accent-color); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-secondary { background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); }
.btn-secondary:hover:not(:disabled) { background: var(--bg-tertiary); }
.btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.btn-danger:hover:not(:disabled) { background: #fee2e2; border-color: #fca5a5; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal { background: var(--bg-primary); border-radius: 8px; width: 100%; max-width: 560px; max-height: 90vh; overflow: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideUp 0.3s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); }
.modal-header h2 { margin: 0; font-size: 14px; font-weight: 600; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
.close-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.modal-body { padding: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px; color: var(--text-primary); }
.form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; background: var(--bg-primary); color: var(--text-primary); }
.form-group input:focus, .form-group select:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); }
.toast { position: fixed; bottom: 20px; right: 20px; padding: 10px 16px; border-radius: 6px; color: white; font-size: 13px; font-weight: 500; z-index: 2000; box-shadow: 0 2px 8px rgba(0,0,0,0.1); animation: slideInRight 0.3s ease; }
@keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }

/* Mode toggle in modal header */
.mode-toggle { display: flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }
.mode-toggle-btn { padding: 4px 12px; font-size: 12px; font-weight: 500; border: none; background: var(--bg-primary); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
.mode-toggle-btn.active { background: var(--accent-color); color: white; }
.mode-toggle-btn:not(.active):hover { background: var(--bg-secondary); }

/* JSON textarea */
.json-textarea { width: 100%; min-height: 320px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; line-height: 1.6; background: var(--bg-secondary); color: var(--text-primary); resize: vertical; tab-size: 2; }
.json-textarea:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
.json-error { margin-top: 8px; padding: 8px 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; font-family: 'Consolas', 'Monaco', monospace; word-break: break-all; }
</style>
