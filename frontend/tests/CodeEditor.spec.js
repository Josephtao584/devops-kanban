import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodeEditor from '../src/components/editor/CodeEditor.vue'

const mockStore = vi.hoisted(() => ({
  getFileTree: vi.fn().mockResolvedValue({ success: true, data: null }),
  readFileContent: vi.fn(),
  writeFileContent: vi.fn(),
  getUncommittedChanges: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getDiff: vi.fn(),
  commit: vi.fn(),
  stageFiles: vi.fn(),
  loading: { value: false },
  error: { value: null }
}))

vi.mock('../src/stores/gitStore', () => ({
  useGitStore: () => mockStore,
  getUncommittedChanges: mockStore.getUncommittedChanges,
  getDiff: mockStore.getDiff,
  readFileContent: mockStore.readFileContent,
  writeFileContent: mockStore.writeFileContent,
  commit: mockStore.commit,
  getFileTree: mockStore.getFileTree
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
    mountEditor()
    await vi.dynamicImportSettled()
    expect(mockStore.getUncommittedChanges).toHaveBeenCalledWith(1, 1)
  })

  it('switches to changes tab and loads changes', async () => {
    mockStore.getUncommittedChanges.mockResolvedValue({
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

    expect(mockStore.getUncommittedChanges).toHaveBeenCalledWith(1, 1)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('src/app.ts')
  })

  it('shows diff preview when diff button is clicked', async () => {
    mockStore.getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    mockStore.readFileContent.mockImplementation((projectId, taskId, filePath, options) => {
      if (options?.version === 'head') {
        return Promise.resolve({ success: true, data: { content: 'old line', isBinary: false, size: 9 } })
      }
      return Promise.resolve({ success: true, data: { content: 'new line', isBinary: false, size: 9 } })
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()

    const diffBtn = wrapper.find('.change-diff-btn')
    expect(diffBtn.exists()).toBe(true)
    await diffBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.diff-view').exists()).toBe(true)
    expect(mockStore.readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts')
    expect(mockStore.readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts', { version: 'head' })
  })

  it('closes diff view when close button clicked', async () => {
    mockStore.getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    mockStore.readFileContent.mockImplementation((_p, _t, _f, options) => {
      const content = options?.version === 'head' ? 'old' : 'new'
      return Promise.resolve({ success: true, data: { content, isBinary: false, size: 3 } })
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('.change-diff-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.diff-view').exists()).toBe(true)

    await wrapper.find('.diff-close').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.diff-view').exists()).toBe(false)
  })

  it('opens file for editing when change path is clicked', async () => {
    mockStore.getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    mockStore.readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    const changesTab = wrapper.findAll('.sidebar-tab').find(b => b.text().includes('变更'))
    await changesTab.trigger('click')
    await wrapper.vm.$nextTick()

    const changePath = wrapper.find('.change-path')
    await changePath.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockStore.readFileContent).toHaveBeenCalledWith(1, 1, 'src/app.ts')
  })

  it('commits and clears state on success', async () => {
    mockStore.getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'src/app.ts', status: 'modified' }],
    })
    mockStore.commit.mockResolvedValue({ success: true })

    const wrapper = mountEditor()
    await flushPromises()

    const commitHeader = wrapper.find('.commit-header')
    expect(commitHeader.exists()).toBe(true)

    const input = wrapper.find('.commit-input')
    expect(input.exists()).toBe(true)
    await input.setValue('fix: update app')
    await wrapper.vm.$nextTick()

    const commitBtn = wrapper.find('.commit-btn')
    await commitBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockStore.commit).toHaveBeenCalledWith(1, 1, {
      message: 'fix: update app',
      addAll: false,
      files: ['src/app.ts'],
    })
  })

  it('save triggers loadChanges and shows commit area', async () => {
    mockStore.readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })
    mockStore.writeFileContent.mockResolvedValue({ success: true })
    mockStore.getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [{ path: 'test.ts', status: 'modified' }],
    })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    wrapper.vm.openFile('test.ts')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    await wrapper.vm.saveFile()
    await wrapper.vm.$nextTick()

    expect(mockStore.writeFileContent).toHaveBeenCalled()
    expect(mockStore.getUncommittedChanges).toHaveBeenCalled()
  })

  it('shows error message on save failure', async () => {
    mockStore.readFileContent.mockResolvedValue({
      success: true,
      data: { content: 'hello', isBinary: false, size: 5 },
    })
    mockStore.writeFileContent.mockResolvedValue({ success: false, message: 'Disk full' })

    const wrapper = mountEditor()
    await vi.dynamicImportSettled()
    wrapper.vm.openFile('test.ts')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    wrapper.vm.unsavedFileSet.add('test.ts')
    await wrapper.vm.saveFile()
    await wrapper.vm.$nextTick()

    expect(mockStore.writeFileContent).toHaveBeenCalled()
    expect(wrapper.vm.unsavedFileSet.has('test.ts')).toBe(true)
  })

  it('tracks recent files with dedup and max 10', async () => {
    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    for (let i = 1; i <= 12; i++) {
      wrapper.vm.addToRecent(`file${i}.ts`)
    }
    await wrapper.vm.$nextTick()

    const recent = wrapper.vm.recentFiles
    expect(recent.length).toBe(10)
    expect(recent[0]).toBe('file12.ts')
    expect(recent).not.toContain('file1.ts')
    expect(recent).not.toContain('file2.ts')
  })

  it('deduplicates recent files and moves to front', async () => {
    const wrapper = mountEditor()
    await vi.dynamicImportSettled()

    wrapper.vm.addToRecent('a.ts')
    wrapper.vm.addToRecent('b.ts')
    wrapper.vm.addToRecent('a.ts')
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
