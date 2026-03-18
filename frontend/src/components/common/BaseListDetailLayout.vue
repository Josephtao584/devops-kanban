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
  padding: 1.5rem;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

/* Utility classes for common patterns */
.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a0aec0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-detail p {
  font-size: 0.875rem;
}

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem;
  color: #718096;
  font-size: 0.875rem;
}
</style>

<!--
Usage Examples:

1. Split Layout (AgentConfig):
<BaseListDetailLayout
  title="Agent Management"
  layout-mode="split"
  :loading="loading"
  :is-empty="agents.length === 0"
  :has-selection="selectedAgent !== null"
>
  <template #header-actions>
    <button @click="openAddForm">+ Add Agent</button>
  </template>
  <template #list-header>
    <h3>Team List</h3>
    <span class="count">{{ agents.length }}</span>
  </template>
  <template #list>
    <div v-for="agent in agents" :key="agent.id" @click="selectAgent(agent)">
      {{ agent.name }}
    </div>
  </template>
  <template #detail>
    <div v-if="selectedAgent">
      <h2>{{ selectedAgent.name }}</h2>
      <!-- Detail content -->
    </div>
    <div v-else class="empty-detail">
      <p>Select an agent</p>
    </div>
  </template>
</BaseListDetailLayout>

2. Grid Layout (TaskSourceConfig):
<BaseListDetailLayout
  title="Task Sources"
  layout-mode="grid"
  :loading="loading"
  :is-empty="sources.length === 0"
>
  <template #header-actions>
    <button @click="openAddForm">+ Add Source</button>
  </template>
  <template #filter>
    <select v-model="selectedProject">
      <option>Select Project</option>
    </select>
  </template>
  <template #list>
    <div v-for="source in sources" :key="source.id" class="source-card">
      <h3>{{ source.name }}</h3>
    </div>
  </template>
</BaseListDetailLayout>

3. With Modal and Toast:
<BaseListDetailLayout ...>
  <!-- Layout content -->

  <template #modal>
    <BaseModal v-model="showForm" title="Add Item">
      <form @submit.prevent="save">
        <!-- Form fields -->
      </form>
    </BaseModal>
  </template>

  <template #toast>
    <BaseToast v-model="toast.show" :message="toast.message" :type="toast.type" />
  </template>
</BaseListDetailLayout>
-->

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.header h1 {
  font-size: 1.5rem;
  color: #2d3748;
  margin: 0;
}

.filter-bar {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

/* Content wrapper - supports multiple layout modes */
.content-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Split layout (AgentConfig) - left-right panels */
.content-wrapper.split {
  display: flex;
  gap: 1rem;
}

.list-panel {
  flex-shrink: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.detail-panel {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Grid layout (TaskSourceConfig) */
.content-wrapper.grid {
  overflow-y: auto;
}

.grid-content {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  padding-bottom: 1rem;
}

/* Single column layout */
.content-wrapper.single {
  overflow-y: auto;
}

.single-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Empty states */
.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a0aec0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-detail p {
  font-size: 0.875rem;
}

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem;
  color: #718096;
  font-size: 0.875rem;
}
</style>
