import { createRouter, createWebHistory } from 'vue-router'
import ProjectListView from '../views/ProjectListView.vue'
import KanbanView from '../views/KanbanView.vue'
import TaskSourceConfig from '../views/TaskSourceConfig.vue'
import AgentConfig from '../views/AgentConfig.vue'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: ProjectListView
  },
  {
    path: '/kanban/:projectId?',
    name: 'KanbanView',
    component: KanbanView
  },
  {
    path: '/task-sources/:projectId?',
    name: 'TaskSourceConfig',
    component: TaskSourceConfig
  },
  {
    path: '/agents/:projectId?',
    name: 'AgentConfig',
    component: AgentConfig
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
