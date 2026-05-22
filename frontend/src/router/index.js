import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'ProjectList',
    component: () => import('../views/ProjectListView.vue')
  },
  {
    path: '/workspace/:projectId?',
    name: 'WorkspaceView',
    component: () => import('../views/WorkspaceView.vue')
  },
  {
    path: '/agents',
    name: 'AgentConfig',
    component: () => import('../views/AgentConfig.vue')
  },
  {
    path: '/template',
    name: 'WorkflowTemplateConfig',
    component: () => import('../views/WorkflowTemplateConfig.vue')
  },
  {
    path: '/skills',
    name: 'SkillConfig',
    component: () => import('../views/SkillConfig.vue')
  },
  {
    path: '/mcp-servers',
    name: 'McpServerConfig',
    component: () => import('../views/McpServerConfig.vue')
  },
  { path: '/dashboard',                 name: 'Dashboard',         component: () => import('../views/DashboardView.vue') },
  { path: '/dashboard/agents/:id',      name: 'DashboardAgent',    component: () => import('../views/DashboardAgentDetailView.vue') },
  { path: '/dashboard/projects/:id',    name: 'DashboardProject',  component: () => import('../views/DashboardProjectDetailView.vue') },
  { path: '/dashboard/teams/:id',       name: 'DashboardTeam',     component: () => import('../views/DashboardTeamDetailView.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
