# Kanban Diff Viewer Style Unification Design

**Date:** 2026-03-25

## Goal
让 `TaskDetail.vue` 中的“代码变更”弹窗与 `CommitDialog.vue` 中的 diff 展示区域保持一致；其中 kanban 差异页明确参考提交页的表现，但继续保持只读身份，不引入提交相关交互。

## Confirmed Decisions
- 用户要求两个页面保持一致。
- 用户选择“几乎完全复用提交页外观”。
- 采用共享 diff 展示块的方案，而不是只拷贝 CSS 或直接复用整个 `CommitDialog`。
- `TaskDetail` 保持只读差异查看。
- `CommitDialog` 保留现有提交能力。

## Scope
### In scope
- 提取一个共享 diff 展示组件，统一左右分栏结构、头部、统计区、文件列表项、diff 行样式、空态、loading 态。
- `CommitDialog.vue` 复用共享组件，并保留提交输入区与提交操作。
- `TaskDetail.vue` 的差异弹窗复用共享组件，仅显示查看态。
- 补充最小回归测试，覆盖共享结构与模式差异。

### Out of scope
- 不修改后端 diff 数据结构。
- 不修改 merge 弹窗、workflow 时间线、session 终端等其他弹窗。
- 不做额外 UI 全局主题重构。
- 不改变提交/查看差异的业务流程。
- 不改 `TaskDetail` 表单主体、merge dialog、session 区域或其他 modal 布局，除非只是为了接入共享 viewer。

## Existing Context
### Current commit dialog
`frontend/src/components/CommitDialog.vue` 已经实现了更完整的 diff UI：
- 左侧文件面板带标题、计数、文件卡片、状态标签。
- 右侧 diff 面板带标题、当前文件路径、增删统计、彩色行级 diff。
- 底部单独有提交输入框和操作按钮。

### Current task detail diff dialog
`frontend/src/components/TaskDetail.vue` 当前差异弹窗仍是较旧样式：
- 顶部是总增删统计 tag。
- 左侧是简单文件列表。
- 右侧是 `pre.diff-content` 原始文本展示。
- 视觉结构与 `CommitDialog` 差异明显。
- 当前打开流程是请求完成后再打开弹窗，因此还没有与提交页一致的弹窗内 loading 态。

## Design
### New shared component
Create:
- `frontend/src/components/GitDiffViewer.vue`

Responsibility:
- 只负责 diff 展示，不包含提交、merge、路由或 API 请求。
- 只接收父组件已经整理好的展示数据。
- 只负责渲染统一的视觉结构与切换交互。

Hard boundaries:
- `GitDiffViewer.vue` 不得直接 import 或调用 `commit`、`getUncommittedChanges`、`getDiff`、merge API、task API、router。
- `TaskDetail.vue` 只拥有只读查看状态，不拥有多选或提交状态。
- `CommitDialog.vue` 独占多文件勾选状态、提交文案、提交动作。
- `TaskDetail` 差异弹窗不得暴露批量勾选、提交入口、提交快捷键或其他变更型交互。

### Normalized view model
共享 viewer 不直接吃原始接口响应，而是吃父组件整理后的统一 view model。

Create a normalized item shape used by both callers:
- `path: string`
- `displayName: string`
- `status: 'modified' | 'added' | 'deleted' | 'untracked'`
- `additions: number`
- `deletions: number`
- `selected?: boolean`

Selection rule:
- 当 `selectable = true` 时，`selected` 对每个 `fileItems` 项为必备字段。
- 当 `selectable = false` 时，`selected` 被忽略。

Normalization ownership:
- `CommitDialog.vue` 负责把 `changes` 与 `diffData.files` 合并成统一 `fileItems`
- `TaskDetail.vue` 负责把 `diffData.files` 映射成统一 `fileItems`
- 状态值的归一化由父组件完成，共享 viewer 只消费归一化后的值。

