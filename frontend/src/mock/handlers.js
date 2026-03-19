// Mock API handlers
import {
  mockProjects,
  mockAgents,
  mockTasks,
  mockTaskSources,
  mockSessions,
  mockExecutions,
  mockIterations,
  generateId
} from './data.js'
import { mockWorkflows } from './workflowData.js'

// Simulate network delay
const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to create API response
const response = (data, success = true, message = 'Success') => ({
  success,
  message,
  data
})

// In-memory data store (allows modifications during demo)
let projects = [...mockProjects]
let agents = [...mockAgents]
let tasks = [...mockTasks]
let taskSources = [...mockTaskSources]
let sessions = [...mockSessions]
let executions = [...mockExecutions]
let iterations = [...mockIterations]

// Reset data to initial state
export const resetMockData = () => {
  projects = [...mockProjects]
  agents = [...mockAgents]
  tasks = [...mockTasks]
  taskSources = [...mockTaskSources]
  sessions = [...mockSessions]
  executions = [...mockExecutions]
  iterations = [...mockIterations]
}

// API Handlers
export const mockHandlers = {
  // Projects
  'GET /projects': async () => {
    await delay()
    return response(projects)
  },

  'GET /projects/:id': async (id) => {
    await delay()
    const project = projects.find(p => p.id === Number(id))
    return project ? response(project) : response(null, false, 'Project not found')
  },

  'POST /projects': async (data) => {
    await delay()
    const newProject = {
      id: generateId.project(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    projects.push(newProject)
    return response(newProject)
  },

  'PUT /projects/:id': async (id, data) => {
    await delay()
    const index = projects.findIndex(p => p.id === Number(id))
    if (index === -1) return response(null, false, 'Project not found')
    projects[index] = { ...projects[index], ...data, updatedAt: new Date().toISOString() }
    return response(projects[index])
  },

  'DELETE /projects/:id': async (id) => {
    await delay()
    const index = projects.findIndex(p => p.id === Number(id))
    if (index === -1) return response(null, false, 'Project not found')
    projects.splice(index, 1)
    // Also delete related tasks
    tasks = tasks.filter(t => t.projectId !== Number(id))
    return response(null)
  },

  // Tasks
  'GET /tasks': async (params) => {
    await delay()
    let result = tasks
    if (params?.projectId) {
      result = result.filter(t => t.projectId === Number(params.projectId))
    }
    return response(result)
  },

  'GET /tasks/:id': async (id) => {
    await delay()
    const task = tasks.find(t => t.id === Number(id))
    return task ? response(task) : response(null, false, 'Task not found')
  },

  'POST /tasks': async (data) => {
    await delay()
    const newTask = {
      id: generateId.task(),
      ...data,
      status: data.status || 'TODO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    tasks.push(newTask)
    return response(newTask)
  },

  'PUT /tasks/:id': async (id, data) => {
    await delay()
    const index = tasks.findIndex(t => t.id === Number(id))
    if (index === -1) return response(null, false, 'Task not found')
    tasks[index] = { ...tasks[index], ...data, updatedAt: new Date().toISOString() }
    return response(tasks[index])
  },

  'PATCH /tasks/:id/status': async (id, data) => {
    await delay()
    const index = tasks.findIndex(t => t.id === Number(id))
    if (index === -1) return response(null, false, 'Task not found')
    tasks[index].status = data.status
    tasks[index].updatedAt = new Date().toISOString()
    return response(tasks[index])
  },

  'DELETE /tasks/:id': async (id) => {
    await delay()
    const index = tasks.findIndex(t => t.id === Number(id))
    if (index === -1) return response(null, false, 'Task not found')
    tasks.splice(index, 1)
    return response(null)
  },

  // Agents
  'GET /agents': async () => {
    await delay()
    return response(agents)
  },

  'GET /agents/:id': async (id) => {
    await delay()
    const agent = agents.find(a => a.id === Number(id))
    return agent ? response(agent) : response(null, false, 'Agent not found')
  },

  'POST /agents': async (data) => {
    await delay()
    const newAgent = {
      id: generateId.agent(),
      ...data,
      createdAt: new Date().toISOString()
    }
    agents.push(newAgent)
    return response(newAgent)
  },

  'PUT /agents/:id': async (id, data) => {
    await delay()
    const index = agents.findIndex(a => a.id === Number(id))
    if (index === -1) return response(null, false, 'Agent not found')
    agents[index] = { ...agents[index], ...data }
    return response(agents[index])
  },

  'DELETE /agents/:id': async (id) => {
    await delay()
    const index = agents.findIndex(a => a.id === Number(id))
    if (index === -1) return response(null, false, 'Agent not found')
    agents.splice(index, 1)
    return response(null)
  },

  // Task Sources
  'GET /task-sources': async (params) => {
    await delay()
    let result = taskSources
    if (params?.projectId) {
      result = result.filter(s => s.projectId === Number(params.projectId))
    }
    return response(result)
  },

  // Sessions
  'GET /sessions': async (params) => {
    await delay()
    let result = sessions
    if (params?.taskId) {
      result = result.filter(s => s.taskId === Number(params.taskId))
    }
    return response(result)
  },

  'GET /sessions/:id': async (id) => {
    await delay()
    const session = sessions.find(s => s.id === id)
    return session ? response(session) : response(null, false, 'Session not found')
  },

  'POST /sessions': async (data) => {
    await delay()
    const newSession = {
      id: generateId.session(),
      ...data,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      output: ''
    }
    sessions.push(newSession)
    return response(newSession)
  },

  'POST /sessions/:id/start': async (id) => {
    await delay()
    const index = sessions.findIndex(s => s.id === id)
    if (index === -1) return response(null, false, 'Session not found')
    sessions[index].status = 'RUNNING'
    return response(sessions[index])
  },

  'POST /sessions/:id/stop': async (id) => {
    await delay()
    const index = sessions.findIndex(s => s.id === id)
    if (index === -1) return response(null, false, 'Session not found')
    sessions[index].status = 'STOPPED'
    return response(sessions[index])
  },

  'DELETE /sessions/:id': async (id) => {
    await delay()
    const index = sessions.findIndex(s => s.id === id)
    if (index === -1) return response(null, false, 'Session not found')
    sessions.splice(index, 1)
    return response(null)
  },

  // Executions
  'GET /executions': async (params) => {
    await delay()
    let result = executions
    if (params?.taskId) {
      result = result.filter(e => e.taskId === Number(params.taskId))
    }
    if (params?.agentId) {
      result = result.filter(e => e.agentId === Number(params.agentId))
    }
    // Sort by startedAt descending (newest first)
    result = result.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    return response(result)
  },

  'GET /executions/:id': async (id) => {
    await delay()
    const execution = executions.find(e => e.id === Number(id))
    return execution ? response(execution) : response(null, false, 'Execution not found')
  },

  'POST /executions': async (data) => {
    await delay()
    const task = tasks.find(t => t.id === data.taskId)
    const newExecution = {
      id: generateId.execution(),
      ...data,
      status: 'PENDING',
      worktreePath: null,
      branch: null,
      output: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      taskTitle: task?.title || `Task #${data.taskId}`,
      taskStatus: task?.status || 'TODO'
    }
    executions.push(newExecution)
    return response(newExecution)
  },

  'POST /executions/:id/stop': async (id) => {
    await delay()
    const index = executions.findIndex(e => e.id === Number(id))
    if (index === -1) return response(null, false, 'Execution not found')
    executions[index].status = 'CANCELLED'
    executions[index].completedAt = new Date().toISOString()
    return response(executions[index])
  },

  // Workflows
  'GET /workflows': async (params) => {
    await delay()
    let result = mockWorkflows
    if (params?.projectId) {
      result = result.filter(w => w.projectId === Number(params.projectId))
    }
    return response(result)
  },

  'GET /workflows/:id': async (id) => {
    await delay()
    const workflow = mockWorkflows.find(w => w.id === Number(id))
    return workflow ? response(workflow) : response(null, false, 'Workflow not found')
  },

  'GET /workflows/project/:projectId': async (projectId) => {
    await delay()
    const workflow = mockWorkflows.find(w => w.projectId === Number(projectId))
    return workflow ? response(workflow) : response(null, false, 'Workflow not found')
  },

  // Iterations
  'GET /iterations': async (params) => {
    await delay()
    let result = iterations
    if (params?.project_id) {
      result = result.filter(i => i.project_id === Number(params.project_id))
    }
    return response(result)
  },

  'GET /iterations/:id': async (id) => {
    await delay()
    const iteration = iterations.find(i => i.id === Number(id))
    return iteration ? response(iteration) : response(null, false, 'Iteration not found')
  },

  'POST /iterations': async (data) => {
    await delay()
    const newIteration = {
      id: generateId.iteration(),
      ...data,
      taskCount: 0,
      completedCount: 0,
      createdAt: new Date().toISOString()
    }
    iterations.push(newIteration)
    return response(newIteration)
  },

  'PUT /iterations/:id': async (id, data) => {
    await delay()
    const index = iterations.findIndex(i => i.id === Number(id))
    if (index === -1) return response(null, false, 'Iteration not found')
    iterations[index] = { ...iterations[index], ...data }
    return response(iterations[index])
  },

  'PATCH /iterations/:id/status': async (id, data) => {
    await delay()
    const index = iterations.findIndex(i => i.id === Number(id))
    if (index === -1) return response(null, false, 'Iteration not found')
    iterations[index].status = data.status
    return response(iterations[index])
  },

  'DELETE /iterations/:id': async (id) => {
    await delay()
    const index = iterations.findIndex(i => i.id === Number(id))
    if (index === -1) return response(null, false, 'Iteration not found')
    iterations.splice(index, 1)
    return response(null)
  }
}
