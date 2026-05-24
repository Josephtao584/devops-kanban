<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="80vw"
    top="5vh"
    :append-to-body="true"
    :destroy-on-close="true"
    class="knowledge-repo-dialog"
  >
    <div class="krd-body">
      <div class="krd-sidebar">
        <div class="krd-sidebar-header">
          <button
            class="krd-overview-btn"
            :class="{ 'is-active': !currentPath }"
            @click="goOverview"
          >
            📖 知识库概览
          </button>
          <span class="krd-path-label">本地路径</span>
          <span class="krd-path-value" :title="project?.local_path">
            {{ project?.local_path || '—' }}
          </span>
        </div>
        <div class="krd-tree-wrapper">
          <div v-if="treeLoading" class="krd-hint">加载中...</div>
          <div v-else-if="treeError" class="krd-hint krd-hint--error">{{ treeError }}</div>
          <div v-else-if="!tree?.children?.length" class="krd-hint">仓库为空</div>
          <FileTree
            v-else
            :tree="tree"
            :selected-path="currentPath"
            @file-select="handleFileSelect"
          />
        </div>
      </div>

      <div class="krd-main">
        <!-- 概览模式 -->
        <template v-if="!currentPath">
          <div ref="overviewRef" class="krd-overview" @click="handleMarkdownClick">
            <div class="krd-overview-meta">
              <div class="krd-overview-title">
                <span class="krd-overview-icon">📚</span>
                <h2>{{ project?.name || '知识库' }}</h2>
              </div>
              <div class="krd-overview-stats">
                <div class="krd-stat">
                  <span class="krd-stat-value">{{ totalFiles }}</span>
                  <span class="krd-stat-label">文件</span>
                </div>
                <div class="krd-stat">
                  <span class="krd-stat-value">{{ totalDirs }}</span>
                  <span class="krd-stat-label">目录</span>
                </div>
                <div v-if="markdownCount" class="krd-stat">
                  <span class="krd-stat-value">{{ markdownCount }}</span>
                  <span class="krd-stat-label">Markdown</span>
                </div>
              </div>
              <p v-if="project?.description" class="krd-overview-desc">
                {{ project.description }}
              </p>
            </div>

            <div v-if="readmeLoading" class="krd-hint">加载 README...</div>
            <div v-else-if="readmeHtml" class="krd-overview-readme-wrap">
              <div class="krd-overview-readme markdown-body" v-html="readmeHtml"></div>
              <aside v-if="readmeToc.length" class="krd-toc">
                <div class="krd-toc-title">目录</div>
                <ul class="krd-toc-list">
                  <li
                    v-for="item in readmeToc"
                    :key="item.id"
                    :class="['krd-toc-item', `krd-toc-l${item.level}`]"
                    @click.stop="scrollToToc(item)"
                  >
                    {{ item.text }}
                  </li>
                </ul>
              </aside>
            </div>
            <div v-else-if="hasFiles" class="krd-overview-readme krd-overview-readme--empty">
              此知识库根目录暂无 README 文件
            </div>

            <div v-if="topDirs.length" class="krd-overview-dirs">
              <h3>顶层目录</h3>
              <div class="krd-dir-grid">
                <div
                  v-for="entry in topDirs"
                  :key="entry.path"
                  class="krd-dir-item"
                  @click="handleFileSelect(entry.firstFilePath || '')"
                >
                  <span class="krd-dir-icon">📁</span>
                  <span class="krd-dir-name">{{ entry.name }}</span>
                  <span class="krd-dir-count">{{ entry.fileCount }} 个文件</span>
                </div>
              </div>
            </div>

            <div v-if="topFiles.length" class="krd-overview-files">
              <h3>根目录文件</h3>
              <ul class="krd-file-list">
                <li
                  v-for="file in topFiles"
                  :key="file.path"
                  class="krd-file-list-item"
                  @click="handleFileSelect(file.path)"
                >
                  <span class="krd-file-icon">{{ fileIcon(file.name) }}</span>
                  <span class="krd-file-name">{{ file.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </template>

        <!-- 文件预览模式 -->
        <template v-else>
          <div class="krd-file-header">
            <button class="krd-back-btn" @click="goOverview" title="返回概览">←</button>
            <span class="krd-file-path">{{ currentPath }}</span>
            <span v-if="fileMeta" class="krd-file-meta">{{ fileMeta }}</span>
          </div>
          <div class="krd-file-content-wrap">
            <div ref="fileBodyRef" class="krd-file-content" @click="handleMarkdownClick">
              <div v-if="fileLoading" class="krd-hint">加载中...</div>
              <div v-else-if="fileError" class="krd-hint krd-hint--error">{{ fileError }}</div>
              <div v-else-if="fileIsBinary" class="krd-hint">二进制文件，不支持预览</div>
              <div
                v-else-if="isMarkdown(currentPath)"
                class="krd-markdown markdown-body"
                v-html="renderedMarkdown"
              ></div>
              <pre v-else class="krd-pre">{{ fileContent }}</pre>
            </div>
            <aside v-if="fileToc.length" class="krd-toc krd-toc--side">
              <div class="krd-toc-title">目录</div>
              <ul class="krd-toc-list">
                <li
                  v-for="item in fileToc"
                  :key="item.id"
                  :class="['krd-toc-item', `krd-toc-l${item.level}`]"
                  @click="scrollToToc(item)"
                >
                  {{ item.text }}
                </li>
              </ul>
            </aside>
          </div>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import FileTree from '../editor/FileTree.vue'
import { getProjectFileTree, getProjectFileContent } from '../../api/project.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  project: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const dialogTitle = computed(() => {
  const name = props.project?.name || '知识库'
  return `📚 ${name}`
})

