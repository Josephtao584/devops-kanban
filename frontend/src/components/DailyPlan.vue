<template>
  <div class="daily-plan-card" v-if="projectId">
    <!-- 标题栏 -->
    <div class="card-header" @click="toggleExpand">
      <span class="title">今日计划</span>
      <span class="date">{{ formatDate(today) }}</span>
      <span class="summary">
        昨天完成 {{ yesterdayCompleted.length }} 项 · 今天待办 {{ todayTodo.length }} 项
      </span>
      <span class="toggle-text">{{ expanded ? '收起' : '展开' }}</span>
    </div>

    <!-- 展开内容 -->
    <div v-show="expanded" class="card-body">
      <!-- 昨日工作 - 只读 -->
      <div class="section yesterday">
        <div class="section-header">
          <h4>昨天完成</h4>
          <span class="count">{{ yesterdayCompleted.length }} 项</span>
        </div>
        <div class="task-list" v-if="yesterdayCompleted.length">
          <div
            v-for="task in yesterdayCompleted"
            :key="task.id"
            class="task-item done"
            @click="goToTask(task)"
          >
            <span class="task-title">{{ task.title }}</span>
          </div>
        </div>
        <div v-else class="empty-tip">暂无完成的任务</div>
        <!-- 完成总结 -->
        <div class="summary-box" v-if="yesterdaySummary">
          <div class="summary-label">完成总结</div>
          <div class="summary-content">{{ yesterdaySummary }}</div>
        </div>
      </div>

      <!-- 今日计划 -->
      <div class="section today">
        <div class="section-header">
          <h4>今天待办</h4>
          <span class="count">{{ todayTodo.length }} 项</span>
        </div>
        <!-- 计划建议 -->
        <div class="suggestion-box" v-if="todaySuggestion">
          <div class="suggestion-label">计划建议</div>
          <div class="suggestion-content">{{ todaySuggestion }}</div>
        </div>
        <div class="task-list" v-if="todayTodo.length">
          <div
            v-for="task in todayTodo"
            :key="task.id"
            class="task-item"
            @click="goToTask(task)"
          >
            <span class="task-title">{{ task.title }}</span>
            <span class="task-status" :class="getStatusClass(task.status)">
              {{ getStatusLabel(task.status) }}
            </span>
            <!-- Workflow 进度 -->
            <span class="workflow-progress" v-if="getWorkflowProgress(task)">
              {{ getWorkflowProgress(task) }}
            </span>
          </div>
        </div>
        <div v-else class="empty-tip">暂无待办任务</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  projectId: [Number, String],
  tasks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select-task'])

// 状态
const expanded = ref(false)

// 今天的日期
const today = computed(() => new Date())

// 判断日期是否是今天
const isToday = (dateStr) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate()
}

// 昨天完成的任务（status=DONE 且 updatedAt 是今天）
const yesterdayCompleted = computed(() => {
  const realTasks = props.tasks.filter(task =>
    task.status === 'DONE' && isToday(task.updatedAt)
  )

  // 如果没有真实数据，返回 mock 数据
  if (realTasks.length === 0) {
    return [
      { id: 101, title: '完成用户登录接口开发', status: 'DONE' },
      { id: 102, title: '修复首页加载性能问题', status: 'DONE' },
      { id: 103, title: '编写单元测试用例', status: 'DONE' }
    ]
  }

  return realTasks
})

// 今日待办任务（status=TODO 或 IN_PROGRESS）
const todayTodo = computed(() => {
  const realTasks = props.tasks.filter(task =>
    task.status === 'TODO' || task.status === 'IN_PROGRESS'
  )

  // 如果没有真实数据，返回 mock 数据
  if (realTasks.length === 0) {
    return [
      { id: 201, title: '实现看板拖拽排序功能', status: 'IN_PROGRESS' },
      { id: 202, title: '添加数据导出功能', status: 'TODO' },
      { id: 203, title: '优化移动端适配', status: 'TODO' },
      { id: 204, title: '编写 API 文档', status: 'TODO' }
    ]
  }

  return realTasks
})

