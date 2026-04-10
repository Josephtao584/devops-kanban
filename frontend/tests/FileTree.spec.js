import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FileTree from '../src/components/editor/FileTree.vue'

function mockTreeNode(name, type, children = []) {
  return { name, path: name, type, children }
}

describe('FileTree', () => {
  it('renders file tree with directories and files', () => {
    const tree = mockTreeNode('root', 'directory', [
      mockTreeNode('src', 'directory', [
        mockTreeNode('app.ts', 'file'),
      ]),
      mockTreeNode('README.md', 'file'),
    ])

    const wrapper = mount(FileTree, {
      props: { tree, selectedPath: '' },
    })

    expect(wrapper.text()).toContain('src')
    expect(wrapper.text()).toContain('README.md')
    // app.ts is nested inside src (collapsed), not visible yet
  })

  it('emits file-select when clicking a file', async () => {
    const tree = mockTreeNode('root', 'directory', [
      mockTreeNode('app.ts', 'file'),
    ])

    const wrapper = mount(FileTree, {
      props: { tree, selectedPath: '' },
    })

    const fileItem = wrapper.findAll('.file-tree-item').find((el) => el.text().includes('app.ts'))
    await fileItem?.trigger('click')

    expect(wrapper.emitted('file-select')).toBeTruthy()
    expect(wrapper.emitted('file-select')[0]).toEqual(['app.ts'])
  })

  it('expands directories when clicked', async () => {
    const tree = mockTreeNode('root', 'directory', [
      mockTreeNode('src', 'directory', [
        mockTreeNode('app.ts', 'file'),
      ]),
    ])

    const wrapper = mount(FileTree, {
      props: { tree, selectedPath: '' },
    })

    expect(wrapper.text()).toContain('src')

    const dirItem = wrapper.find('.file-tree-item[data-path="src"]')
    await dirItem.trigger('click')

    expect(wrapper.text()).toContain('app.ts')
  })

  it('marks binary files with indicator', () => {
    const tree = mockTreeNode('root', 'directory', [
      { name: 'image.png', path: 'image.png', type: 'file', isBinary: true },
    ])

    const wrapper = mount(FileTree, {
      props: { tree, selectedPath: '' },
    })

    expect(wrapper.text()).toContain('image.png')
    const binaryItem = wrapper.find('.file-tree-item[data-path="image.png"]')
    expect(binaryItem.classes()).toContain('is-binary')
  })
})