Status normalization table:
- `CommitDialog` 来自 `getUncommittedChanges` / `getDiff` 的 `modified` -> `modified`
- `CommitDialog` 来自 `getUncommittedChanges` / `getDiff` 的 `added` -> `added`
- `CommitDialog` 来自 `getUncommittedChanges` / `getDiff` 的 `deleted` -> `deleted`
- `CommitDialog` 来自 `getUncommittedChanges` / `getDiff` 的 `untracked` -> `untracked`
- `TaskDetail` 来自 `getDiff` 的 `modified` -> `modified`
- `TaskDetail` 来自 `getDiff` 的 `added` -> `added`
- `TaskDetail` 来自 `getDiff` 的 `deleted` -> `deleted`
- `TaskDetail` 来自 `getDiff` 的 `untracked` -> `untracked`
- 任何未知状态 -> `modified`，并沿用“修改”视觉样式作为兜底

Rendering mapping:
- `added`：显示“新增”标签与新增色样式
- `modified`：显示“修改”标签与修改色样式
- `deleted`：显示“删除”标签与删除色样式
- `untracked`：在提交页与只读页都按“新增文件”视觉对待，但保持状态值仍为 `untracked`

### Proposed props
组件输入面明确为：
- `fileItems`: 统一后的文件列表
- `diffsByPath`: `Record<string, string>`
- `loading`: 是否正在加载
- `selectedFilePath`: 当前选中文件路径
- `selectable`: 是否显示勾选式文件选择 UI
- `title`: 面板标题，默认“代码差异”

### Proposed emits
状态由父组件持有，viewer 只负责触发事件：
- `update:selectedFilePath`，payload: `string`
- `toggle-file`，payload: `string`（文件 path，仅提交模式使用）
- `select-all`，无参数（仅提交模式使用）
- `deselect-all`，无参数（仅提交模式使用）

Interaction rule:
- 点击文件行只触发 `update:selectedFilePath`
- 只有 checkbox 与“全选/取消全选”控件会触发 `toggle-file` / `select-all` / `deselect-all`

Read-only mode rule:
- 当 `selectable = false` 时，共享 viewer 不显示任何多选 UI，也不触发 `toggle-file` / `select-all` / `deselect-all`

## Mode Behavior
### Commit mode
Used by `CommitDialog.vue`:
- `selectable = true`
- 显示勾选框
- 显示 `selectedCount / totalCount`
- 显示“全选 / 取消全选”操作
- 底部提交输入区和按钮继续由 `CommitDialog.vue` 自己保留
- 允许触发文件勾选相关 emits

### Read-only mode
Used by `TaskDetail.vue` diff dialog:
- `selectable = false`
- 不显示勾选框
- 不显示全选/取消全选
- 文件列表外观、标题、选中态、diff 区样式与提交页保持一致
- footer 只保留关闭按钮
- 不允许触发任何多选或提交相关事件

## Visual Requirements
左/右 diff 展示区域必须由同一个共享组件和同一套样式驱动。允许差异仅限于：
- 外层 dialog 标题
- dialog 宽度
- footer 操作区

共享组件应复用或迁移 `CommitDialog.vue` 现有的这些视觉特征：
- 左右双栏布局
- panel header 渐变背景
- panel title 左侧竖条装饰
- 文件项卡片式选中效果
- 文件状态 tag（新增/修改/删除）
- 右侧顶部当前文件路径 badge
- 增删统计条
- 行级 diff 颜色风格：
  - addition 绿色背景与左侧边线
  - deletion 红色背景与左侧边线
  - hunk 蓝紫色背景与左侧边线
  - header 灰色弱化显示
- 空态和 loading 风格一致

## Data Flow
### CommitDialog.vue
- 继续负责调用：
  - `getUncommittedChanges`
  - `getDiff`
  - `commit`
