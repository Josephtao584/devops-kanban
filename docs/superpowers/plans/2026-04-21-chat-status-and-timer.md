# Chat Status & Timer Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance AgentChatPanel to show "运行中" main status with a real-time MM:SS timer during agent execution, while preserving the existing "思考中..." bottom indicator.

**Architecture:** Modify the existing `AgentChatPanel.vue` component to add timer state management (refs + setInterval) and update the header badge. Add one i18n key to `zh.js`. No backend changes.

**Tech Stack:** Vue 3 Composition API, vue-i18n

**Spec:** `docs/superpowers/specs/2026-04-21-chat-status-and-timer-design.md`

---

### Task 1: Add i18n key for "运行中"

**Files:**
- Modify: `frontend/src/locales/zh.js:500-501`

- [ ] **Step 1: Add `chatRunning` key**

In `frontend/src/locales/zh.js`, after line 500 (`chatThinking: '思考中...',`), add:

```javascript
chatRunning: '运行中',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/locales/zh.js
git commit -m "feat(i18n): add chatRunning key for running status display"
```

---

### Task 2: Add timer logic to AgentChatPanel script

**Files:**
- Modify: `frontend/src/components/AgentChatPanel.vue:117-322` (script section)

- [ ] **Step 1: Add timer state declarations**

After line 147 (`let tempIdCounter = -1`), add:

```javascript
// ─── Timer state ─────────────────────────────────────────────────────────────
const elapsedSeconds = ref(0)
let timerInterval = null

function startTimer() {
  stopTimer()
  elapsedSeconds.value = 0
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

const formattedElapsed = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60)
  const secs = elapsedSeconds.value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})
```

- [ ] **Step 2: Call startTimer() in sendMessage()**

In `sendMessage()`, after line 261 (`sessionStatus.value = 'running'`), add:

```javascript
startTimer()
```

- [ ] **Step 3: Call stopTimer() in SSE onDone callback**

In the `onDone` callback (line 281-286), after `sessionStatus.value = 'idle'` (line 282), add:

```javascript
stopTimer()
```

- [ ] **Step 4: Call stopTimer() in SSE onError callback**

In the `onError` callback (line 288-292), after `sessionStatus.value = 'idle'` (line 289), add:

```javascript
stopTimer()
```

- [ ] **Step 5: Reset timer in session lifecycle functions**

In `startNewSession()`, after `sessionStatus.value = 'idle'` (line 236), add:

```javascript
stopTimer()
elapsedSeconds.value = 0
```

In the agent watcher (line 298-314), after `sessionStatus.value = 'idle'` (line 306), add:

```javascript
stopTimer()
elapsedSeconds.value = 0
```

- [ ] **Step 6: Clean up timer in onBeforeUnmount**

In `onBeforeUnmount` (line 316-322), add after the streamController cleanup:

```javascript
stopTimer()
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AgentChatPanel.vue
git commit -m "feat(chat): add timer logic for tracking agent run duration"
```

---

### Task 3: Update template to show "运行中" badge with timer

**Files:**
- Modify: `frontend/src/components/AgentChatPanel.vue:1-14` (template header section)

- [ ] **Step 1: Update running status badge**

Replace lines 8-9:

```html
<span v-if="sessionStatus === 'running'" class="chat-status-badge running">{{ $t('agent.chatThinking') }}</span>
<span v-else-if="sessionStatus === 'idle'" class="chat-status-badge idle">{{ $t('agent.chatReady') }}</span>
```

With:

```html
<span v-if="sessionStatus === 'running'" class="chat-status-badge running">
  {{ $t('agent.chatRunning') }}
  <span class="chat-timer">{{ formattedElapsed }}</span>
</span>
<span v-else-if="sessionStatus === 'idle'" class="chat-status-badge idle">{{ $t('agent.chatReady') }}</span>
```

Note: The bottom thinking indicator (lines 50-55) remains unchanged — it still uses `agent.chatThinking`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentChatPanel.vue
git commit -m "feat(chat): update header badge to show running status with timer"
```

---

### Task 4: Add timer CSS styles

**Files:**
- Modify: `frontend/src/components/AgentChatPanel.vue:369-386` (style section)

- [ ] **Step 1: Add timer styles**

After the `.chat-status-badge.idle` block (line 386), add:

```css
.chat-timer {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  font-size: 10px;
  opacity: 0.85;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentChatPanel.vue
git commit -m "style(chat): add timer display styles with tabular-nums"
```

---

### Task 5: Verify functionality

- [ ] **Step 1: Run frontend build to check for compilation errors**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend && npm run test:run
```

Expected: All existing tests pass.

- [ ] **Step 3: Manual verification checklist**

Verify in browser at `http://localhost:3000`:
1. Navigate to Agents page, select an agent, open chat panel
2. Idle state: badge shows green "就绪", no timer visible
3. Send a message: badge changes to yellow "运行中 00:00" and timer increments each second
4. When agent finishes: badge returns to green "就绪", timer stops
5. Bottom "思考中..." bouncing dots still appear during running
6. Click "新建对话": timer resets, status returns to "就绪"
7. Switch agents: timer resets, status returns to "就绪"

- [ ] **Step 4: Update CLAUDE.md if needed**

No CLAUDE.md update needed — no new API endpoints, no architectural changes.