// Configure marked: GitHub-flavored breaks, no raw HTML pass-through.
marked.setOptions({
  gfm: true,
  breaks: false,
})

// Resolve a Markdown image/link reference (which may be relative) against the
// directory of the file currently being rendered, then point it at the raw
// asset endpoint so <img> tags load real bytes from the project's local_path.
//
// Absolute URLs (http/https/data) and anchors are left untouched.
function rewriteAssetUrl(src, baseDir, projectId) {
  if (!src) return src
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(src)) return src
  // Strip leading ./ and any leading slash so we always join relatively.
  let cleaned = src.replace(/^\.\//, '').replace(/^\/+/, '')
  // Drop URL fragments / query strings — the backend serves the raw file as-is.
  const hashIdx = cleaned.search(/[?#]/)
  if (hashIdx >= 0) cleaned = cleaned.slice(0, hashIdx)
  // Resolve relative segments against baseDir.
  const stack = []
  const baseSegments = baseDir ? baseDir.split('/').filter(Boolean) : []
  stack.push(...baseSegments)
  for (const seg of cleaned.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      stack.pop()
      continue
    }
    stack.push(seg)
  }
  if (!stack.length || !projectId) return src
  const encoded = stack.map(encodeURIComponent).join('/')
  return `/api/projects/${projectId}/raw/${encoded}`
}

// Resolve a relative doc-link href to an in-repo path (without rewriting it
// to the raw endpoint). Used to mark internal Markdown-to-Markdown links so
// the click handler can intercept them and navigate inside the dialog.
// Returns null when the link is external / anchor / mailto.
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
  const stack = []
  const baseSegments = baseDir ? baseDir.split('/').filter(Boolean) : []
  stack.push(...baseSegments)
  for (const seg of cleaned.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      stack.pop()
      continue
    }
    stack.push(seg)
  }
  if (!stack.length) return null
  return { path: stack.join('/'), hash: trailing.startsWith('#') ? trailing : '' }
}

