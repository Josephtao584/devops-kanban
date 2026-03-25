import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CommitDialog from '../src/components/CommitDialog.vue'
import GitDiffViewer from '../src/components/GitDiffViewer.vue'
import i18n from '../src/locales'

vi.mock('../src/api/git', () => ({
  getUncommittedChanges: vi.fn(),
  getDiff: vi.fn(),
  commit: vi.fn()
}))

import { getUncommittedChanges, getDiff, commit } from '../src/api/git'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const mountDialog = () => mount(CommitDialog, {
  props: {
    projectId: 4,
    taskId: 1,
    currentBranch: 'task/blog_helloworld/1'
  },
  global: {
    plugins: [i18n]
  }
})

describe('CommitDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [
        {
          path: '__pycache__/main.cpython-312.pyc',
          status: 'untracked'
        },
        {
          path: 'main.py',
          status: 'modified'
        }
      ]
    })

    getDiff.mockResolvedValue({
      success: true,
      data: {
        files: [
          {
            path: '__pycache__/main.cpython-312.pyc',
            status: 'untracked',
            additions: 0,
            deletions: 0
          },
          {
            path: 'main.py',
            status: 'modified',
            additions: 1,
            deletions: 0
          }
        ],
        diffs: {
          '__pycache__/main.cpython-312.pyc': 'diff --git a/__pycache__/main.cpython-312.pyc b/__pycache__/main.cpython-312.pyc',
          'main.py': '@@ -1,1 +1,2 @@\n old\n+new'
        }
      }
    })

    commit.mockResolvedValue({
      success: true,
      data: {}
    })
  })

  it('renders the shared diff viewer with commit controls still visible', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findComponent(GitDiffViewer).exists()).toBe(true)
    expect(wrapper.find('.commit-input').exists()).toBe(true)
    expect(wrapper.find('.commit-actions').exists()).toBe(true)
    expect(wrapper.find('.el-checkbox').exists()).toBe(true)
  })

  it('submits the selected files and commit message from CommitDialog ownership', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('textarea').setValue('test commit message')
    const submitButton = wrapper.findAll('.commit-actions button').find(button => button.text().includes('提交'))
    await submitButton.trigger('click')
    await flushPromises()

    expect(commit).toHaveBeenCalledWith(4, 1, {
      message: 'test commit message',
      addAll: false,
      files: ['__pycache__/main.cpython-312.pyc', 'main.py']
    })
  })

  it('does not re-fetch the whole diff payload when switching between files after initial load', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(getDiff).toHaveBeenCalledTimes(1)

    const fileItems = wrapper.findAll('.file-item')
    await fileItems[1].trigger('click')
    await flushPromises()

    expect(getDiff).toHaveBeenCalledTimes(1)
  })

  it('renders a non-empty filename label for directory-like change paths', async () => {
    getUncommittedChanges.mockResolvedValueOnce({
      success: true,
      data: [
        {
          path: '__pycache__/',
          status: 'untracked'
        }
      ]
    })

    getDiff.mockResolvedValueOnce({
      success: true,
      data: {
        files: [],
        diffs: {}
      }
    })

    const wrapper = mountDialog()
    await flushPromises()

    const fileLabel = wrapper.find('.file-path')
    expect(fileLabel.exists()).toBe(true)
    expect(fileLabel.text()).toBe('__pycache__')
  })
})
