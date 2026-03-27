<template>
  <div class="base-config-layout">
    <!-- 顶部操作栏 -->
    <div class="header" :class="headerClass">
      <slot name="header">
        <h1>{{ title }}</h1>
        <slot name="header-actions" />
      </slot>
    </div>

    <!-- 可选的筛选/选择器区域 -->
    <div v-if="$slots.filter" class="filter-bar">
      <slot name="filter" />
    </div>

    <!-- 内容区域 -->
    <div class="content-wrapper" :class="layoutMode">
      <!-- 左右分栏模式 (AgentConfig) -->
      <template v-if="layoutMode === 'split'">
        <!-- 左侧：列表面板 -->
        <div class="list-panel" :style="{ width: listPanelWidth }">
          <div v-if="$slots['list-header']" class="panel-header">
            <slot name="list-header" />
          </div>
          <div class="list-content">
            <slot name="list" />
          </div>
        </div>

        <!-- 右侧：详情面板 -->
        <div class="detail-panel">
          <slot name="detail" />
        </div>
      </template>

      <!-- 网格模式 (TaskSourceConfig) -->
      <template v-else-if="layoutMode === 'grid'">
        <div class="grid-content">
          <slot name="list" />
        </div>
      </template>

      <!-- 单列模式 -->
      <template v-else-if="layoutMode === 'single'">
        <div class="single-content">
          <slot name="list" />
        </div>
      </template>
    </div>

    <!-- 弹窗（通过 v-model 控制） -->
    <slot name="modal" />

    <!-- Toast 通知 -->
    <slot name="toast" />
  </div>
</template>

<script setup>
const props = defineProps({
  // 标题
  title: {
    type: String,
    default: ''
  },
  // 自定义头部 class
  headerClass: {
    type: String,
    default: ''
  },
  // 布局模式：'split' (左右分栏), 'grid' (网格), 'single' (单列)
  layoutMode: {
    type: String,
    default: 'split',
    validator: (value) => ['split', 'grid', 'single'].includes(value)
  },
  // 左侧面板宽度
  listPanelWidth: {
    type: String,
    default: '280px'
  },
  // 加载中
  loading: {
    type: Boolean,
    default: false
  },
  // 列表是否为空
  isEmpty: {
    type: Boolean,
    default: false
  },
  // 是否有选中项
  hasSelection: {
    type: Boolean,
    default: false
  }
})

defineEmits([])

// 暴露插槽给父组件使用
defineSlots({
  header: () => {},
  'header-actions': () => {},
  filter: () => {},
  'list-header': () => {},
  list: () => {},
  detail: () => {},
  modal: () => {},
  toast: () => {}
})
</script>

<style scoped>
.base-config-layout {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}

.header h1 {
  margin: 0;
  font-size: var(--font-size-xl);
  line-height: var(--line-height-tight);
  font-weight: 700;
  color: var(--text-primary);
}

.filter-bar {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}

.content-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--page-padding);
  background: var(--bg-secondary);
}

.content-wrapper.split {
  display: flex;
  gap: var(--page-gap);
}

.list-panel,
.detail-panel {
  background: var(--panel-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-height: 0;
}

.list-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
  flex-shrink: 0;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-wrapper.grid,
.content-wrapper.single {
  overflow-y: auto;
}

.grid-content {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--page-gap);
}

.single-content {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--text-secondary);
  background: var(--bg-primary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-detail p,
.empty-list,
.loading-state {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.empty-list,
.loading-state {
  text-align: center;
  padding: 32px 24px;
  color: var(--text-secondary);
}
</style>
