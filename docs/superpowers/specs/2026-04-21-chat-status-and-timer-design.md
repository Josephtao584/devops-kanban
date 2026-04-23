# 对话测试面板：运行状态与计时器增强

## 概述

增强 AgentChatPanel 的状态显示，将运行时状态从单一的「思考中...」改为「运行中」主状态 + 实时计时器，同时保留底部的思考动画指示器。

## 当前状态

- `sessionStatus` ref 有两个值：`'idle'` | `'running'`
- `idle` → 显示绿色徽章「就绪」
- `running` → 显示黄色徽章「思考中...」
- 底部有 bouncing dots 动画指示器（running 时显示）

## 目标状态

| 状态 | 头部徽章 | 计时器 | 底部指示器 |
|------|---------|--------|-----------|
| idle | 🟢 就绪 | 不显示 | 无 |
| running | 🟡 运行中 00:12 | 实时递增 MM:SS | 思考中... bouncing dots（不变） |

## 改动范围

仅前端，不涉及后端改动。

### 1. AgentChatPanel.vue - 模板

- `running` 状态徽章文案：从 `agent.chatThinking` 改为 `agent.chatRunning`
- 徽章右侧追加计时器文本 `{{ formattedElapsed }}`，仅 `running` 时显示
- `idle` 状态徽章保持不变

### 2. AgentChatPanel.vue - 脚本

新增响应式状态：
- `runStartTime: ref<number | null>(null)` — 运行开始时间戳
- `elapsedSeconds: ref<number>(0)` — 已运行秒数

新增变量：
- `timerInterval: ReturnType<typeof setInterval> | null` — 定时器句柄

新增函数：
- `startTimer()` — 记录 `runStartTime = Date.now()`，启动 `setInterval` 每秒更新 `elapsedSeconds`
- `stopTimer()` — 清除 interval，保留最终 `elapsedSeconds` 值

新增计算属性：
- `formattedElapsed` — 将 `elapsedSeconds` 格式化为 `MM:SS`（如 `01:23`）

调用时机：
- `sendMessage()` 中设置 `sessionStatus = 'running'` 时调用 `startTimer()`
- SSE `onDone` 回调中调用 `stopTimer()`
- SSE `onError` 回调中调用 `stopTimer()`
- `onUnmounted` 中清理 interval 防止内存泄漏
- `loadOrCreateSession` / `startNewSession` 中重置计时器状态

### 3. 国际化

新增 key：
- `agent.chatRunning`：中文「运行中」/ 英文 "Running"

保留不变：
- `agent.chatReady`：「就绪」/ "Ready"
- `agent.chatThinking`：「思考中...」/ "Thinking..."（底部指示器继续使用）

### 4. 样式

- 计时器文本使用与徽章一致的颜色，字体使用 `font-variant-numeric: tabular-nums` 防止数字跳动
- 计时器与徽章之间适当间距（`margin-left: 6px`）

## 不改动的部分

- 后端逻辑、API、数据结构
- SSE 流处理逻辑
- 消息渲染、SessionEventRenderer
- 会话生命周期管理
- 底部 bouncing dots 思考指示器
