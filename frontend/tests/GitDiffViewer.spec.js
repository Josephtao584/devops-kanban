import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import GitDiffViewer from '../src/components/GitDiffViewer.vue'

const ElCheckboxStub = defineComponent({
  name: 'ElCheckboxStub',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('input', {
      class: 'el-checkbox-stub',
      type: 'checkbox',
      checked: props.modelValue,
      onChange: () => emit('change')
    })
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () => h('button', {
      class: 'el-button-stub',
      onClick: () => emit('click')
    }, slots.default?.())
  }
})

const ElScrollbarStub = defineComponent({
  name: 'ElScrollbarStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-scrollbar-stub' }, slots.default?.())
  }
})

const ElEmptyStub = defineComponent({
  name: 'ElEmptyStub',
  props: {
    description: { type: String, default: '' }
  },
  setup(props) {
    return () => h('div', { class: 'el-empty-stub' }, props.description)
  }
})

const ElTagStub = defineComponent({
  name: 'ElTagStub',
  props: {
    type: { type: String, default: '' }
  },
  setup(props, { slots }) {
    return () => h('span', { class: ['el-tag-stub', props.type] }, slots.default?.())
  }
})

const ElIconStub = defineComponent({
  name: 'ElIconStub',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-icon-stub' }, slots.default?.())
  }
})

describe('GitDiffViewer', () => {
  it('renders commit-mode controls and emits file selection events', async () => {
    const wrapper = mount(GitDiffViewer, {
      props: {
        fileItems: [
          {
            path: 'docs/guide.md',
            displayName: 'guide.md',
            status: 'modified',
            additions: 3,
            deletions: 1,
            selected: true
          }
        ],
        diffsByPath: {
          'docs/guide.md': '@@ -1,1 +1,2 @@\n-old\n+new'
        },
        loading: false,
        selectedFilePath: 'docs/guide.md',
        selectable: true,
        title: '代码差异'
      },
      global: {
        stubs: {
          'el-checkbox': ElCheckboxStub,
          'el-button': ElButtonStub,
          'el-scrollbar': ElScrollbarStub,
          'el-empty': ElEmptyStub,
          'el-tag': ElTagStub,
          'el-icon': ElIconStub
        }
      }
    })

    expect(wrapper.find('.file-panel').exists()).toBe(true)
    expect(wrapper.find('.diff-panel').exists()).toBe(true)
    expect(wrapper.find('.file-actions').exists()).toBe(true)
    expect(wrapper.find('.el-checkbox-stub').exists()).toBe(true)

    await wrapper.find('.file-item').trigger('click')
    expect(wrapper.emitted('update:selectedFilePath')).toEqual([['docs/guide.md']])
  })

  it('hides commit-only controls and never emits multi-select events in read-only mode', async () => {
    const wrapper = mount(GitDiffViewer, {
      props: {
        fileItems: [
          {
            path: 'main.py',
            displayName: 'main.py',
            status: 'untracked',
            additions: 5,
            deletions: 0
          }
        ],
        diffsByPath: {
          'main.py': '@@ -0,0 +1,1 @@\n+print("hi")'
        },
        loading: false,
        selectedFilePath: 'main.py',
        selectable: false,
        title: '代码差异'
      },
      global: {
        stubs: {
          'el-checkbox': ElCheckboxStub,
          'el-button': ElButtonStub,
          'el-scrollbar': ElScrollbarStub,
          'el-empty': ElEmptyStub,
          'el-tag': ElTagStub,
          'el-icon': ElIconStub
        }
      }
    })

    expect(wrapper.find('.file-actions').exists()).toBe(false)
    expect(wrapper.find('.el-checkbox-stub').exists()).toBe(false)
    expect(wrapper.find('.file-item').classes()).toContain('active')
    expect(wrapper.emitted('toggle-file')).toBeFalsy()
    expect(wrapper.emitted('select-all')).toBeFalsy()
    expect(wrapper.emitted('deselect-all')).toBeFalsy()
  })

  it('renders diff headers separately from additions and maps statuses to visual tag types', () => {
    const wrapper = mount(GitDiffViewer, {
      props: {
        fileItems: [
          {
            path: 'main.py',
            displayName: 'main.py',
            status: 'deleted',
            additions: 0,
            deletions: 1,
            selected: true
          },
          {
            path: 'new.py',
            displayName: 'new.py',
            status: 'untracked',
            additions: 1,
            deletions: 0,
            selected: false
          }
        ],
        diffsByPath: {
          'main.py': '--- a/main.py\n+++ b/main.py\n@@ -1,1 +0,0 @@\n-old line'
        },
        loading: false,
        selectedFilePath: 'main.py',
        selectable: true,
        title: '代码差异'
      },
      global: {
        stubs: {
          'el-checkbox': ElCheckboxStub,
          'el-button': ElButtonStub,
          'el-scrollbar': ElScrollbarStub,
          'el-empty': ElEmptyStub,
          'el-tag': ElTagStub,
          'el-icon': ElIconStub
        }
      }
    })

    const tagTypes = wrapper.findAll('.el-tag-stub').map(node => node.classes())
    expect(tagTypes.some(classes => classes.includes('danger'))).toBe(true)
    expect(tagTypes.some(classes => classes.includes('success'))).toBe(true)

    const lines = wrapper.findAll('.diff-line')
    expect(lines[0].classes()).toContain('header')
    expect(lines[1].classes()).toContain('header')
    expect(lines[2].classes()).toContain('hunk')
    expect(lines[3].classes()).toContain('deletion')
  })
})

