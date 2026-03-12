// 任务管家回复规则 - 关键词匹配
export const butlerResponses = {
  // 启动相关
  '启动': { action: 'start', response: '好的，我正在为您启动任务工作流...' },
  '开始': { action: 'start', response: '收到，任务工作流已开始执行。' },
  'start': { action: 'start', response: 'Starting the task workflow...' },

  // 暂停相关
  '暂停': { action: 'pause', response: '已暂停当前工作流。' },
  '停止': { action: 'stop', response: '工作流已停止。' },
  'pause': { action: 'pause', response: 'Workflow paused.' },
  'stop': { action: 'stop', response: 'Workflow stopped.' },

  // 状态查询 - 将由 getDetailedWorkflowStatus 处理
  '进度': { action: 'status', response: '__DETAILED_PROGRESS__' },
  '状态': { action: 'status', response: '__DETAILED_PROGRESS__' },
  '怎么样': { action: 'status', response: '__DETAILED_PROGRESS__' },
  'progress': { action: 'status', response: '__DETAILED_PROGRESS__' },
  'status': { action: 'status', response: '__DETAILED_PROGRESS__' },

  // 继续执行
  '继续': { action: 'continue', response: '好的，正在继续执行工作流...' },
  'continue': { action: 'continue', response: 'Continuing workflow execution...' },

  // 重试
  '重试': { action: 'retry', response: '好的，正在重试当前节点...' },
  'retry': { action: 'retry', response: 'Retrying current node...' },

  // 查看详情
  '详情': { action: 'details', response: '让我为您查看任务详情...\n\n任务名称: {taskTitle}\n状态: {status}\n进度: {progress}%\n当前阶段: {currentNode}' },
  'details': { action: 'details', response: 'Let me check the task details...\n\nTask: {taskTitle}\nStatus: {status}\nProgress: {progress}%\nCurrent Stage: {currentNode}' },

  // 帮助
  '帮助': { action: 'help', response: '我可以帮您：\n• 启动任务 - 说"启动"或"开始"\n• 暂停任务 - 说"暂停"\n• 查看进度 - 说"进度"或"状态"\n• 查看详情 - 说"详情"\n• 继续执行 - 说"继续"\n• 重试 - 说"重试"' },
  'help': { action: 'help', response: 'I can help you with:\n• Start task - say "start"\n• Pause task - say "pause"\n• View progress - say "progress" or "status"\n• View details - say "details"\n• Continue - say "continue"\n• Retry - say "retry"' },

  // 问候
  '你好': { action: 'greet', response: '您好！我是小捷，有什么可以帮您的吗？' },
  'hello': { action: 'greet', response: 'Hello! I am Jie, how can I help you?' },
  'hi': { action: 'greet', response: 'Hi! Ready to help you manage your task.' }
}

