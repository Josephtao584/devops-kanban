<template>
  <div class="akb page-shell">
    <div class="header page-header page-header--compact">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ $t('agentKnowledgeBus.title') }}</h1>
        <p class="page-header__description page-description">
          {{ $t('agentKnowledgeBus.description') }}
        </p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="loadAll">
          {{ loading ? $t('common.loading') : $t('common.refresh') }}
        </button>
      </div>
    </div>

    <div ref="layoutRef" class="main-content-wrapper">
      <!-- 列1：项目列表（按团队分组） -->
      <aside class="akb-sidebar" :style="{ width: sidebarWidth + 'px' }">
        <div class="panel-header">
          <h3>{{ $t('agentKnowledgeBus.sidebarTitle') }}</h3>
          <span class="akb-count">{{ totalProjectCount }}</span>
        </div>
        <div v-if="loading && !teams.length" class="loading-state">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="!teams.length" class="empty-list">
          {{ $t('agentKnowledgeBus.noTeams') }}
        </div>
        <div v-else class="akb-team-list">
          <section v-for="team in teams" :key="team.id" class="akb-team-group">
            <header class="akb-team-group__header">
              <span class="akb-team-icon">👥</span>
              <span class="akb-team-name">{{ team.name }}</span>
              <span class="akb-team-count">{{ (team.projects || []).length }}</span>
            </header>
            <div v-if="!(team.projects || []).length" class="akb-team-empty">
              {{ $t('team.noProjectsInTeam') }}
            </div>
            <ul v-else class="akb-project-list">
              <li
                v-for="proj in sortProjects(team.projects)"
                :key="proj.id"
                class="akb-project-item"
                :class="{
                  active: selectedProject?.id === proj.id,
                  'is-knowledge': proj.repo_role === 'knowledge',
                }"
                @click="selectProject(proj)"
              >
                <span class="akb-project-icon">
                  {{ proj.repo_role === 'knowledge' ? '📚' : '📁' }}
                </span>
                <span class="akb-project-name" :title="proj.name">{{ proj.name }}</span>
                <span
                  class="akb-project-role"
                  :class="proj.repo_role === 'knowledge' ? 'role-knowledge' : 'role-dev'"
                >
                  {{ proj.repo_role === 'knowledge' ? $t('team.knowledgeBadge') : $t('team.developmentBadge') }}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </aside>

      <div
        class="akb-resizer"
        :class="{ active: dragging === 'sidebar' }"
        @mousedown.prevent="startDrag('sidebar', $event)"
      ></div>

      <!-- 列2：文件树 -->
      <section class="akb-tree-pane" :style="{ width: treeWidth + 'px' }">
        <template v-if="selectedProject">
          <header class="akb-tree-pane__header">
            <div class="akb-tree-pane__title">
              <span class="akb-tree-pane__icon">
                {{ selectedProject.repo_role === 'knowledge' ? '📚' : '📁' }}
              </span>
              <div class="akb-tree-pane__crumbs">
                <span v-if="selectedTeamName" class="akb-tree-pane__team">{{ selectedTeamName }}</span>
                <span v-if="selectedTeamName" class="akb-tree-pane__sep">/</span>
                <span class="akb-tree-pane__project" :title="selectedProject.name">
                  {{ selectedProject.name }}
                </span>
              </div>
            </div>
          </header>
          <div
            v-if="!treeLoading && !treeError && hasTreeChildren"
            class="akb-tree-pane__stats"
          >
            <div class="akb-stat">
              <span class="akb-stat__value">{{ totalFiles }}</span>
              <span class="akb-stat__label">{{ $t('agentKnowledgeBus.statFiles') }}</span>
            </div>
            <div class="akb-stat">
              <span class="akb-stat__value">{{ totalDirs }}</span>
              <span class="akb-stat__label">{{ $t('agentKnowledgeBus.statDirs') }}</span>
            </div>
            <div v-if="markdownCount" class="akb-stat">
              <span class="akb-stat__value">{{ markdownCount }}</span>
              <span class="akb-stat__label">{{ $t('agentKnowledgeBus.statMarkdown') }}</span>
            </div>
          </div>
          <div v-if="selectedProject.local_path" class="akb-path-bar">
            <span class="akb-path-bar__label">{{ $t('agentKnowledgeBus.localPath') }}</span>
            <span class="akb-path-bar__value" :title="selectedProject.local_path">
              {{ selectedProject.local_path }}
            </span>
          </div>
          <div class="akb-tree-pane__body">
            <div v-if="treeLoading" class="akb-hint">{{ $t('common.loading') }}</div>
            <div v-else-if="treeError" class="akb-hint akb-hint--error">{{ treeError }}</div>
            <div v-else-if="!tree?.children?.length" class="akb-hint">
              {{ $t('agentKnowledgeBus.emptyRepo') }}
            </div>
            <FileTree
              v-else
              :tree="tree"
              :selected-path="selectedFilePath"
              @file-select="handleFileSelect"
            />
          </div>
        </template>
        <div v-else class="empty-detail">
          <p>{{ $t('agentKnowledgeBus.selectProjectHint') }}</p>
        </div>
      </section>

      <div
        class="akb-resizer"
        :class="{ active: dragging === 'tree' }"
        @mousedown.prevent="startDrag('tree', $event)"
      ></div>

      <!-- 列3：文件预览 -->
      <main class="akb-preview-pane">
        <template v-if="selectedFilePath">
          <header class="akb-preview-pane__header">
            <span class="akb-preview-pane__icon">{{ fileIcon(selectedFilePath) }}</span>
            <span class="akb-preview-pane__path" :title="selectedFilePath">
              {{ selectedFilePath }}
            </span>
            <span v-if="fileMeta" class="akb-preview-pane__meta">{{ fileMeta }}</span>
            <span v-if="isEditable" class="akb-preview-pane__actions">
              <template v-if="!isEditing">
                <button class="btn btn-secondary btn-sm" :disabled="!canEdit" @click="enterEditMode">
                  {{ $t('agentKnowledgeBus.edit') }}
                </button>
              </template>
              <template v-else>
                <span v-if="isDirty" class="akb-dirty-badge">{{ $t('agentKnowledgeBus.unsaved') }}</span>
                <button class="btn btn-secondary btn-sm" :disabled="saving" @click="cancelEdit">
                  {{ $t('common.cancel') }}
                </button>
                <button class="btn btn-primary btn-sm" :disabled="!isDirty || saving" @click="saveEdit">
                  {{ saving ? $t('agentKnowledgeBus.saving') : $t('common.save') }}
                </button>
              </template>
            </span>
          </header>
          <div class="akb-preview-pane__body">
            <div v-if="fileLoading" class="akb-hint">{{ $t('common.loading') }}</div>
            <div v-else-if="fileError" class="akb-hint akb-hint--error">{{ fileError }}</div>
            <div v-else-if="fileIsBinary && !isPreviewableImage(selectedFilePath)" class="akb-hint">
              {{ $t('agentKnowledgeBus.binaryFile') }}
            </div>
            <div
              v-else-if="isPreviewableImage(selectedFilePath)"
              class="akb-image-wrap"
            >
              <img :src="imageSrc" :alt="selectedFilePath" />
            </div>
            <textarea
              v-else-if="isEditing"
              v-model="editorContent"
              class="akb-editor"
              spellcheck="false"
              :placeholder="$t('agentKnowledgeBus.editorPlaceholder')"
            ></textarea>
            <div
              v-else-if="isMarkdown(selectedFilePath)"
              class="akb-markdown-wrap"
            >
              <div
                ref="markdownRef"
                class="akb-markdown markdown-body"
                v-html="renderedMarkdown"
                @click="handleMarkdownClick"
              ></div>
              <aside v-if="markdownToc.length" class="akb-toc">
                <div class="akb-toc__title">{{ $t('agentKnowledgeBus.toc') }}</div>
                <ul class="akb-toc__list">
                  <li
                    v-for="item in markdownToc"
                    :key="item.id"
                    :class="['akb-toc__item', `akb-toc__l${item.level}`]"
                    @click="scrollToToc(item)"
                  >
                    {{ item.text }}
                  </li>
                </ul>
              </aside>
            </div>
            <pre v-else class="akb-pre">{{ fileContent }}</pre>
          </div>
        </template>
        <div v-else class="empty-detail">
          <p>{{ $t('agentKnowledgeBus.selectFileHint') }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { getTeams, getTeam } from '../api/team.js'
import { getProjectFileTree, getProjectFileContent, saveProjectFileContent } from '../api/project.js'
import FileTree from '../components/editor/FileTree.vue'

marked.setOptions({ gfm: true, breaks: false })

const teams = ref([])
const loading = ref(false)
const selectedProject = ref(null)

// Resizable column widths. Persisted in localStorage so user's adjustment
// sticks across reloads. Defaults match the old hard-coded layout.
const STORAGE_KEY = 'akb.layoutWidths'
const SIDEBAR_DEFAULT = 300
const TREE_DEFAULT = 320
const SIDEBAR_BOUNDS = { min: 200, max: 480 }
const TREE_BOUNDS = { min: 220, max: 560 }
const PREVIEW_MIN = 360 // ensure column 3 always has reasonable space

const sidebarWidth = ref(SIDEBAR_DEFAULT)
const treeWidth = ref(TREE_DEFAULT)
const layoutRef = ref(null)
const dragging = ref('') // '' | 'sidebar' | 'tree'

;(function loadStoredWidths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Number.isFinite(parsed?.sidebar)) sidebarWidth.value = parsed.sidebar
    if (Number.isFinite(parsed?.tree)) treeWidth.value = parsed.tree
  } catch { /* corrupted entry — fall back to defaults */ }
})()

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value))
}