// GitHub-style slug for ToC anchors. Not perfect but matches the common case.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function renderMarkdown(content, baseDir) {
  if (!content) return ''
  const projectId = props.project?.id
  const renderer = new marked.Renderer()
  const headingSlugCounts = new Map()

  // marked v17 uses object-form arguments for image/link renderers.
  // Fall back to positional for older majors so this works in either case.
  const origImage = renderer.image.bind(renderer)
  renderer.image = (hrefOrToken, title, text) => {
    if (hrefOrToken && typeof hrefOrToken === 'object') {
      const token = { ...hrefOrToken, href: rewriteAssetUrl(hrefOrToken.href, baseDir, projectId) }
      return origImage(token)
    }
    return origImage(rewriteAssetUrl(hrefOrToken, baseDir, projectId), title, text)
  }
  // Custom link renderer: tag relative md/dir links with data-doc-link so the
  // click handler can intercept them, asset links go through rewriteAssetUrl,
  // external links open in a new tab.
  renderer.link = (hrefOrToken, title, text) => {
    let href, linkTitle, linkText
    if (hrefOrToken && typeof hrefOrToken === 'object') {
      href = hrefOrToken.href || ''
      linkTitle = hrefOrToken.title
      linkText = hrefOrToken.text != null ? hrefOrToken.text : ''
    } else {
      href = hrefOrToken
      linkTitle = title
      linkText = text != null ? text : ''
    }
    const escapedTitle = linkTitle ? ` title="${String(linkTitle).replace(/"/g, '&quot;')}"` : ''
    if (/^(https?:)/i.test(href)) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${escapedTitle}>${linkText}</a>`
    }
    if (href.startsWith('#')) {
      return `<a href="${href}"${escapedTitle}>${linkText}</a>`
    }
    if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|pdf)(?:[?#]|$)/i.test(href)) {
      const next = rewriteAssetUrl(href, baseDir, projectId)
      return `<a href="${next}" target="_blank" rel="noopener noreferrer"${escapedTitle}>${linkText}</a>`
    }
    const resolved = resolveDocPath(href, baseDir)
    if (!resolved) {
      return `<a href="${href}"${escapedTitle}>${linkText}</a>`
    }
    const dataPath = String(resolved.path).replace(/"/g, '&quot;')
    const dataHash = resolved.hash ? ` data-doc-hash="${String(resolved.hash).replace(/"/g, '&quot;')}"` : ''
    return `<a href="javascript:void(0)" data-doc-link="${dataPath}"${dataHash}${escapedTitle} class="krd-doc-link">${linkText}</a>`
  }
  // Heading renderer: emit slug ids so ToC clicks can scroll to them.
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

  try {
    return marked.parse(content, { renderer })
  } catch {
    return ''
  }
}

// Extract a ToC from raw markdown. Uses marked's lexer so we don't have to
// re-implement heading detection (handles ATX/setext, ignores headings inside
// code blocks). Slugs must match what renderMarkdown emits.
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

// Walk the loaded file tree to verify a path exists before we navigate to it.
// Avoids "broken link" UX where the user clicks and gets a 404 toast.
function fileExistsInTree(treeRoot, relPath) {
  if (!treeRoot || !relPath) return false
  let exists = false
  const walk = (node) => {
    if (!node || exists) return
    if (node.type === 'file' && node.path === relPath) {
      exists = true
      return
    }
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  walk(treeRoot)
  return exists
}

const tree = ref(null)
const treeLoading = ref(false)
const treeError = ref('')

const currentPath = ref('')
const fileContent = ref('')
const fileLoading = ref(false)
const fileError = ref('')
const fileIsBinary = ref(false)
const fileSize = ref(0)

const readmeContent = ref('')
const readmeLoading = ref(false)

const fileMeta = computed(() => {
  if (fileIsBinary.value) return 'binary'
  if (!fileSize.value) return ''
  if (fileSize.value < 1024) return `${fileSize.value} B`
  if (fileSize.value < 1024 * 1024) return `${(fileSize.value / 1024).toFixed(1)} KB`
  return `${(fileSize.value / 1024 / 1024).toFixed(1)} MB`
})

function isMarkdown(path) {
  if (!path) return false
  const lower = path.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

function fileIcon(name) {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return '📖'
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return '⚙️'
  if (lower.endsWith('.txt')) return '📄'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg')) return '🖼️'
  return '📄'
}

const renderedMarkdown = computed(() => {
  if (!fileContent.value) return ''
  // Resolve relative assets against the file's own directory.
  const dir = currentPath.value.includes('/')
    ? currentPath.value.slice(0, currentPath.value.lastIndexOf('/'))
    : ''
  return renderMarkdown(fileContent.value, dir)
})

const readmeHtml = computed(() => {
  // README sits at repo root, so its relative assets resolve from ''.
  return renderMarkdown(readmeContent.value, '')
})

// ToC: only show when there are at least 3 headings, otherwise it's noise.
const fileToc = computed(() => {
  if (!fileContent.value || !isMarkdown(currentPath.value)) return []
  const items = extractToc(fileContent.value)
  return items.length >= 3 ? items : []
})
const readmeToc = computed(() => {
  if (!readmeContent.value) return []
  const items = extractToc(readmeContent.value)
  return items.length >= 3 ? items : []
})

const fileBodyRef = ref(null)
const overviewRef = ref(null)

// Intercept clicks inside any v-html markdown block. Two cases:
//   1. data-doc-link → relative md/dir link inside the repo. Navigate inside
//      the dialog instead of letting the browser hit a dead URL.
//   2. plain anchor (#id) → let the browser handle it (smooth scroll via CSS).
// External http(s) links already have target=_blank from renderer.link.
function handleMarkdownClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor) return
  const docPath = anchor.getAttribute('data-doc-link')
  if (!docPath) return
  event.preventDefault()
  const hash = anchor.getAttribute('data-doc-hash') || ''
  if (!fileExistsInTree(tree.value, docPath)) {
    ElMessage.warning(`知识库内未找到文件：${docPath}`)
    return
  }
  handleFileSelect(docPath, hash)
}

