import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodeEditor from '../src/components/editor/CodeEditor.vue'

vi.mock('../src/api/git', () => ({
  getFileTree: vi.fn().mockResolvedValue({ success: true, data: null }),
  readFileContent: vi.fn(),
  writeFileContent: vi.fn(),
  getUncommittedChanges: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getDiff: vi.fn(),
  commit: vi.fn(),
}))

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const mountEditor = (props = {}) =>
  mount(CodeEditor, {
    props: { projectId: 1, taskId: 1, taskTitle: 'Test Task', ...props },
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })

describe('CodeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct title', () => {
    const wrapper = mountEditor({ taskTitle: 'Fix bug' })
    expect(wrapper.text()).toContain('Fix bug')
  })

  it('emits close when close button clicked', async () => {
    const wrapper = mountEditor()
    const closeBtn = wrapper.find('.editor-close')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('closes on Escape key', async () => {
    const wrapper = mountEditor()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('calls getUncommittedChanges on mount', async () => {
    const { getUncommittedChanges } = await import('../src/api/git')
    mountEditor()
    await vi.dynamicImportSettled()
    // onMounted calls loadChanges
    expect(getUncommittedChanges).toHaveBeenCalledWith(1, 1)
  })

  it('switches to changes tab and loads changes', async () => {
    const { getUncommittedChanges } = await import('../src/api/git')
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [
        { path: 'src/app.ts', status: 'modified' },
        { path: 'src/new.ts', status: 'added' },
      ],
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()
    vi.clearAllMocks()

    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    expect(changesTab).toBeTruthy()
    await changesTab.trigger('click')

    expect(getUncommittedChanges).toHaveBeenCalledWith(1, 1)
    await wrapper.vm.$nextTick()
    // After resolving, changed files should render
    expect(wrapper.text()).toContain('src/app.ts')
  })

  it('shows diff preview when diff button is clicked', async () => {
    const { getUncommittedChanges, readFileContent } = await import('../src/api/git')
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    readFileContent.mockImplementation((projectId, taskId, filePath, options) => {
      if (options?.version === 'head') {
        return Promise.resolve({ success: true, data: { content: 'old line', isBinary: false, size: 9 } })
      }
      return Promise.resolve({ success: true, data: { content: 'new line', isBinary: false, size: 9 } })
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    // Switch to changes tab
    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()

    // Click the diff button
    const diffBtn = wrapper.find('.change-diff-btn')
    expect(diffBtn.exists()).toBe(true)
    await diffBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Diff view should appear and readFileContent called for both versions
    expect(wrapper.find('.diff-view').exists()).toBe(true)
    expect(readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts')
    expect(readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts', { version: 'head' })
  })

  it('closes diff view when close button clicked', async () => {
    const { getUncommittedChanges, readFileContent } = await import('../src/api/git')
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    readFileContent.mockImplementation((_p, _t, _f, options) => {
      const content = options?.version === 'head' ? 'old' : 'new'
      return Promise.resolve({ success: true, data: { content, isBinary: false, size: 3 } })
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    // Open diff view via diff button
    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('.change-diff-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.diff-view').exists()).toBe(true)

    // Close it
    await wrapper.find('.diff-close').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.diff-view').exists()).toBe(false)
  })

  it('opens file for editing when change path is clicked', async () => {
    const { getUncommittedChanges, readFileContent } = await import('../src/api/git')
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()

    // Click the file path to open for editing
    const changePath = wrapper.find('.change-path')
    await changePath.trigger('click')
    await wrapper.vm.$nextTick()

    expect(readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts')
  })

  it('commits and clears state on success', async () => {
    const { getUncommittedChanges, commit } = await import('../src/api/git')
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    commit.mockResolvedValue({ success: true })

    const wrapper = mountEditor()
    await flushPromises()

    // The commit area should be visible since changedFiles has entries
    const commitHeader = wrapper.find('.commit-header')
    expect(commitHeader.exists()).toBe(true)

    // Type commit message and submit
    const input = wrapper.find('.commit-input')
    expect(input.exists()).toBe(true)
    await input.setValue('fix: update app')
    await wrapper.vm.$nextTick()

    const commitBtn = wrapper.find('.commit-btn')
    await commitBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(commit).toHaveBeenCalledWith(1, 1, {
      message: 'fix: update app',
      addAll: false,
      files: ['src/app.ts'],
    })
  })

  it('save triggers loadChanges and shows commit area', async () => {
    const { readFileContent, writeFileContent, getUncommittedChanges } = await import('../src/api/git')
    readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })
    writeFileContent.mockResolvedValue({ success: true })
    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'test.ts', status: 'modified' }],
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    // Simulate opening a file
    wrapper.vm.openFile('test.ts')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    // Simulate save
    await wrapper.vm.saveFile()
    await wrapper.vm.$nextTick()

    expect(writeFileContent).toHaveBeenCalled()
    expect(getUncommittedChanges).toHaveBeenCalled()
  })

  it('shows error message on save failure', async () => {
    const { readFileContent, writeFileContent } = await import('../src/api/git')
    readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })
    writeFileContent.mockResolvedValue({ success: false, message: 'Disk full' })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()
    wrapper.vm.openFile('test.ts')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    // Mark file as having unsaved changes (normally done by CodeMirror docChanged)
    wrapper.vm.unsavedFileSet.add('test.ts')
    await wrapper.vm.saveFile()
    await wrapper.vm.$nextTick()

    // writeFileContent was called but file stays unsaved
    expect(writeFileContent).toHaveBeenCalled()
    expect(wrapper.vm.unsavedFileSet.has('test.ts')).toBe(true)
  })

  it('tracks recent files with dedup and max 10', async () => {
    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    // Add 12 files
    for (let i = 1; i <= 12; i++) {
      wrapper.vm.addToRecent(`file${i}.ts`)
    }
    await wrapper.vm.$nextTick()

    const recent = wrapper.vm.recentFiles
    expect(recent.length).toBe(10)
    // Most recent should be first
    expect(recent[0]).toBe('file12.ts')
    // file1 and file2 should be evicted
    expect(recent).not.toContain('file1.ts')
    expect(recent).not.toContain('file2.ts')
  })

  it('deduplicates recent files and moves to front', async () => {
    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    wrapper.vm.addToRecent('a.ts')
    wrapper.vm.addToRecent('b.ts')
    wrapper.vm.addToRecent('a.ts') // re-open a
    await wrapper.vm.$nextTick()

    const recent = wrapper.vm.recentFiles
    expect(recent).toEqual(['a.ts', 'b.ts'])
  })

  it('filters recent files by search query', async () => {
    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    wrapper.vm.addToRecent('src/app.ts')
    wrapper.vm.addToRecent('src/utils.ts')
    wrapper.vm.addToRecent('README.md')
    wrapper.vm.searchQuery = 'app'
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.filteredRecentFiles).toEqual(['src/app.ts'])
  })
})