// 获取工作流详细执行状态
export const getDetailedWorkflowStatus = (workflow, task, locale = 'zh') => {
  if (!workflow || !workflow.stages || workflow.stages.length === 0) {
    if (locale === 'en') {
      return 'No workflow configured for this task yet. Please assign a workflow first.'
    }
    return '该任务尚未配置工作流，请先分配工作流。'
  }

  const progress = getWorkflowProgress(workflow)
  const currentNode = getCurrentNodeName(workflow)

  // 收集各阶段和节点的执行情况
  const stageDetails = []
  let completedCount = 0
  let totalCount = 0
  let inProgressCount = 0
  let pendingCount = 0

  workflow.stages.forEach((stage, stageIndex) => {
    const stageInfo = {
      name: stage.name || (locale === 'en' ? `Stage ${stageIndex + 1}` : `阶段 ${stageIndex + 1}`),
      nodes: []
    }

    if (stage.nodes) {
      stage.nodes.forEach(node => {
        // 处理并行节点（父节点）
        if (node.isParent && node.childNodes) {
          node.childNodes.forEach(childNode => {
            totalCount++
            const statusIcon = getNodeStatusIcon(childNode.status)
            if (childNode.status === 'DONE') completedCount++
            else if (childNode.status === 'IN_PROGRESS') inProgressCount++
            else pendingCount++

            stageInfo.nodes.push({
              name: childNode.name,
              status: childNode.status,
              agentName: childNode.agentName,
              icon: statusIcon
            })
          })
        } else {
          totalCount++
          const statusIcon = getNodeStatusIcon(node.status)
          if (node.status === 'DONE') completedCount++
          else if (node.status === 'IN_PROGRESS') inProgressCount++
          else pendingCount++

          stageInfo.nodes.push({
            name: node.name,
            status: node.status,
            agentName: node.agentName,
            icon: statusIcon
          })
        }
      })
    }

    stageDetails.push(stageInfo)
  })

  // 构建详细的状态报告
  if (locale === 'en') {
    let report = `📊 **Workflow Execution Status**\n\n`
    report += `**Task:** ${task?.title || 'Unknown'}\n`
    report += `**Overall Progress:** ${progress}% (${completedCount}/${totalCount} nodes completed)\n`
    report += `**Status:** ${completedCount === totalCount ? '✅ Completed' : inProgressCount > 0 ? '🔄 In Progress' : '⏳ Pending'}\n\n`

    report += `---\n\n`
    report += `**Execution Details:**\n\n`

    stageDetails.forEach((stage, index) => {
      report += `**${stage.name}:**\n`
      stage.nodes.forEach(node => {
        const statusText = node.status === 'DONE' ? 'Completed' :
                          node.status === 'IN_PROGRESS' ? 'In Progress' :
                          node.status === 'FAILED' ? 'Failed' :
                          node.status === 'REJECTED' ? 'Rejected' : 'Pending'
        report += `  ${node.icon} ${node.name} (${node.agentName}) - ${statusText}\n`
      })
      if (index < stageDetails.length - 1) report += `\n`
    })

    if (inProgressCount > 0) {
      report += `\n📍 **Currently executing:** ${currentNode}`
    }

    return report
  }

  // 中文报告
  let report = `📊 **工作流执行状态**\n\n`
  report += `**任务:** ${task?.title || '未知任务'}\n`
  report += `**整体进度:** ${progress}% (${completedCount}/${totalCount} 个节点已完成)\n`
  report += `**状态:** ${completedCount === totalCount ? '✅ 已完成' : inProgressCount > 0 ? '🔄 执行中' : '⏳ 待执行'}\n\n`

  report += `---\n\n`
  report += `**执行详情:**\n\n`

  stageDetails.forEach((stage, index) => {
    report += `**${stage.name}:**\n`
    stage.nodes.forEach(node => {
      const statusText = node.status === 'DONE' ? '已完成' :
                        node.status === 'IN_PROGRESS' ? '执行中' :
                        node.status === 'FAILED' ? '失败' :
                        node.status === 'REJECTED' ? '已打回' : '待执行'
      report += `  ${node.icon} ${node.name} (${node.agentName}) - ${statusText}\n`
    })
    if (index < stageDetails.length - 1) report += `\n`
  })

  if (inProgressCount > 0) {
    report += `\n📍 **当前正在执行:** ${currentNode}`
  }

  return report
}

// 获取节点状态图标
const getNodeStatusIcon = (status) => {
  const icons = {
    'DONE': '✅',
    'IN_PROGRESS': '🔄',
    'PENDING': '⏳',
    'TODO': '⏳',
    'FAILED': '❌',
    'REJECTED': '↩️'
  }
  return icons[status] || '⏳'
}

