import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: () => import('../views/ProjectListView.vue')
  },
  {
    path: '/kanban/:projectId?',
    name: 'KanbanView',
    component: () => import('../views/KanbanView.vue')
  },
  {
    path: '/task-sources/:projectId?',
    name: 'TaskSourceConfig',
    component: () => import('../views/TaskSourceConfig.vue')
  },
  {
    path: '/agents/:projectId?',
    name: 'AgentConfig',
    component: () => import('../views/AgentConfig.vue')
  },
  {
    path: '/prompt-templates',
    name: 'PromptTemplateConfig',
    component: () => import('../views/PromptTemplateConfig.vue')
  },
  {
    path: '/phase-transitions',
    name: 'PhaseTransitionConfig',
    component: () => import('../views/PhaseTransitionConfig.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