function persistWidths() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sidebar: sidebarWidth.value, tree: treeWidth.value }),
    )
  } catch { /* quota / privacy mode — silently ignore */ }
}

function startDrag(which, event) {
  dragging.value = which
  const startX = event.clientX
  const startSidebar = sidebarWidth.value
  const startTree = treeWidth.value
  const containerWidth = layoutRef.value?.clientWidth || 1200

  const onMove = (e) => {
    const delta = e.clientX - startX
    if (which === 'sidebar') {
      const next = clamp(startSidebar + delta, SIDEBAR_BOUNDS)
      // Don't let column 1 + column 2 push column 3 below PREVIEW_MIN.
      const headroom = containerWidth - treeWidth.value - PREVIEW_MIN - 8
      sidebarWidth.value = Math.min(next, Math.max(SIDEBAR_BOUNDS.min, headroom))
    } else {
      const next = clamp(startTree + delta, TREE_BOUNDS)
      const headroom = containerWidth - sidebarWidth.value - PREVIEW_MIN - 8
      treeWidth.value = Math.min(next, Math.max(TREE_BOUNDS.min, headroom))
    }
  }
  const onUp = () => {
    dragging.value = ''
    persistWidths()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// File tree state for the currently selected project.
const tree = ref(null)
const treeLoading = ref(false)
const treeError = ref('')

const hasTreeChildren = computed(() => Array.isArray(tree.value?.children) && tree.value.children.length > 0)

const totalFiles = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'file') { count += 1; return }
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  ;(tree.value?.children || []).forEach(walk)
  return count
})

