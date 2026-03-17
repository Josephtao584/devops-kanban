// 任务管家回复规则 - 关键词匹配
export const butlerResponses = {
  // 启动相关
  '启动': { action: 'start', response: '好的，我正在为您启动任务工作流...' },
  '开始': { action: 'start', response: '收到，任务工作流已开始执行。' },

  // 暂停相关
  '暂停': { action: 'pause', response: '已暂停当前工作流。' },
  '停止': { action: 'stop', response: '工作流已停止。' },

  // 状态查询 - 将由 getDetailedWorkflowStatus 处理
  '进度': { action: 'status', response: '__DETAILED_PROGRESS__' },
  '状态': { action: 'status', response: '__DETAILED_PROGRESS__' },
  '怎么样': { action: 'status', response: '__DETAILED_PROGRESS__' },

  // 工作建议
  '建议': { action: 'task-suggestions', response: '__TASK_SUGGESTIONS__' },
  '工作建议': { action: 'task-suggestions', response: '__TASK_SUGGESTIONS__' },

  // 继续执行
  '继续': { action: 'continue', response: '好的，正在继续执行工作流...' },

  // 重试
  '重试': { action: 'retry', response: '好的，正在重试当前节点...' },

  // 查看详情
  '详情': { action: 'details', response: '让我为您查看任务详情...\n\n任务名称: {taskTitle}\n状态: {status}\n进度: {progress}%\n当前阶段: {currentNode}' },

  // 帮助
  '帮助': { action: 'help', response: '我可以帮您：\n• 启动任务 - 说"启动"或"开始"\n• 暂停任务 - 说"暂停"\n• 查看进度 - 说"进度"或"状态"\n• 头脑风暴 - 说"头脑风暴"或"讨论"\n• 查看详情 - 说"详情"\n• 继续执行 - 说"继续"\n• 重试 - 说"重试"' },

  // 问候
  '你好': { action: 'greet', response: '您好！我是小捷，有什么可以帮您的吗？' },

  // 头脑风暴
  '头脑风暴': { action: 'brainstorm', response: '__BRAINSTORM__' },
  '讨论': { action: 'brainstorm', response: '__BRAINSTORM__' },
}

// 获取工作流详细执行状态
export const getDetailedWorkflowStatus = (workflow, task) => {
  if (!workflow || !workflow.stages || workflow.stages.length === 0) {
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
      name: stage.name || `阶段 ${stageIndex + 1}`,
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
export const getButlerWelcomeMessage = (taskTitle) => {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `嗨！我是**小捷** - ${taskTitle} 🤖

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
export const processButlerInput = (input, task, workflow) => {
  const lowerInput = input.trim()

  // 匹配关键词并返回对应操作
  for (const [keyword, config] of Object.entries(butlerResponses)) {
    if (lowerInput.includes(keyword)) {
      // 特殊处理进度查询，返回详细信息
      if (config.response === '__DETAILED_PROGRESS__') {
        return {
          action: config.action,
          response: getDetailedWorkflowStatus(workflow, task)
        }
      }

      // 特殊处理任务建议
      if (config.response === '__TASK_SUGGESTIONS__') {
        return getTaskWorkSuggestions(task, workflow)
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
  return {
    action: 'unknown',
    response: '抱歉，我没有理解您的意思。请说 "帮助" 查看我可以做什么。'
  }
}

// 获取快捷操作按钮配置
export const getQuickActions = (task, workflow) => {
  const progress = getWorkflowProgress(workflow)
  const isRunning = task?.status === 'IN_PROGRESS'
  const isCompleted = task?.status === 'DONE'
  const isPending = task?.status === 'TODO'

  return [
    { id: 'start', label: '启动', icon: 'play', disabled: isRunning || isCompleted, action: 'start' },
    { id: 'pause', label: '暂停', icon: 'pause', disabled: !isRunning, action: 'pause' },
    { id: 'progress', label: '进度', icon: 'chart', disabled: false, action: 'status' },
    { id: 'brainstorm', label: '头脑风暴', icon: 'brain', disabled: false, action: 'brainstorm' },
    { id: 'help', label: '帮助', icon: 'help', disabled: false, action: 'help' }
  ]
}

// 根据操作获取响应
export const getResponseForAction = (action, task, workflow) => {
  // 特殊处理进度查询
  if (action === 'status') {
    return {
      action: 'status',
      response: getDetailedWorkflowStatus(workflow, task)
    }
  }

  // 特殊处理任务建议
  if (action === 'task-suggestions' || action === 'suggestions') {
    return getTaskWorkSuggestions(task, workflow)
  }

  // 特殊处理头脑风暴
  if (action === 'brainstorm') {
    return {
      action: 'brainstorm',
      response: '好的，我来为您召唤头脑风暴会议！\n\n🧠 正在邀请参与者...\n• 架构师 🧔\n• 产品经理 🧑‍💼\n• 开发团队 🧑‍💻\n• 测试工程师 👩‍🔬\n\n准备开始多角色讨论...'
    }
  }

  // 找到对应的响应模板
  const keywordMap = {
    'start': ['启动', '开始'],
    'pause': ['暂停'],
    'help': ['帮助'],
    'continue': ['继续'],
    'retry': ['重试'],
    'details': ['详情']
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
  return processButlerInput(action, task, workflow)
}

// 单任务工作建议
export const getTaskWorkSuggestions = (task, workflow) => {
  if (!task) {
    return { action: 'task-suggestions', response: '请先选择一个任务。' }
  }

  const progress = getWorkflowProgress(workflow)
  const currentNode = getCurrentNodeName(workflow)

  let message = `💡 **任务建议**\n\n`
  message += `**任务:** ${task.title}\n`
  message += `**状态:** ${task.status}\n`
  message += `**进度:** ${progress}%\n\n`

  message += `**建议：**\n\n`

  if (task.status === 'TODO') {
    message += `1. 🚀 准备好了吗？说"**启动**"开始执行工作流。\n`
    message += `2. 📋 请先查看任务详情，确保需求清晰。\n`
    message += `3. ⏰ 开始前预估一下完成时间。\n`
  } else if (task.status === 'IN_PROGRESS') {
    message += `1. 📍 当前阶段：**${currentNode}**\n`
    message += `2. 🔄 保持势头！说"**进度**"查看详细信息。\n`
    if (progress < 50) {
      message += `3. ⚡ 专注于完成早期阶段，建立势头。\n`
    } else if (progress < 80) {
      message += `3. 🎯 进展顺利，继续保持！\n`
    } else {
      message += `3. 🏁 就快完成了！冲刺完成剩余步骤。\n`
    }
  } else if (task.status === 'DONE') {
    message += `1. ✅ 任务已成功完成！\n`
    message += `2. 📝 可以总结一下经验教训。\n`
    message += `3. 🔗 检查是否有依赖的任务可以启动。\n`
  } else if (task.status === 'BLOCKED') {
    message += `1. 🚫 任务被阻塞。请识别并解决阻塞问题。\n`
    message += `2. 💬 与团队成员沟通阻塞原因。\n`
    message += `3. 🔄 问题解决后，说"**继续**"恢复工作。\n`
  }

  message += `\n---\n`
  message += `说"**帮助**"查看更多命令。`

  return { action: 'task-suggestions', response: message }
}

