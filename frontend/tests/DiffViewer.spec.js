import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DiffViewer from '../src/components/DiffViewer.vue'

vi.mock('../src/api/git', () => ({
  getDiff: vi.fn()
}))

import { getDiff } from '../src/api/git'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('DiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getDiff.mockResolvedValue({
      success: true,
      data: {
        files: [
          {
            path: 'docs/requirement_design.md',
            status: 'modified',
            additions: 68,
            deletions: 44
          },
          {
            path: 'main.py',
            status: 'modified',
            additions: 0,
            deletions: 0
          },
          {
            path: '__pycache__/main.cpython-312.pyc',
            status: 'untracked',
            additions: 0,
            deletions: 0
          }
        ],
        diffs: {
          'docs/requirement_design.md': '@@ -1,1 +1,1 @@\n-old\n+new'
        }
      }
    })
  })

  it('shows compact top diff stats with Chinese files changed label', async () => {
    const wrapper = mount(DiffViewer, {
      props: {
        projectId: 1,
        taskId: 2,
        targetRef: 'task/blog_helloworld/2'
      }
    })

    await flushPromises()

    const statTags = wrapper.findAll('.diff-stats .el-tag')
    expect(statTags).toHaveLength(3)
    expect(statTags[0].text()).toContain('+68')
    expect(statTags[0].text()).not.toContain('additions')
    expect(statTags[1].text()).toContain('-44')
    expect(statTags[1].text()).not.toContain('deletions')
    expect(statTags[2].text()).toContain('3 个文件变更')
    expect(statTags[2].text()).not.toContain('files changed')
  })
})