const totalDirs = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'directory') count += 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  ;(tree.value?.children || []).forEach(walk)
  return count
})

const markdownCount = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'file' && isMarkdown(node.path)) count += 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  ;(tree.value?.children || []).forEach(walk)
  return count
})

// File preview state.
const selectedFilePath = ref('')
const fileContent = ref('')
const fileLoading = ref(false)
const fileError = ref('')
const fileIsBinary = ref(false)
const fileSize = ref(0)
const markdownRef = ref(null)

// Edit mode state — kept separate from fileContent so cancelling reverts cleanly.
const isEditing = ref(false)
const editorContent = ref('')
const saving = ref(false)

const isEditable = computed(() => {
  if (!selectedFilePath.value) return false
  if (fileIsBinary.value || isPreviewableImage(selectedFilePath.value)) return false
  return true
})

const canEdit = computed(() => !fileLoading.value && !fileError.value && isEditable.value)

const isDirty = computed(() => isEditing.value && editorContent.value !== fileContent.value)

function enterEditMode() {
  if (!canEdit.value) return
  editorContent.value = fileContent.value
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editorContent.value = ''
}

async function saveEdit() {
  if (!isDirty.value || !selectedProject.value || !selectedFilePath.value) return
  saving.value = true
  try {
    const resp = await saveProjectFileContent(
      selectedProject.value.id,
      selectedFilePath.value,
      editorContent.value,
    )
    if (resp?.success) {
      fileContent.value = editorContent.value
      fileSize.value = editorContent.value.length
      isEditing.value = false
      ElMessage.success('已保存')
    } else {
      ElMessage.error(resp?.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const totalProjectCount = computed(() =>
  teams.value.reduce((acc, t) => acc + (t.projects?.length || 0), 0),
)

function sortProjects(projects) {
  const arr = Array.isArray(projects) ? [...projects] : []
  arr.sort((a, b) => {
    if (a.repo_role === 'knowledge' && b.repo_role !== 'knowledge') return -1
    if (a.repo_role !== 'knowledge' && b.repo_role === 'knowledge') return 1
    return 0
  })
  return arr
}

async function loadAll() {
  loading.value = true
  try {
    const resp = await getTeams()
    if (!resp?.success) {
      ElMessage.error(resp?.message || 'Failed to load teams')
      return
    }
    const list = Array.isArray(resp.data) ? resp.data : []
    // /api/teams returns just team rows — hydrate projects per team in parallel.
    const detailed = await Promise.all(
      list.map(async (team) => {
        try {
          const detailResp = await getTeam(team.id)
          if (detailResp?.success && detailResp.data) {
            return { ...team, ...detailResp.data }
          }
        } catch { /* fall through */ }
        return { ...team, projects: [] }
      }),
    )
    teams.value = detailed

    if (!selectedProject.value) {
      const firstTeamWithProjects = detailed.find(t => (t.projects || []).length)
      if (firstTeamWithProjects) {
        selectProject(sortProjects(firstTeamWithProjects.projects)[0])
      }
    }
  } catch (e) {
    ElMessage.error(e?.message || 'Failed to load teams')
  } finally {
    loading.value = false
  }
}

function selectProject(proj) {
  selectedProject.value = proj
  // Reset preview pane when switching projects — old file path no longer applies.
  selectedFilePath.value = ''
  fileContent.value = ''
  fileError.value = ''
  fileIsBinary.value = false
  fileSize.value = 0
}

// Look up which team the currently selected project belongs to so we can show
// a "Team / Project" breadcrumb in column 2.
const selectedTeamName = computed(() => {
  if (!selectedProject.value) return ''
  const team = teams.value.find(t =>
    (t.projects || []).some(p => p.id === selectedProject.value.id),
  )
  return team?.name || ''
})

// Pick a sensible default file to open after the file tree loads. Order matches
// the convention used elsewhere: ARCHITECTURE first, then README, then docs/architecture.
const DEFAULT_DOC_CANDIDATES = [
  'architecture.md',
  'architecture.markdown',
  'readme.md',
  'readme.markdown',
  'readme',
]
function findDefaultDoc(treeRoot) {
  if (!treeRoot?.children) return null
  const topFiles = new Map()
  for (const node of treeRoot.children) {
    if (node.type === 'file') {
      topFiles.set((node.name || '').toLowerCase(), node.path)
    }
  }
  for (const name of DEFAULT_DOC_CANDIDATES) {
    const path = topFiles.get(name)
    if (path) return path
  }
  // Fall back to docs/architecture.md if the repo organizes docs under docs/.
  const docsDir = treeRoot.children.find(
    n => n.type === 'directory' && (n.name || '').toLowerCase() === 'docs',
  )
  if (docsDir?.children) {
    const hit = docsDir.children.find(
      n => n.type === 'file' && /^architecture\.(md|markdown)$/i.test(n.name || ''),
    )
    if (hit) return hit.path
  }
  return null
}

async function loadProjectTree(project) {
  if (!project?.id) {
    tree.value = null
    treeError.value = ''
    return
  }
  treeLoading.value = true
  treeError.value = ''
  tree.value = null
  try {
    const resp = await getProjectFileTree(project.id)
    if (resp?.success) {
      tree.value = normalizeTreePaths(resp.data)
      // Auto-open the project's default doc so column 3 isn't blank on every
      // project switch — that's the most common landing page users want.
      const defaultDoc = findDefaultDoc(tree.value)
      if (defaultDoc) {
        handleFileSelect(defaultDoc)
      }
    } else {
      treeError.value = resp?.message || 'Failed to load file tree'
    }
  } catch (e) {
    treeError.value = e?.message || 'Failed to load'
  } finally {
    treeLoading.value = false
  }
}

// Normalize all node paths to use forward slashes. The backend emits OS-native
// separators when it falls back to filesystem walk (Windows = `\`), but every
// other path consumer in this view assumes `/`.
function normalizeTreePaths(node) {
  if (!node) return node
  if (typeof node.path === 'string') node.path = node.path.split('\\').join('/')
  if (Array.isArray(node.children)) node.children.forEach(normalizeTreePaths)
  return node
}

watch(() => selectedProject.value?.id, (id) => {
  if (id) loadProjectTree(selectedProject.value)
})

// --- File preview ---

function isMarkdown(path) {
  if (!path) return false
  const lower = path.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i
function isPreviewableImage(path) {
  return !!path && IMAGE_EXTENSIONS.test(path)
}

// Build the raw asset URL for the currently-selected image so <img> can load
// it directly from disk through the project raw endpoint.
const imageSrc = computed(() => {
  if (!selectedFilePath.value || !selectedProject.value) return ''
  const segments = selectedFilePath.value.split('/').filter(Boolean).map(encodeURIComponent)
  return `/api/projects/${selectedProject.value.id}/raw/${segments.join('/')}`
})

function fileIcon(name) {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return '📖'
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return '⚙️'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg')) return '🖼️'
  return '📄'
}

const fileMeta = computed(() => {
  if (fileIsBinary.value) return 'binary'
  if (!fileSize.value) return ''
  if (fileSize.value < 1024) return `${fileSize.value} B`
  if (fileSize.value < 1024 * 1024) return `${(fileSize.value / 1024).toFixed(1)} KB`
  return `${(fileSize.value / 1024 / 1024).toFixed(1)} MB`
})

// Resolve relative asset URLs against the file's directory and rewrite to
// the project raw endpoint so embedded images render.
function rewriteAssetUrl(src, baseDir, projectId) {
  if (!src) return src
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(src)) return src
  let cleaned = src.replace(/^\.\//, '').replace(/^\/+/, '')
  const hashIdx = cleaned.search(/[?#]/)
  if (hashIdx >= 0) cleaned = cleaned.slice(0, hashIdx)
  const stack = []
  const baseSegments = baseDir ? baseDir.split('/').filter(Boolean) : []
  stack.push(...baseSegments)
  for (const seg of cleaned.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') { stack.pop(); continue }
    stack.push(seg)
  }
  if (!stack.length || !projectId) return src
  return `/api/projects/${projectId}/raw/${stack.map(encodeURIComponent).join('/')}`
}

// Resolve a relative doc-link href to an in-repo path. Used to mark internal
// Markdown-to-Markdown links so handleMarkdownClick can intercept them.
function resolveDocPath(href, baseDir) {
  if (!href) return null
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(href)) return null
  let cleaned = href.replace(/^\.\//, '').replace(/^\/+/, '')
  const hashIdx = cleaned.search(/[?#]/)
  let trailing = ''
  if (hashIdx >= 0) {
    trailing = cleaned.slice(hashIdx)
    cleaned = cleaned.slice(0, hashIdx)
  }
  // Authors often write links with URL-encoded spaces or unicode; decode so we
  // can match the raw filename in the file tree.
  try { cleaned = decodeURIComponent(cleaned) } catch { /* keep as-is */ }
  const stack = []
  const baseSegments = baseDir ? baseDir.split('/').filter(Boolean) : []
  stack.push(...baseSegments)
  for (const seg of cleaned.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') { stack.pop(); continue }
    stack.push(seg)
  }
  if (!stack.length) return null
  return { path: stack.join('/'), hash: trailing.startsWith('#') ? trailing : '' }
}

// Look up a file in the tree by its relative path. Returns the actual node
// path (for navigation) or null. Tries exact match first, then a
// case-insensitive fallback so links like `README.MD` or `Docs/intro.md`
// still resolve when the on-disk filename uses different casing.
function findFileInTree(treeRoot, relPath) {
  if (!treeRoot || !relPath) return null
  let exact = null
  let ciMatch = null
  const target = String(relPath)
  const targetLower = target.toLowerCase()
  const walk = (node) => {
    if (!node || exact) return
    if (node.type === 'file') {
      if (node.path === target) { exact = node.path; return }
      if (!ciMatch && typeof node.path === 'string' && node.path.toLowerCase() === targetLower) {
        ciMatch = node.path
      }
      return
    }
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  walk(treeRoot)
  return exact || ciMatch
}

function fileExistsInTree(treeRoot, relPath) {
  return !!findFileInTree(treeRoot, relPath)
}

// GitHub-style slug for ToC anchors. Not perfect but matches the common case.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Build a TOC by re-lexing the markdown source. Slugs must agree with what
// renderMarkdown emits or scrolling won't find the heading.
function extractToc(content) {
  if (!content) return []
  let tokens
  try {
    tokens = marked.lexer(content)
  } catch {
    return []
  }
  const counts = new Map()
  const items = []
  for (const tok of tokens) {
    if (tok.type !== 'heading') continue
    if (tok.depth < 1 || tok.depth > 3) continue
    const text = String(tok.text || '').trim()
    if (!text) continue
    let slug = slugify(text)
    if (!slug) slug = `section-${counts.size + 1}`
    const seen = counts.get(slug) || 0
    counts.set(slug, seen + 1)
    const id = seen ? `${slug}-${seen}` : slug
    items.push({ id, text, level: tok.depth })
  }
  return items
}

function renderMarkdown(content, baseDir, projectId) {
  if (!content) return ''
  const renderer = new marked.Renderer()
  const headingSlugCounts = new Map()
  const origImage = renderer.image.bind(renderer)
  renderer.image = (hrefOrToken, title, text) => {
    if (hrefOrToken && typeof hrefOrToken === 'object') {
      const token = { ...hrefOrToken, href: rewriteAssetUrl(hrefOrToken.href, baseDir, projectId) }
      return origImage(token)
    }
    return origImage(rewriteAssetUrl(hrefOrToken, baseDir, projectId), title, text)
  }
  // Emit slug ids on headings so the TOC can scroll-link to them. Slugs match
  // what extractToc produces.
  renderer.heading = (textOrToken, levelArg, raw) => {
    let level, plain
    let html = ''
    if (textOrToken && typeof textOrToken === 'object') {
      level = textOrToken.depth
      plain = textOrToken.text || ''
      html = this && this.parser ? this.parser.parseInline(textOrToken.tokens || []) : plain
    } else {
      level = levelArg
      plain = raw || textOrToken
      html = textOrToken
    }
    let slug = slugify(plain)
    if (!slug) slug = `section-${headingSlugCounts.size + 1}`
    const seen = headingSlugCounts.get(slug) || 0
    headingSlugCounts.set(slug, seen + 1)
    const finalSlug = seen ? `${slug}-${seen}` : slug
    return `<h${level} id="${finalSlug}">${html || plain}</h${level}>\n`
  }
  renderer.link = (hrefOrToken, title, text) => {
    let href, linkTitle, linkText
    if (hrefOrToken && typeof hrefOrToken === 'object') {
      href = hrefOrToken.href || ''
      linkTitle = hrefOrToken.title
      linkText = hrefOrToken.text != null ? hrefOrToken.text : ''
    } else {
      href = hrefOrToken; linkTitle = title; linkText = text != null ? text : ''
    }
    const t = linkTitle ? ` title="${String(linkTitle).replace(/"/g, '&quot;')}"` : ''
    if (/^(https?:)/i.test(href)) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${t}>${linkText}</a>`
    }
    if (href.startsWith('#')) {
      return `<a href="${href}"${t}>${linkText}</a>`
    }
    // Asset-like links (images, pdf) — rewrite to raw endpoint and let the
    // browser open them in a new tab.
    if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|pdf)(?:[?#]|$)/i.test(href)) {
      const next = rewriteAssetUrl(href, baseDir, projectId)
      return `<a href="${next}" target="_blank" rel="noopener noreferrer"${t}>${linkText}</a>`
    }
    // Internal doc link — tag with data-doc-link so handleMarkdownClick can
    // intercept and navigate inside this view instead of letting the browser
    // hit a 404.
    const resolved = resolveDocPath(href, baseDir)
    if (!resolved) {
      return `<a href="${href}"${t}>${linkText}</a>`
    }
    const dataPath = String(resolved.path).replace(/"/g, '&quot;')
    const dataHash = resolved.hash ? ` data-doc-hash="${String(resolved.hash).replace(/"/g, '&quot;')}"` : ''
    return `<a href="javascript:void(0)" data-doc-link="${dataPath}"${dataHash}${t} class="akb-doc-link">${linkText}</a>`
  }
  try {
    return marked.parse(content, { renderer })
  } catch {
    return ''
  }
}

const renderedMarkdown = computed(() => {
  if (!fileContent.value || !selectedProject.value) return ''
  const dir = selectedFilePath.value.includes('/')
    ? selectedFilePath.value.slice(0, selectedFilePath.value.lastIndexOf('/'))
    : ''
  return renderMarkdown(fileContent.value, dir, selectedProject.value.id)
})

// Only show the TOC for documents with at least 3 headings — otherwise the
// sidebar adds chrome without value.
const markdownToc = computed(() => {
  if (!fileContent.value || !isMarkdown(selectedFilePath.value)) return []
  const items = extractToc(fileContent.value)
  return items.length >= 3 ? items : []
})

function scrollToToc(item) {
  if (!markdownRef.value) return
  const el = markdownRef.value.querySelector(`#${CSS.escape(item.id)}`)
  if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleFileSelect(filePath, hash = '') {
  if (!filePath || !selectedProject.value) return
  // Discard pending edits when navigating away — saving stays explicit.
  isEditing.value = false
  editorContent.value = ''
  selectedFilePath.value = filePath
  fileLoading.value = true
  fileError.value = ''
  fileIsBinary.value = false
  fileContent.value = ''
  fileSize.value = 0
  // Image files render directly from the raw endpoint via <img>; we don't need
  // to fetch the binary blob through getProjectFileContent.
  if (isPreviewableImage(filePath)) {
    fileLoading.value = false
    return
  }
  try {
    const resp = await getProjectFileContent(selectedProject.value.id, filePath)
    if (resp?.success) {
      fileIsBinary.value = !!resp.data?.isBinary
      fileSize.value = resp.data?.size || 0
      fileContent.value = resp.data?.content || ''
      // Scroll to anchor if hash is provided, otherwise reset preview scroll.
      await nextTick()
      if (hash && markdownRef.value) {
        const id = hash.startsWith('#') ? hash.slice(1) : hash
        const el = id ? markdownRef.value.querySelector(`#${CSS.escape(id)}`) : null
        if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (markdownRef.value) {
        markdownRef.value.scrollTop = 0
      }
    } else {
      fileError.value = resp?.message || 'Failed to load file'
    }
  } catch (e) {
    fileError.value = e?.message || 'Failed to load file'
  } finally {
    fileLoading.value = false
  }
}

// Intercept clicks inside the rendered markdown so internal doc links navigate
// within this view (load the target file in column 3) instead of letting the
// browser follow a dead href.
function handleMarkdownClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor) return
  const docPath = anchor.getAttribute('data-doc-link')
  if (!docPath) return
  event.preventDefault()
  const hash = anchor.getAttribute('data-doc-hash') || ''
  const actualPath = findFileInTree(tree.value, docPath)
  if (!actualPath) {
    ElMessage.warning(`项目内未找到文件：${docPath}`)
    return
  }
  handleFileSelect(actualPath, hash)
}

onMounted(loadAll)
</script>

<style scoped>
@import '../styles/config-page.css';

.akb {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.akb .header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.main-content-wrapper {
  flex: 1;
}

/* ---- Column 1: Project Sidebar ---- */
.akb-sidebar {
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Drag handle between columns. Sits as a flex item in the wrapper, so it
   contributes to the layout instead of overlapping panes. */
.akb-resizer {
  flex: 0 0 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  transition: background-color 0.15s ease;
}

.akb-resizer::after {
  content: '';
  position: absolute;
  top: 30%;
  bottom: 30%;
  left: 50%;
  width: 2px;
  border-radius: 2px;
  background: var(--border-color);
  transform: translateX(-50%);
  transition: background-color 0.15s ease;
}

.akb-resizer:hover::after,
.akb-resizer.active::after {
  background: var(--accent-color);
}

.akb-resizer.active {
  background: rgba(37, 198, 201, 0.06);
}

.akb-count {
  background: var(--accent-color-soft);
  color: var(--accent-color-strong, var(--accent-color));
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  text-align: center;
}

.akb-team-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px 16px;
}

.akb-team-group + .akb-team-group {
  margin-top: 14px;
}

.akb-team-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.akb-team-icon { font-size: 14px; }

.akb-team-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: normal;
  font-weight: 700;
  font-size: 12px;
}

.akb-team-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 7px;
  border-radius: 999px;
}

.akb-team-empty {
  padding: 8px 12px 4px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

.akb-project-list {
  list-style: none;
  margin: 0;
  padding: 2px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.akb-project-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.akb-project-item:hover {
  border-color: rgba(37, 198, 201, 0.24);
  background: var(--bg-secondary);
}

.akb-project-item.active {
  background: rgba(37, 198, 201, 0.05);
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.12);
}

.akb-project-item.is-knowledge {
  background: linear-gradient(180deg, rgba(255, 244, 214, 0.5) 0%, #fff 100%);
  border-color: rgba(230, 162, 60, 0.3);
}

.akb-project-item.is-knowledge.active {
  background: rgba(230, 162, 60, 0.12);
  border-color: #e6a23c;
  box-shadow: inset 0 0 0 1px rgba(230, 162, 60, 0.25);
}

.akb-project-icon { font-size: 14px; flex-shrink: 0; }

.akb-project-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.akb-project-role {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}

.akb-project-role.role-knowledge {
  color: #b8821b;
  background: rgba(230, 162, 60, 0.14);
}

.akb-project-role.role-dev {
  color: var(--accent-color-strong);
  background: var(--accent-color-soft);
}

/* ---- Column 2: File Tree ---- */
.akb-tree-pane {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.akb-tree-pane__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.akb-tree-pane__title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.akb-tree-pane__icon { font-size: 16px; flex-shrink: 0; }

.akb-tree-pane__crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.akb-tree-pane__team {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.akb-tree-pane__sep {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.akb-tree-pane__project {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.akb-tree-pane__stats {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.akb-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-width: 0;
}

.akb-stat__value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.akb-stat__label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.akb-path-bar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
  flex-shrink: 0;
}

.akb-path-bar__label {
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
}

.akb-path-bar__value {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.akb-tree-pane__body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 12px;
}

/* ---- Column 3: File Preview ---- */
.akb-preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-width: 0;
}

.akb-preview-pane__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.akb-preview-pane__icon { font-size: 16px; flex-shrink: 0; }

.akb-preview-pane__path {
  flex: 1;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.akb-preview-pane__meta {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.akb-preview-pane__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.akb-dirty-badge {
  font-size: 11px;
  font-weight: 600;
  color: #b8821b;
  background: rgba(230, 162, 60, 0.16);
  padding: 2px 8px;
  border-radius: 999px;
}

.akb-editor {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: none;
  outline: none;
  resize: none;
  padding: 18px 22px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-sizing: border-box;
}

.akb-editor:focus {
  background: #fffef9;
}

.akb-preview-pane__body {
  flex: 1;
  overflow: auto;
  scroll-behavior: smooth;
}

/* Image preview — center the asset and let it scale to viewport. */
.akb-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #fafbfc 0,
    #fafbfc 10px,
    #f3f5f7 10px,
    #f3f5f7 20px
  );
}

.akb-image-wrap img {
  max-width: 100%;
  max-height: 80vh;
  background: #fff;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12);
  border-radius: 4px;
}

/* Markdown body + side TOC layout — mirrors the dialog version so the
   experience is consistent. */
.akb-markdown-wrap {
  display: flex;
  align-items: flex-start;
  min-height: 100%;
}

.akb-markdown-wrap .akb-markdown {
  flex: 1;
  min-width: 0;
}

.akb-toc {
  width: 220px;
  min-width: 180px;
  max-width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  background: #fafbfc;
  padding: 18px 14px;
  font-size: 12px;
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: 100vh;
  overflow-y: auto;
}

.akb-toc__title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.akb-toc__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.akb-toc__item {
  padding: 4px 8px;
  margin-bottom: 2px;
  cursor: pointer;
  color: var(--text-secondary);
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.akb-toc__item:hover {
  color: var(--accent-color-strong);
  background: var(--accent-color-soft);
  border-left-color: var(--accent-color);
}

.akb-toc__l1 { padding-left: 8px; font-weight: 600; color: var(--text-primary); }
.akb-toc__l2 { padding-left: 18px; }
.akb-toc__l3 { padding-left: 28px; font-size: 11px; color: var(--text-muted); }

.akb-pre {
  margin: 0;
  padding: 16px 20px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

.akb-markdown {
  padding: 24px 32px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

.akb-hint {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}

.akb-hint--error {
  color: var(--el-color-danger);
  font-style: normal;
}
</style>

<style>
.akb-markdown.markdown-body h1,
.akb-markdown.markdown-body h2,
.akb-markdown.markdown-body h3,
.akb-markdown.markdown-body h4 {
  margin: 1.4em 0 0.5em;
  font-weight: 700;
  color: #1f2329;
  line-height: 1.3;
}
.akb-markdown.markdown-body h1 { font-size: 1.7em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.akb-markdown.markdown-body h2 { font-size: 1.35em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.akb-markdown.markdown-body h3 { font-size: 1.15em; }
.akb-markdown.markdown-body p { margin: 0.6em 0; }
.akb-markdown.markdown-body a { color: #409eff; text-decoration: none; }
.akb-markdown.markdown-body a:hover { text-decoration: underline; }
.akb-markdown.markdown-body ul,
.akb-markdown.markdown-body ol { padding-left: 1.8em; margin: 0.6em 0; }
.akb-markdown.markdown-body li { margin: 0.3em 0; }
.akb-markdown.markdown-body blockquote {
  margin: 0.7em 0;
  padding: 0.4em 1em;
  border-left: 4px solid #dfe2e5;
  background: #fafbfc;
  color: #6a737d;
}
.akb-markdown.markdown-body code {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  background: rgba(27, 31, 35, 0.06);
  border-radius: 3px;
}
.akb-markdown.markdown-body pre {
  margin: 0.8em 0;
  padding: 14px 16px;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}
.akb-markdown.markdown-body pre code { background: transparent; padding: 0; font-size: inherit; }
.akb-markdown.markdown-body table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
.akb-markdown.markdown-body th,
.akb-markdown.markdown-body td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; }
.akb-markdown.markdown-body th { background: #f6f8fa; font-weight: 600; }
.akb-markdown.markdown-body img { max-width: 100%; height: auto; }
.akb-markdown.markdown-body hr { border: none; border-top: 1px solid #eaecef; margin: 1.2em 0; }

/* In-repo doc link — visually distinct so users see it stays inside the view. */
.akb-markdown.markdown-body a.akb-doc-link {
  color: #b8821b;
  border-bottom: 1px dashed rgba(230, 162, 60, 0.5);
  padding-bottom: 1px;
}
.akb-markdown.markdown-body a.akb-doc-link:hover {
  color: #e6a23c;
  border-bottom-color: #e6a23c;
  text-decoration: none;
}
</style>