async function scrollToHash(hash, root) {
  if (!hash || !root) return
  const id = hash.startsWith('#') ? hash.slice(1) : hash
  if (!id) return
  await nextTick()
  const el = root.querySelector(`#${CSS.escape(id)}`)
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function scrollToToc(item) {
  const root = currentPath.value ? fileBodyRef.value : overviewRef.value
  scrollToHash(`#${item.id}`, root)
}

const topLevel = computed(() => Array.isArray(tree.value?.children) ? tree.value.children : [])
const hasFiles = computed(() => topLevel.value.length > 0)

const totalFiles = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'file') count += 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  topLevel.value.forEach(walk)
  return count
})

const totalDirs = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'directory') count += 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  topLevel.value.forEach(walk)
  return count
})

const markdownCount = computed(() => {
  let count = 0
  const walk = (node) => {
    if (!node) return
    if (node.type === 'file' && isMarkdown(node.path)) count += 1
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  topLevel.value.forEach(walk)
  return count
})

const topDirs = computed(() => {
  return topLevel.value
    .filter(n => n.type === 'directory')
    .map(dir => {
      let fileCount = 0
      let firstFilePath = ''
      const walk = (node) => {
        if (!node) return
        if (node.type === 'file') {
          fileCount += 1
          if (!firstFilePath) firstFilePath = node.path
        }
        if (Array.isArray(node.children)) node.children.forEach(walk)
      }
      walk(dir)
      return {
        name: dir.name,
        path: dir.path,
        fileCount,
        firstFilePath,
      }
    })
})

const topFiles = computed(() =>
  topLevel.value
    .filter(n => n.type === 'file')
    .map(n => ({ name: n.name, path: n.path }))
)

async function loadTree() {
  if (!props.project?.id) return
  treeLoading.value = true
  treeError.value = ''
  try {
    const resp = await getProjectFileTree(props.project.id)
    if (resp?.success) {
      tree.value = resp.data
      await loadReadme()
    } else {
      treeError.value = resp?.message || '加载失败'
      tree.value = null
    }
  } catch (e) {
    treeError.value = e?.message || '加载失败'
    tree.value = null
  } finally {
    treeLoading.value = false
  }
}

async function loadReadme() {
  readmeContent.value = ''
  const candidate = topLevel.value.find(n => {
    if (n.type !== 'file') return false
    const name = (n.name || '').toLowerCase()
    return name === 'readme.md' || name === 'readme.markdown' || name === 'readme'
  })
  if (!candidate) return
  readmeLoading.value = true
  try {
    const resp = await getProjectFileContent(props.project.id, candidate.path)
    if (resp?.success && !resp.data?.isBinary) {
      readmeContent.value = resp.data?.content || ''
    }
  } catch {
    // silently ignore — overview will fall back to "no README" hint
  } finally {
    readmeLoading.value = false
  }
}

async function handleFileSelect(filePath, hash = '') {
  if (!filePath) return
  currentPath.value = filePath
  fileLoading.value = true
  fileError.value = ''
  fileIsBinary.value = false
  fileContent.value = ''
  fileSize.value = 0
  try {
    const resp = await getProjectFileContent(props.project.id, filePath)
    if (resp?.success) {
      fileIsBinary.value = !!resp.data?.isBinary
      fileSize.value = resp.data?.size || 0
      fileContent.value = resp.data?.content || ''
      if (hash && fileBodyRef.value) {
        await scrollToHash(hash, fileBodyRef.value)
      } else if (fileBodyRef.value) {
        // Reset scroll when navigating to a fresh doc.
        fileBodyRef.value.scrollTop = 0
      }
    } else {
      fileError.value = resp?.message || '读取失败'
    }
  } catch (e) {
    fileError.value = e?.message || '读取失败'
  } finally {
    fileLoading.value = false
  }
}

function goOverview() {
  currentPath.value = ''
  fileContent.value = ''
  fileError.value = ''
  fileIsBinary.value = false
  fileSize.value = 0
}

function reset() {
  tree.value = null
  treeError.value = ''
  currentPath.value = ''
  fileContent.value = ''
  fileError.value = ''
  fileIsBinary.value = false
  fileSize.value = 0
  readmeContent.value = ''
}

watch(
  () => [props.modelValue, props.project?.id],
  ([open, id]) => {
    if (open && id) {
      reset()
      loadTree()
    }
  },
)
</script>

<style scoped>
.krd-body {
  display: flex;
  height: 70vh;
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}

.krd-sidebar {
  width: 300px;
  min-width: 240px;
  border-right: 1px solid var(--border-color, #e4e7ed);
  background: #fafafa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.krd-sidebar-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color, #e4e7ed);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f5f7fa;
}

.krd-overview-btn {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(230, 162, 60, 0.4);
  background: rgba(255, 250, 240, 0.8);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #b8821b;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.krd-overview-btn:hover {
  background: rgba(230, 162, 60, 0.18);
}

.krd-overview-btn.is-active {
  background: #e6a23c;
  color: #fff;
  border-color: #e6a23c;
}

.krd-path-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.krd-path-value {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.krd-tree-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
}

.krd-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.krd-file-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #e4e7ed);
  background: #f5f7fa;
  display: flex;
  align-items: center;
  gap: 12px;
}

.krd-back-btn {
  border: 1px solid var(--border-color, #e4e7ed);
  background: #fff;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  flex-shrink: 0;
}

.krd-back-btn:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}

.krd-file-path {
  flex: 1;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.krd-file-meta {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}

.krd-file-content-wrap {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.krd-file-content {
  flex: 1;
  overflow: auto;
  scroll-behavior: smooth;
}

.krd-pre {
  margin: 0;
  padding: 14px 18px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}

.krd-markdown {
  padding: 24px 32px;
}

/* TOC */
.krd-toc {
  width: 220px;
  min-width: 180px;
  max-width: 240px;
  border-left: 1px solid var(--border-color, #e4e7ed);
  background: #fafbfc;
  padding: 16px 14px;
  overflow-y: auto;
  font-size: 12px;
}

.krd-toc--side {
  flex-shrink: 0;
}

.krd-toc-title {
  font-size: 11px;
  font-weight: 700;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.krd-toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.krd-toc-item {
  padding: 4px 8px;
  margin-bottom: 2px;
  cursor: pointer;
  color: #606266;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.krd-toc-item:hover {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.08);
  border-left-color: #e6a23c;
}

.krd-toc-l1 { padding-left: 8px; font-weight: 600; color: #303133; }
.krd-toc-l2 { padding-left: 18px; }
.krd-toc-l3 { padding-left: 28px; font-size: 11px; color: #909399; }

/* Overview README + side TOC layout */
.krd-overview-readme-wrap {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: flex-start;
}

.krd-overview-readme-wrap .krd-overview-readme {
  flex: 1;
  margin-bottom: 0;
}

.krd-overview-readme-wrap .krd-toc {
  border-left: 1px solid var(--border-color, #e4e7ed);
  border-radius: 6px;
  background: #fafbfc;
  position: sticky;
  top: 0;
  align-self: flex-start;
}

/* Overview */
.krd-overview {
  padding: 28px 36px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

.krd-overview-meta {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color, #e4e7ed);
}

.krd-overview-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.krd-overview-icon {
  font-size: 24px;
}

.krd-overview-title h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.krd-overview-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.krd-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.krd-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #e6a23c;
  line-height: 1;
}

.krd-stat-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.krd-overview-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.krd-overview-readme {
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fafbfc;
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
}

.krd-overview-readme--empty {
  color: #909399;
  font-size: 13px;
  font-style: italic;
  padding: 16px 24px;
}

.krd-overview-dirs,
.krd-overview-files {
  margin-bottom: 24px;
}

.krd-overview-dirs h3,
.krd-overview-files h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.krd-dir-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.krd-dir-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
  cursor: pointer;
  background: #fff;
  transition: all 0.15s ease;
}

.krd-dir-item:hover {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.06);
  transform: translateY(-1px);
}

.krd-dir-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.krd-dir-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.krd-dir-count {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}

.krd-file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.krd-file-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.krd-file-list-item:hover {
  background: rgba(230, 162, 60, 0.08);
}

.krd-file-icon {
  flex-shrink: 0;
}

.krd-file-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.krd-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.krd-hint {
  padding: 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.krd-hint--error {
  color: var(--el-color-danger);
}
</style>

<style>
.knowledge-repo-dialog .el-dialog__body {
  padding: 0 20px 20px;
}

/* Markdown body styles — applied via deep selector for v-html content */
.knowledge-repo-dialog .markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
}

.knowledge-repo-dialog .markdown-body h1,
.knowledge-repo-dialog .markdown-body h2,
.knowledge-repo-dialog .markdown-body h3,
.knowledge-repo-dialog .markdown-body h4,
.knowledge-repo-dialog .markdown-body h5,
.knowledge-repo-dialog .markdown-body h6 {
  margin: 1.5em 0 0.6em;
  font-weight: 700;
  color: #1f2329;
  line-height: 1.3;
}

.knowledge-repo-dialog .markdown-body h1 {
  font-size: 1.8em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.knowledge-repo-dialog .markdown-body h2 {
  font-size: 1.4em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.knowledge-repo-dialog .markdown-body h3 { font-size: 1.2em; }
.knowledge-repo-dialog .markdown-body h4 { font-size: 1.05em; }

.knowledge-repo-dialog .markdown-body p {
  margin: 0.6em 0;
}

.knowledge-repo-dialog .markdown-body a {
  color: #409eff;
  text-decoration: none;
}

.knowledge-repo-dialog .markdown-body a:hover {
  text-decoration: underline;
}

.knowledge-repo-dialog .markdown-body ul,
.knowledge-repo-dialog .markdown-body ol {
  padding-left: 1.8em;
  margin: 0.6em 0;
}

.knowledge-repo-dialog .markdown-body li {
  margin: 0.3em 0;
}

.knowledge-repo-dialog .markdown-body blockquote {
  margin: 0.8em 0;
  padding: 0.4em 1em;
  border-left: 4px solid #dfe2e5;
  background: #fafbfc;
  color: #6a737d;
}

.knowledge-repo-dialog .markdown-body code {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  background: rgba(27, 31, 35, 0.06);
  border-radius: 3px;
}

.knowledge-repo-dialog .markdown-body pre {
  margin: 0.8em 0;
  padding: 14px 16px;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.knowledge-repo-dialog .markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: inherit;
}

.knowledge-repo-dialog .markdown-body table {
  border-collapse: collapse;
  margin: 0.8em 0;
  width: 100%;
}

.knowledge-repo-dialog .markdown-body th,
.knowledge-repo-dialog .markdown-body td {
  border: 1px solid #dfe2e5;
  padding: 8px 12px;
  text-align: left;
}

.knowledge-repo-dialog .markdown-body th {
  background: #f6f8fa;
  font-weight: 600;
}

.knowledge-repo-dialog .markdown-body hr {
  border: none;
  border-top: 1px solid #eaecef;
  margin: 1.2em 0;
}

.knowledge-repo-dialog .markdown-body img {
  max-width: 100%;
  height: auto;
}

/* In-repo doc link — visually distinct from external links so users know
   these stay inside the dialog instead of hitting the browser. */
.knowledge-repo-dialog .markdown-body a.krd-doc-link {
  color: #b8821b;
  border-bottom: 1px dashed rgba(230, 162, 60, 0.5);
  padding-bottom: 1px;
}

.knowledge-repo-dialog .markdown-body a.krd-doc-link:hover {
  color: #e6a23c;
  border-bottom-color: #e6a23c;
  text-decoration: none;
}
</style>
