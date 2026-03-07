export default {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    add: 'Add',
    loading: 'Loading...',
    confirm: 'Confirm',
    success: 'Success',
    error: 'Error',
    search: 'Search',
    actions: 'Actions',
    enabled: 'Enabled',
    disabled: 'Disabled',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    none: 'None',
    back: 'Back',
    close: 'Close',
    required: 'Required',
    optional: 'Optional'
  },
  nav: {
    kanban: 'Kanban',
    taskSources: 'Task Sources',
    agents: 'Agents',
    settings: 'Settings'
  },
  project: {
    title: 'Projects',
    selectProject: 'Select a project',
    noProject: 'No project selected',
    createProject: 'Create Project',
    editProject: 'Edit Project',
    projectName: 'Project Name',
    description: 'Description',
    repositoryUrl: 'Repository URL',
    deleteConfirm: 'Are you sure you want to delete this project?'
  },
  task: {
    title: 'Tasks',
    createTask: 'Create Task',
    editTask: 'Edit Task',
    taskTitle: 'Title',
    taskDescription: 'Description',
    status: 'Status',
    priority: 'Priority',
    assignee: 'Assignee',
    dueDate: 'Due Date',
    deleteConfirm: 'Are you sure you want to delete this task?',
    noTasks: 'No tasks',
    addTask: '+ Add Task'
  },
  status: {
    TODO: 'Pending',
    DESIGN: 'Design',
    DEVELOPMENT: 'Development',
    TESTING: 'Testing',
    RELEASE: 'Release',
    DONE: 'Done'
  },
  priority: {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
  },
  taskSource: {
    title: 'Task Sources',
    createSource: 'Create Task Source',
    editSource: 'Edit Task Source',
    sourceName: 'Name',
    sourceType: 'Type',
    config: 'Configuration',
    syncInterval: 'Sync Interval (minutes)',
    lastSync: 'Last Sync',
    syncNow: 'Sync Now',
    testConnection: 'Test Connection',
    connectionSuccess: 'Connection successful',
    connectionFailed: 'Connection failed',
    syncing: 'Syncing...',
    types: {
      LOCAL: 'Local',
      GITHUB: 'GitHub Issues',
      JIRA: 'Jira',
      CUSTOM: 'Custom'
    }
  },
  agent: {
    title: 'Agents',
    createAgent: 'Create Agent',
    editAgent: 'Edit Agent',
    agentName: 'Name',
    agentType: 'Type',
    command: 'Command Template',
    config: 'Configuration',
    deleteConfirm: 'Are you sure you want to delete this agent?',
    types: {
      CLAUDE: 'Claude Code',
      CODEX: 'OpenAI Codex',
      CURSOR: 'Cursor',
      GEMINI: 'Gemini',
      CUSTOM: 'Custom'
    },
    commandHint: 'Use {prompt} as placeholder for task prompt'
  },
  execution: {
    title: 'Executions',
    startExecution: 'Start Execution',
    selectAgent: 'Select an agent...',
    execute: 'Execute',
    stop: 'Stop',
    status: 'Status',
    output: 'Output',
    startedAt: 'Started At',
    completedAt: 'Completed At',
    statuses: {
      PENDING: 'Pending',
      RUNNING: 'Running',
      SUCCESS: 'Success',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled'
    }
  },
  session: {
    title: 'Session',
    createSession: 'Create Session',
    startSession: 'Start Session',
    stopSession: 'Stop Session',
    deleteSession: 'Delete Session',
    continueSession: 'Continue',
    status: {
      none: 'No Session',
      created: 'Created',
      running: 'Running',
      idle: 'Idle',
      stopped: 'Stopped',
      error: 'Error',
      completed: 'Completed'
    }
  },
  chat: {
    title: 'Chat',
    you: 'You',
    assistant: 'Assistant',
    inputPlaceholder: 'Type a message... (Enter to send)',
    noSession: 'No active session',
    noSessionHint: 'Select an agent and start a session to begin chatting',
    readyTitle: 'Ready to chat',
    readyHint: 'Click "Start" to begin the conversation',
    taskSummary: 'Summary'
  },
  validation: {
    required: 'This field is required',
    titleRequired: 'Title is required',
    minLength: 'Minimum {min} characters required',
    maxLength: 'Maximum {max} characters allowed',
    invalid: 'Invalid value'
  },
  messages: {
    created: '{name} created successfully',
    updated: '{name} updated successfully',
    deleted: '{name} deleted successfully',
    saved: '{name} saved successfully',
    createFailed: 'Failed to create {name}',
    updateFailed: 'Failed to update {name}',
    deleteFailed: 'Failed to delete {name}',
    saveFailed: 'Failed to save {name}'
  }
}