// 管家欢迎消息
export const getButlerWelcomeMessage = (taskTitle, locale = 'zh') => {
  if (locale === 'en') {
    return {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm **Jie** - ${taskTitle} 🎯

I'm here to help you execute this task.

You can tell me:
• "start" - Start the workflow
• "pause" - Pause current execution
• "progress" - Check current progress
• "help" - View more commands`,
      timestamp: new Date().toISOString()
    }
  }

  return {
    id: 'welcome',
    role: 'assistant',
    content: `嗨！我是**小捷** - ${taskTitle} 🎯

我来帮您执行这个任务。

您可以对我说：
• "启动" - 开始执行工作流
• "暂停" - 暂停当前执行
• "进度" - 查看当前进度
• "帮助" - 查看更多指令`,
    timestamp: new Date().toISOString()
  }
}

// 计算工作流进度
export const getWorkflowProgress = (workflow) => {
  if (!workflow || !workflow.stages) return 0

  let totalNodes = 0
  let completedNodes = 0

  workflow.stages.forEach(stage => {
    if (stage.nodes) {
      stage.nodes.forEach(node => {
        // 处理并行节点（父节点）
        if (node.isParent && node.childNodes) {
          node.childNodes.forEach(childNode => {
            totalNodes++
            if (childNode.status === 'DONE') completedNodes++
          })
        } else {
          totalNodes++
          if (node.status === 'DONE') completedNodes++
        }
      })
    }
  })

  if (totalNodes === 0) return 0
  return Math.round((completedNodes / totalNodes) * 100)
}

// 获取当前执行的节点名称
export const getCurrentNodeName = (workflow) => {
  if (!workflow || !workflow.stages) return '无'

  for (const stage of workflow.stages) {
    if (stage.nodes) {
      for (const node of stage.nodes) {
        // 处理并行节点
        if (node.isParent && node.childNodes) {
          for (const childNode of node.childNodes) {
            if (childNode.status === 'IN_PROGRESS') {
              return childNode.name
            }
          }
        } else if (node.status === 'IN_PROGRESS') {
          return node.name
        }
      }
    }
  }

  return '未开始'
}

// 模拟管家处理用户输入
export const processButlerInput = (input, task, workflow, locale = 'zh') => {
  const lowerInput = input.toLowerCase().trim()

  // 匹配关键词并返回对应操作
  for (const [keyword, config] of Object.entries(butlerResponses)) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      // 特殊处理进度查询，返回详细信息
      if (config.response === '__DETAILED_PROGRESS__') {
        return {
          action: config.action,
          response: getDetailedWorkflowStatus(workflow, task, locale)
        }
      }

      const progress = getWorkflowProgress(workflow)
      const currentNode = getCurrentNodeName(workflow)

      return {
        action: config.action,
        response: config.response
          .replace('{progress}', progress)
          .replace('{status}', task?.status || 'TODO')
          .replace('{currentNode}', currentNode)
          .replace('{taskTitle}', task?.title || '未知任务')
      }
    }
  }

  // 默认回复
  if (locale === 'en') {
    return {
      action: 'unknown',
      response: "Sorry, I didn't understand that. Say 'help' to see what I can do."
    }
  }

  return {
    action: 'unknown',
    response: '抱歉，我没有理解您的意思。请说"帮助"查看我能做什么。'
  }
}

// 获取快捷操作按钮配置
export const getQuickActions = (task, workflow, locale = 'zh') => {
  const progress = getWorkflowProgress(workflow)
  const isRunning = task?.status === 'IN_PROGRESS'
  const isCompleted = task?.status === 'DONE'
  const isPending = task?.status === 'TODO'

  if (locale === 'en') {
    return [
      { id: 'start', label: 'Start', icon: 'play', disabled: isRunning || isCompleted, action: 'start' },
      { id: 'pause', label: 'Pause', icon: 'pause', disabled: !isRunning, action: 'pause' },
      { id: 'progress', label: 'Progress', icon: 'chart', disabled: false, action: 'status' },
      { id: 'help', label: 'Help', icon: 'help', disabled: false, action: 'help' }
    ]
  }

  return [
    { id: 'start', label: '启动', icon: 'play', disabled: isRunning || isCompleted, action: 'start' },
    { id: 'pause', label: '暂停', icon: 'pause', disabled: !isRunning, action: 'pause' },
    { id: 'progress', label: '进度', icon: 'chart', disabled: false, action: 'status' },
    { id: 'help', label: '帮助', icon: 'help', disabled: false, action: 'help' }
  ]
}

// 根据操作获取响应
export const getResponseForAction = (action, task, workflow, locale = 'zh') => {
  // 特殊处理进度查询
  if (action === 'status') {
    return {
      action: 'status',
      response: getDetailedWorkflowStatus(workflow, task, locale)
    }
  }

  // 找到对应的响应模板
  const keywordMap = {
    'start': ['启动', 'start'],
    'pause': ['暂停', 'pause'],
    'help': ['帮助', 'help'],
    'continue': ['继续', 'continue'],
    'retry': ['重试', 'retry'],
    'details': ['详情', 'details']
  }

  for (const keywords of Object.values(keywordMap)) {
    if (keywords.includes(action)) {
      // 使用第一个关键词查找响应
      const response = butlerResponses[keywords[0]]
      if (response) {
        const progress = getWorkflowProgress(workflow)
        const currentNode = getCurrentNodeName(workflow)

        return {
          action: response.action,
          response: response.response
            .replace('{progress}', progress)
            .replace('{status}', task?.status || 'TODO')
            .replace('{currentNode}', currentNode)
            .replace('{taskTitle}', task?.title || '未知任务')
        }
      }
    }
  }

  // 默认响应
  return processButlerInput(action, task, workflow, locale)
}

// ============= 全局任务助手功能 =============

// 判断日期是否是今天
const isToday = (dateStr) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate()
}

// 判断日期是否是昨天
const isYesterday = (dateStr) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.getFullYear() === yesterday.getFullYear() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getDate() === yesterday.getDate()
}

// 获取任务状态图标
const getTaskStatusIcon = (status) => {
  const icons = {
    'TODO': '📋',
    'IN_PROGRESS': '🔄',
    'DONE': '✅',
    'BLOCKED': '🚫',
    'CANCELLED': '❌'
  }
  return icons[status] || '📋'
}

// 获取项目统计概览
export const getProjectStats = (tasks, locale = 'zh') => {
  const stats = {
    TODO: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    BLOCKED: 0
  }

  tasks.forEach(task => {
    if (stats.hasOwnProperty(task.status)) {
      stats[task.status]++
    }
  })

  return stats
}

// 获取昨日完成的任务
export const getYesterdayCompletedTasks = (tasks) => {
  const realTasks = tasks.filter(task =>
    task.status === 'DONE' && isYesterday(task.updatedAt)
  )
  return realTasks
}

// 获取今日待办任务
export const getTodayTodoTasks = (tasks) => {
  return tasks.filter(task =>
    task.status === 'TODO' || task.status === 'IN_PROGRESS'
  )
}

// 获取今日完成任务
export const getTodayCompletedTasks = (tasks) => {
  return tasks.filter(task =>
    task.status === 'DONE' && isToday(task.updatedAt)
  )
}

// 生成每日计划消息
export const getDailyPlanMessage = (tasks, locale = 'zh') => {
  const todayTodo = getTodayTodoTasks(tasks)
  const todayCompleted = getTodayCompletedTasks(tasks)

  if (locale === 'en') {
    let message = `📅 **Today's Plan**\n\n`

    if (todayCompleted.length > 0) {
      message += `✅ **Completed Today** (${todayCompleted.length})\n`
      todayCompleted.slice(0, 5).forEach(task => {
        message += `  • ${task.title}\n`
      })
      if (todayCompleted.length > 5) {
        message += `  ... and ${todayCompleted.length - 5} more\n`
      }
      message += '\n'
    }

    if (todayTodo.length > 0) {
      message += `📋 **Pending Today** (${todayTodo.length})\n`
      todayTodo.slice(0, 8).forEach(task => {
        const icon = task.status === 'IN_PROGRESS' ? '🔄' : '⏳'
        message += `  ${icon} ${task.title}\n`
      })
      if (todayTodo.length > 8) {
        message += `  ... and ${todayTodo.length - 8} more\n`
      }
    } else {
      message += `🎉 All tasks completed!\n`
    }

    return {
      action: 'today-plan',
      response: message,
      tasks: todayTodo.length > 0 ? todayTodo : null
    }
  }

  // 中文版本
  let message = `📅 **今日计划**\n\n`

  if (todayCompleted.length > 0) {
    message += `✅ **今日完成** (${todayCompleted.length})\n`
    todayCompleted.slice(0, 5).forEach(task => {
      message += `  • ${task.title}\n`
    })
    if (todayCompleted.length > 5) {
      message += `  ... 还有 ${todayCompleted.length - 5} 项\n`
    }
    message += '\n'
  }

  if (todayTodo.length > 0) {
    message += `📋 **今日待办** (${todayTodo.length})\n`
    todayTodo.slice(0, 8).forEach(task => {
      const icon = task.status === 'IN_PROGRESS' ? '🔄' : '⏳'
      message += `  ${icon} ${task.title}\n`
    })
    if (todayTodo.length > 8) {
      message += `  ... 还有 ${todayTodo.length - 8} 项\n`
    }
  } else {
    message += `🎉 所有任务已完成！\n`
  }

  return {
    action: 'today-plan',
    response: message,
    tasks: todayTodo.length > 0 ? todayTodo : null
  }
}

// 生成昨日完成消息
export const getYesterdayCompletedMessage = (tasks, locale = 'zh') => {
  const yesterdayCompleted = getYesterdayCompletedTasks(tasks)

  if (locale === 'en') {
    if (yesterdayCompleted.length === 0) {
      return {
        action: 'yesterday-completed',
        response: `📅 **Yesterday's Completed Tasks**\n\nNo tasks were completed yesterday.`
      }
    }

    let message = `📅 **Yesterday's Completed Tasks** (${yesterdayCompleted.length})\n\n`
    yesterdayCompleted.forEach((task, index) => {
      message += `${index + 1}. ✅ ${task.title}\n`
    })

    return {
      action: 'yesterday-completed',
      response: message,
      tasks: yesterdayCompleted
    }
  }

  // 中文版本
  if (yesterdayCompleted.length === 0) {
    return {
      action: 'yesterday-completed',
      response: `📅 **昨天完成的任务**\n\n昨天没有完成任务。`
    }
  }

  let message = `📅 **昨天完成的任务** (${yesterdayCompleted.length})\n\n`
  yesterdayCompleted.forEach((task, index) => {
    message += `${index + 1}. ✅ ${task.title}\n`
  })

  return {
    action: 'yesterday-completed',
    response: message,
    tasks: yesterdayCompleted
  }
}

// 格式化任务列表
export const formatTaskList = (tasks, locale = 'zh') => {
  if (!tasks || tasks.length === 0) {
    return locale === 'en' ? 'No tasks found.' : '没有找到任务。'
  }

  if (locale === 'en') {
    let result = `Found ${tasks.length} task(s):\n\n`
    tasks.forEach((task, index) => {
      const icon = getTaskStatusIcon(task.status)
      result += `${index + 1}. ${icon} **${task.title}**\n`
      result += `   Status: ${task.status} | Priority: ${task.priority || 'N/A'}\n`
      if (task.description) {
        const desc = task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description
        result += `   ${desc}\n`
      }
      result += '\n'
    })
    return result
  }

  let result = `找到 ${tasks.length} 个任务：\n\n`
  tasks.forEach((task, index) => {
    const icon = getTaskStatusIcon(task.status)
    result += `${index + 1}. ${icon} **${task.title}**\n`
    result += `   状态: ${task.status} | 优先级: ${task.priority || '无'}\n`
    if (task.description) {
      const desc = task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description
      result += `   ${desc}\n`
    }
    result += '\n'
  })
  return result
}

// 生成项目概览
export const generateProjectOverview = (tasks, locale = 'zh') => {
  const stats = getProjectStats(tasks)
  const total = tasks.length

  if (locale === 'en') {
    let overview = `📊 **Project Overview**\n\n`
    overview += `**Total Tasks:** ${total}\n\n`
    overview += `**Status Breakdown:**\n`
    overview += `📋 Pending: ${stats.TODO}\n`
    overview += `🔄 In Progress: ${stats.IN_PROGRESS}\n`
    overview += `✅ Completed: ${stats.DONE}\n`
    overview += `🚫 Blocked: ${stats.BLOCKED}\n\n`

    const completionRate = total > 0 ? Math.round((stats.DONE / total) * 100) : 0
    overview += `**Completion Rate:** ${completionRate}%\n`

    if (stats.IN_PROGRESS > 0) {
      const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS')
      overview += `\n**Currently In Progress:**\n`
      inProgressTasks.slice(0, 5).forEach(task => {
        overview += `• ${task.title}\n`
      })
      if (inProgressTasks.length > 5) {
        overview += `  ... and ${inProgressTasks.length - 5} more\n`
      }
    }

    return overview
  }

  let overview = `📊 **项目概览**\n\n`
  overview += `**总任务数:** ${total}\n\n`
  overview += `**状态分布:**\n`
  overview += `📋 待办: ${stats.TODO}\n`
  overview += `🔄 进行中: ${stats.IN_PROGRESS}\n`
  overview += `✅ 已完成: ${stats.DONE}\n`
  overview += `🚫 阻塞: ${stats.BLOCKED}\n\n`

  const completionRate = total > 0 ? Math.round((stats.DONE / total) * 100) : 0
  overview += `**完成率:** ${completionRate}%\n`

  if (stats.IN_PROGRESS > 0) {
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS')
    overview += `\n**当前进行中:**\n`
    inProgressTasks.slice(0, 5).forEach(task => {
      overview += `• ${task.title}\n`
    })
    if (inProgressTasks.length > 5) {
      overview += `  ... 还有 ${inProgressTasks.length - 5} 个\n`
    }
  }

  return overview
}

// 根据名称查找任务
export const findTaskByName = (tasks, name) => {
  if (!tasks || !name) return null
  const lowerName = name.toLowerCase()

  // 先尝试精确匹配
  let task = tasks.find(t => t.title.toLowerCase() === lowerName)
  if (task) return task

  // 再尝试部分匹配
  task = tasks.find(t => t.title.toLowerCase().includes(lowerName))
  if (task) return task

  // 最后尝试任务ID匹配
  task = tasks.find(t => String(t.id) === name || String(t.id).toLowerCase() === lowerName)
  return task
}

// 处理全局助手输入
export const processGlobalButlerInput = (input, tasks, locale = 'zh') => {
  const lowerInput = input.toLowerCase().trim()

  // 今日计划
  if (lowerInput.includes('今日计划') || lowerInput.includes('今天计划') ||
      lowerInput.includes('计划') && lowerInput.includes('今日') ||
      lowerInput === 'today plan' || lowerInput === 'daily plan' ||
      lowerInput === 'today' || lowerInput === 'plan') {
    return getDailyPlanMessage(tasks, locale)
  }

  // 昨日完成
  if (lowerInput.includes('昨日完成') || lowerInput.includes('昨天完成') ||
      lowerInput.includes('昨天') && lowerInput.includes('完成') ||
      lowerInput === 'yesterday' || lowerInput === 'yesterday completed') {
    return getYesterdayCompletedMessage(tasks, locale)
  }

  // 列出所有任务
  if (lowerInput.includes('查看全部') || lowerInput.includes('list all') || lowerInput === 'all' || lowerInput === 'list-all') {
    return {
      action: 'list-all',
      response: locale === 'en' ? `**All Tasks** (${tasks.length})` : `**全部任务** (${tasks.length})`,
      tasks: tasks
    }
  }

  // 查看进行中的任务
  if (lowerInput.includes('进行中') || lowerInput.includes('in progress') || lowerInput === 'progress' || lowerInput === 'list-in-progress') {
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS')
    if (locale === 'en') {
      return {
        action: 'list-in-progress',
        response: inProgress.length > 0
          ? `**Tasks In Progress** (${inProgress.length})`
          : 'No tasks are currently in progress.',
        tasks: inProgress.length > 0 ? inProgress : null
      }
    }
    return {
      action: 'list-in-progress',
      response: inProgress.length > 0
        ? `**进行中的任务** (${inProgress.length})`
        : '当前没有进行中的任务。',
      tasks: inProgress.length > 0 ? inProgress : null
    }
  }

  // 查看待办任务
  if (lowerInput.includes('待办') || lowerInput.includes('todo') || lowerInput.includes('pending') || lowerInput === 'todo' || lowerInput === 'list-todo') {
    const todoTasks = tasks.filter(t => t.status === 'TODO')
    if (locale === 'en') {
      return {
        action: 'list-todo',
        response: todoTasks.length > 0
          ? `**Pending Tasks** (${todoTasks.length})`
          : 'No pending tasks.',
        tasks: todoTasks.length > 0 ? todoTasks : null
      }
    }
    return {
      action: 'list-todo',
      response: todoTasks.length > 0
        ? `**待办任务** (${todoTasks.length})`
        : '没有待办任务。',
      tasks: todoTasks.length > 0 ? todoTasks : null
    }
  }

  // 查看已完成任务
  if (lowerInput.includes('完成') || lowerInput.includes('done') || lowerInput.includes('completed') || lowerInput === 'list-done') {
    const doneTasks = tasks.filter(t => t.status === 'DONE')
    if (locale === 'en') {
      return {
        action: 'list-done',
        response: doneTasks.length > 0
          ? `**Completed Tasks** (${doneTasks.length})`
          : 'No completed tasks yet.',
        tasks: doneTasks.length > 0 ? doneTasks : null
      }
    }
    return {
      action: 'list-done',
      response: doneTasks.length > 0
        ? `**已完成任务** (${doneTasks.length})`
        : '还没有完成的任务。',
      tasks: doneTasks.length > 0 ? doneTasks : null
    }
  }

  // 项目概览
  if (lowerInput.includes('概览') || lowerInput.includes('overview') || lowerInput === 'stats' || lowerInput === 'overview') {
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS')
    return {
      action: 'overview',
      response: generateProjectOverview(tasks, locale),
      tasks: inProgressTasks.length > 0 ? inProgressTasks : null
    }
  }

  // 启动指定任务
  const startMatch = lowerInput.match(/启动[任务]?\s*(.+)/) || lowerInput.match(/start\s+(?:task\s+)?(.+)/)
  if (startMatch) {
    const taskName = startMatch[1].trim()
    const task = findTaskByName(tasks, taskName)
    if (task) {
      if (locale === 'en') {
        return {
          action: 'start',
          taskId: task.id,
          task: task,
          response: `Starting task "${task.title}"...\n\nYou can monitor progress in the single task mode.`
        }
      }
      return {
        action: 'start',
        taskId: task.id,
        task: task,
        response: `正在启动任务「${task.title}」...\n\n您可以在单任务模式下查看进度。`
      }
    } else {
      if (locale === 'en') {
        return {
          action: 'task-not-found',
          response: `Task "${taskName}" not found. Please check the task name or use "list all" to see all tasks.`
        }
      }
      return {
        action: 'task-not-found',
        response: `未找到任务「${taskName}」。请检查任务名称或使用"查看全部"查看所有任务。`
      }
    }
  }

  // 暂停指定任务
  const pauseMatch = lowerInput.match(/暂停[任务]?\s*(.+)/) || lowerInput.match(/pause\s+(?:task\s+)?(.+)/)
  if (pauseMatch) {
    const taskName = pauseMatch[1].trim()
    const task = findTaskByName(tasks, taskName)
    if (task) {
      if (locale === 'en') {
        return {
          action: 'pause',
          taskId: task.id,
          task: task,
          response: `Pausing task "${task.title}"...`
        }
      }
      return {
        action: 'pause',
        taskId: task.id,
        task: task,
        response: `正在暂停任务「${task.title}」...`
      }
    } else {
      if (locale === 'en') {
        return {
          action: 'task-not-found',
          response: `Task "${taskName}" not found.`
        }
      }
      return {
        action: 'task-not-found',
        response: `未找到任务「${taskName}」。`
      }
    }
  }

  // 查看任务进度
  const progressMatch = lowerInput.match(/[任务]?\s*(.+)\s*进度/) || lowerInput.match(/(?:task\s+)?(.+?)\s+progress/)
  if (progressMatch) {
    const taskName = progressMatch[1].trim()
    const task = findTaskByName(tasks, taskName)
    if (task) {
      return {
        action: 'task-progress',
        taskId: task.id,
        task: task,
        response: locale === 'en'
          ? `Task: **${task.title}**\nStatus: ${task.status}\nPriority: ${task.priority || 'N/A'}\n\nSwitch to single task mode for detailed workflow progress.`
          : `任务: **${task.title}**\n状态: ${task.status}\n优先级: ${task.priority || '无'}\n\n切换到单任务模式可查看详细工作流进度。`
      }
    }
  }

  // 批量启动待办
  if (lowerInput.includes('批量启动') || lowerInput.includes('start all') || lowerInput.includes('batch start')) {
    const todoTasks = tasks.filter(t => t.status === 'TODO')
    if (todoTasks.length === 0) {
      return {
        action: 'batch-start',
        response: locale === 'en' ? 'No pending tasks to start.' : '没有待办任务可以启动。'
      }
    }
    return {
      action: 'batch-start',
      taskIds: todoTasks.map(t => t.id),
      tasks: todoTasks,
      response: locale === 'en'
        ? `Starting ${todoTasks.length} pending task(s)...\n\nTasks: ${todoTasks.map(t => t.title).join(', ')}`
        : `正在启动 ${todoTasks.length} 个待办任务...\n\n任务: ${todoTasks.map(t => t.title).join('、')}`
    }
  }

  // 帮助
  if (lowerInput.includes('帮助') || lowerInput === 'help' || lowerInput === '?') {
    if (locale === 'en') {
      return {
        action: 'help',
        response: `**Cloud's Commands:**

**Daily Plan:**
• "today" / "plan" - View today's plan
• "yesterday" - View yesterday's completed tasks

**View Tasks:**
• "list all" / "all" - List all tasks
• "in progress" - Show tasks in progress
• "todo" / "pending" - Show pending tasks
• "done" / "completed" - Show completed tasks
• "overview" / "stats" - Project overview

**Manage Tasks:**
• "start [task name]" - Start a specific task
• "pause [task name]" - Pause a specific task
• "start all" - Start all pending tasks

**Other:**
• "help" - Show this help message`
      }
    }
    return {
      action: 'help',
      response: `**小云的命令：**

**每日计划：**
• "今日计划" / "计划" - 查看今日计划
• "昨天完成" / "昨天" - 查看昨日完成任务

**查看任务：**
• "查看全部" / "all" - 列出所有任务
• "进行中" - 显示进行中的任务
• "待办" / "todo" - 显示待办任务
• "完成" - 显示已完成任务
• "概览" / "overview" - 项目概览

**管理任务：**
• "启动 [任务名]" - 启动指定任务
• "暂停 [任务名]" - 暂停指定任务
• "批量启动" - 启动所有待办任务

**其他：**
• "帮助" - 显示帮助信息`
    }
  }

  // 问候
  if (lowerInput.includes('你好') || lowerInput.includes('hello') || lowerInput === 'hi') {
    return {
      action: 'greet',
      response: locale === 'en'
        ? `Hi! I'm Cloud. I can help you manage all tasks in the project.\n\nSay "help" to see available commands.`
        : `嗨！我是小云。我可以帮您管理项目中的所有任务。\n\n说"帮助"查看可用命令。`
    }
  }

  // 默认回复
  if (locale === 'en') {
    return {
      action: 'unknown',
      response: "I didn't understand that. Say 'help' to see what I can do."
    }
  }
  return {
    action: 'unknown',
    response: '抱歉，我没有理解您的意思。请说"帮助"查看我能做什么。'
  }
}

// 获取全局助手欢迎消息
export const getGlobalButlerWelcomeMessage = (tasks, locale = 'zh') => {
  const stats = getProjectStats(tasks)
  const todayTodo = getTodayTodoTasks(tasks)
  const yesterdayCompleted = getYesterdayCompletedTasks(tasks)

  if (locale === 'en') {
    return {
      id: 'welcome-global',
      role: 'assistant',
      content: `Hi! I'm **Cloud** 🤖

I can help you manage all tasks in the project.

**Current Status:**
📋 Pending: ${stats.TODO} | 🔄 In Progress: ${stats.IN_PROGRESS} | ✅ Done: ${stats.DONE}

**Today's Overview:**
✅ Yesterday: ${yesterdayCompleted.length} completed | 📋 Today: ${todayTodo.length} pending

Say "help" to see available commands, or "today" to view your daily plan.`,
      timestamp: new Date().toISOString()
    }
  }

  return {
    id: 'welcome-global',
    role: 'assistant',
    content: `嗨！我是**小云** 🤖

我可以帮您管理项目中的所有任务。

**当前状态：**
📋 待办: ${stats.TODO} | 🔄 进行中: ${stats.IN_PROGRESS} | ✅ 完成: ${stats.DONE}

**今日概览：**
✅ 昨日: ${yesterdayCompleted.length} 项完成 | 📋 今日: ${todayTodo.length} 项待办

说"帮助"查看可用命令，或说"今日计划"查看每日计划。`,
    timestamp: new Date().toISOString()
  }
}

// 获取全局快捷操作
export const getGlobalQuickActions = (tasks, locale = 'zh') => {
  const stats = getProjectStats(tasks)

  if (locale === 'en') {
    return [
      { id: 'today-plan', label: 'Today', icon: 'calendar', action: 'today' },
      { id: 'overview', label: 'Overview', icon: 'chart', action: 'overview' },
      { id: 'list-all', label: 'All Tasks', icon: 'list', action: 'list-all' },
      { id: 'in-progress', label: `In Progress (${stats.IN_PROGRESS})`, icon: 'progress', action: 'list-in-progress' },
      { id: 'help', label: 'Help', icon: 'help', action: 'help' }
    ]
  }

  return [
    { id: 'today-plan', label: '今日计划', icon: 'calendar', action: 'today' },
    { id: 'overview', label: '概览', icon: 'chart', action: 'overview' },
    { id: 'list-all', label: '全部任务', icon: 'list', action: 'list-all' },
    { id: 'in-progress', label: `进行中 (${stats.IN_PROGRESS})`, icon: 'progress', action: 'list-in-progress' },
    { id: 'help', label: '帮助', icon: 'help', action: 'help' }
  ]
}