- 负责把 `changes` 与 `diffData.files` 归一化为 `fileItems`
- 将 `fileItems`、`diffData.diffs`、`selectedFile` 传给 `GitDiffViewer.vue`
- 提交输入框与提交按钮保持在组件底部，不进入共享 viewer
- 仍由 `CommitDialog.vue` 持有勾选状态
- 提交时仍由 `CommitDialog.vue` 基于已勾选文件与提交信息调用提交逻辑

### TaskDetail.vue
- 继续负责调用 `getDiff`
- 负责把 `diffData.files` 归一化为 `fileItems`
- 将 `fileItems`、`diffData.diffs` 与 `selectedDiffFile` 传给 `GitDiffViewer.vue`
- 打开差异弹窗时默认选择首个文件的逻辑保留在 `TaskDetail.vue`
- 为了达到与提交页一致的 loading 体验，`TaskDetail.vue` 需要显式维护 `diffLoading`，并在弹窗打开后把 loading 态传给共享 viewer
- 弹窗应在 `getDiff` resolve 之前先打开，再在弹窗内显示 loading 态

## File Changes
### Create
- `frontend/src/components/GitDiffViewer.vue`
- `frontend/tests/GitDiffViewer.spec.js`
- `frontend/tests/CommitDialog.spec.js`

### Modify
- `frontend/src/components/CommitDialog.vue`
- `frontend/src/components/TaskDetail.vue`
- `frontend/tests/AgentConfig.spec.js`

## Testing Strategy
### Unit/component verification
1. `GitDiffViewer.spec.js` 验证：
   - 渲染统一左右分栏结构
   - 只读模式不显示 checkbox / 全选区
   - 提交模式显示 checkbox / 全选区
   - 文件切换时发出 `update:selectedFilePath`
   - 只读模式不会触发 `toggle-file` / `select-all` / `deselect-all`
2. `CommitDialog.spec.js` 验证：
   - 仍能显示文件列表与 diff 内容
   - 仍显示提交输入框和提交按钮
   - 仍保留提交模式选择控件
   - 仍由 `CommitDialog` 持有提交信息与已勾选文件的提交流程
3. `AgentConfig.spec.js` 中现有 `TaskDetail` 挂载路径扩展验证：
   - 差异弹窗改用共享 viewer 后，显示与提交页同款结构
   - 不显示勾选框、全选区、提交输入区、提交按钮
   - 打开弹窗时先显示 loading，再在数据返回后显示内容
   - 数据返回后默认选择首个文件
   - 保持只读查看行为

### Manual verification
1. 打开任务详情中的“代码变更”弹窗。
2. 对比提交弹窗的 diff 区样式。
3. 确认两边：
   - 左侧文件列表风格一致
   - 右侧 diff 行风格一致
   - 空态一致
   - loading 态一致
4. 确认 `CommitDialog` 可正常提交，`TaskDetail` 仍为只读。

## Risks and Mitigations
### Risk: shared component accidentally absorbs business logic
Mitigation:
- `GitDiffViewer.vue` 只处理展示和交互事件，不直接请求 API，也不包含 commit 行为。

### Risk: CommitDialog regression
Mitigation:
- 保持提交区留在 `CommitDialog.vue`
- 先迁移 viewer，再跑现有提交相关测试

### Risk: style parity drifts later
Mitigation:
- 样式集中在共享组件，而不是两边各维护一份

### Risk: loading parity is only nominal
Mitigation:
- `TaskDetail.vue` 必须补 `diffLoading` 状态，并在弹窗内展示共享 loading UI，而不是只在请求完成后打开弹窗

## Acceptance Criteria
- 左/右 diff 展示区域由同一个共享组件驱动。
- `TaskDetail` 差异弹窗与 `CommitDialog` 的 diff 区使用同一套结构和样式。
- 允许差异仅限于 dialog 壳层和 footer/actions。
- `TaskDetail` 不出现提交输入框、提交按钮、文件勾选框、全选区。
- `TaskDetail` 在 diff 请求未完成时，弹窗内显示共享 loading UI。
- `CommitDialog` 保持现有提交功能。
- 回归测试通过。
