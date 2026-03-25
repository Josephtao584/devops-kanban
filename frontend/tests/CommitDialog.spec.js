import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CommitDialog from '../src/components/CommitDialog.vue'
import i18n from '../src/locales'

vi.mock('../src/api/git', () => ({
  getUncommittedChanges: vi.fn(),
  getDiff: vi.fn(),
  commit: vi.fn()
}))

import { getUncommittedChanges, getDiff } from '../src/api/git'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('CommitDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getUncommittedChanges.mockResolvedValue({
      success: true,
      data: [
        {
          path: '__pycache__/',
          status: 'untracked'
        }
      ]
    })

    getDiff.mockResolvedValue({
      success: true,
      data: {
        files: [],
        diffs: {}
      }
    })
  })

  it('renders a non-empty filename label for directory-like change paths', async () => {
    const wrapper = mount(CommitDialog, {
      props: {
        projectId: 4,
        taskId: 1,
        currentBranch: 'task/blog_helloworld/1'
      },
      global: {
        plugins: [i18n]
      }
    })

    await flushPromises()

    const fileLabel = wrapper.find('.file-path')
    expect(fileLabel.exists()).toBe(true)
    expect(fileLabel.text()).toBe('__pycache__')
  })
})