// 昨天完成总结（mock）
const yesterdaySummary = computed(() => {
  // TODO: 从后端获取 AI 生成的总结
  if (yesterdayCompleted.value.length === 0) return ''
  return '完成了用户认证模块的核心功能，登录接口已通过测试。首页性能优化使加载时间从 3.2s 降至 1.1s。单元测试覆盖率达到 75%。'
})

// 今日计划建议（mock）
const todaySuggestion = computed(() => {
  // TODO: 从后端获取 AI 生成的建议
  if (todayTodo.value.length === 0) return ''
  return '建议优先完成拖拽排序功能，这是用户反馈最多的需求。数据导出功能可与 API 文档并行开发。移动端适配建议安排在下午，需要真机测试。'
})

// 获取任务的 workflow 进度
const getWorkflowProgress = (task) => {
  if (!task.workflow) return null

  const workflow = task.workflow
  const totalNodes = workflow.stages?.reduce((sum, stage) =>
    sum + (stage.nodes?.length || 0), 0) || 0
  const doneNodes = workflow.stages?.reduce((sum, stage) =>
    sum + (stage.nodes?.filter(n => n.status === 'DONE').length || 0), 0) || 0

  if (totalNodes === 0) return null
  return `${doneNodes}/${totalNodes} 节点`
}

// 格式化日期显示
const formatDate = (date) => {
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekDay = weekDays[date.getDay()]
  return `${month}月${day}日 ${weekDay}`
}

// 获取状态样式类
const getStatusClass = (status) => {
  const classMap = {
    'TODO': 'status-todo',
    'IN_PROGRESS': 'status-progress'
  }
  return classMap[status] || ''
}

// 获取状态标签
const getStatusLabel = (status) => {
  const labelMap = {
    'TODO': '待办',
    'IN_PROGRESS': '进行中'
  }
  return labelMap[status] || status
}

// 切换展开状态
const toggleExpand = () => {
  expanded.value = !expanded.value
}

// 跳转到任务
const goToTask = (task) => {
  emit('select-task', task)
}
</script>

<style scoped>
.daily-plan-card {
  margin: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  transition: background-color 0.2s;
}

.card-header:hover {
  background: #ecf0f5;
}

.card-header .title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-right: 12px;
}

.card-header .date {
  font-size: 13px;
  color: #606266;
  margin-right: auto;
}

.card-header .summary {
  font-size: 12px;
  color: #909399;
  margin-right: 12px;
}

.card-header .toggle-text {
  font-size: 12px;
  color: #909399;
}

.card-body {
  padding: 16px;
  display: flex;
  gap: 24px;
}

.section {
  flex: 1;
  min-width: 0;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.section-header .count {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.section.yesterday .section-header h4 {
  color: #67c23a;
}

.section.today .section-header h4 {
  color: #409eff;
}

.task-list {
  margin-bottom: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.task-item:hover {
  background: #f0f0f0;
}

.task-item.done {
  background: #f0f9eb;
}

.task-item.done:hover {
  background: #e1f3d8;
}

.task-item .task-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.task-item .task-status {
  margin-left: 8px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

.task-item .task-status.status-todo {
  background: #ecf5ff;
  color: #409eff;
}

.task-item .task-status.status-progress {
  background: #fdf6ec;
  color: #e6a23c;
}

.task-item .workflow-progress {
  margin-left: 8px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #f4f4f5;
  color: #909399;
}

.empty-tip {
  color: #909399;
  font-size: 12px;
  padding: 8px 0;
  text-align: center;
}

.summary-box,
.suggestion-box {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f9fafc;
  border-radius: 6px;
  border-left: 3px solid #67c23a;
}

.suggestion-box {
  border-left-color: #409eff;
  margin-bottom: 12px;
  margin-top: 0;
}

.summary-label,
.suggestion-label {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  margin-bottom: 6px;
}

.suggestion-label {
  color: #409eff;
}

.summary-label {
  color: #67c23a;
}

.summary-content,
.suggestion-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
</style>
