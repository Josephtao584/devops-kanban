# 阶段流转自动功能 (Phase Transition)

> 分支: `feature/task-status-auto-flow`
> 提交: `1ac31b6`
> 日期: 2026-03-07

---

## 一、功能概述

实现了任务状态自动流转功能，当 AI Agent 完成当前阶段工作后，系统自动分析输出内容并触发状态流转。

**核心特性:**
- 基于关键词的状态流转
- 支持自动回退（测试失败回退到开发阶段）
- 任务级别开关控制
- WebSocket 实时通知
- 可配置的流转规则

---

## 二、新增文件

**后端:**
| 文件 | 说明 |
|------|------|
| `entity/PhaseTransitionRule.java` | 阶段流转规则实体 (66行) |
| `repository/PhaseTransitionRuleRepository.java` | Repository 接口 (56行) |
| `repository/impl/FilePhaseTransitionRuleRepository.java` | 文件存储实现 (144行) |
| `service/PhaseTransitionService.java` | 核心流转服务 (326行) |
| `controller/PhaseTransitionController.java` | REST API 控制器 (184行) |
| `dto/PhaseTransitionRuleDTO.java` | 数据传输对象 (43行) |
| `data/phase_transition_rules.json` | 默认规则数据 |

**前端:**
| 文件 | 说明 |
|------|------|
| `views/PhaseTransitionConfig.vue` | 规则配置页面 (459行) |
| `api/phaseTransition.js` | API 客户端 (10行) |
| `services/websocket.js` | 新增阶段流转订阅方法 (+77行) |

---

## 三、修改文件

**后端:**
| 文件 | 变更说明 |
|------|----------|
| `entity/Task.java` | 添加 `autoTransitionEnabled` 字段 |
| `entity/Session.java` | 添加 `phaseCompleteSignal` 和 `targetPhase` 字段 |
| `dto/TaskDTO.java` | 添加 `autoTransitionEnabled` 字段 |
| `converter/EntityDTOConverter.java` | 更新 Task/TaskDTO 转换逻辑 |
| `service/HeartbeatMonitor.java` | 集成 PhaseTransitionService |

**前端:**
| 文件 | 变更说明 |
|------|----------|
| `router/index.js` | 添加 `/phase-transitions` 路由 |
| `components/task/TaskForm.vue` | 添加自动流转开关 |
| `locales/zh.js` | 添加阶段流转翻译 (+46行) |
| `locales/en.js` | 添加阶段流转翻译 (+46行) |
| `App.vue` | 添加导航链接 |

---

## 四、默认流转规则

| 源阶段 | 目标阶段 | 完成关键词 | 失败关键词 | 回退阶段 |
|--------|----------|------------|------------|----------|
| TODO | DESIGN | design complete, ready for design | - | - |
| DESIGN | DEVELOPMENT | design approved, implementation complete | - | - |
| DEVELOPMENT | TESTING | code written, ready for testing | - | - |
| TESTING | RELEASE | tests passed, qa approved | tests failed, qa rejected | DEVELOPMENT |
| RELEASE | DONE | deployed, released | deployment failed | TESTING |

---

## 五、架构优化 (代码审查后)

### 5.1 DTO 验证
```java
@NotBlank(message = "Source phase is required")
@Pattern(regexp = "^(TODO|DESIGN|DEVELOPMENT|TESTING|RELEASE|DONE)$")
private String fromPhase;

@Min(value = 1, message = "Priority must be at least 1")
@Max(value = 100, message = "Priority must not exceed 100")
private int priority;
```

### 5.2 Controller 验证
- 添加 `@Valid` 注解到请求体
- 添加 `BindingResult` 错误处理
- 添加源阶段和目标阶段逻辑验证（不能相同）

### 5.3 前端关键词输入优化
- 将 textarea 替换为 `el-select` 多选标签组件
- 支持 `allow-create` 创建新关键词
- 实时预览关键词标签

### 5.4 分页和筛选
- 添加规则列表分页 (5/10/20/50)
- 添加文本搜索和阶段筛选
- 按优先级降序排列

---

## 六、WebSocket 事件

**广播主题:**
- `/topic/task/{taskId}/transition` - 任务特定流转事件
- `/topic/phase-transitions` - 全局流转事件

**事件格式:**
```json
{
  "type": "phase_transition",
  "taskId": 1,
  "sessionId": 1,
  "fromPhase": "DEVELOPMENT",
  "toPhase": "TESTING",
  "reason": "Completion keyword detected: ready for testing",
  "isRollback": false,
  "timestamp": 1709800000000
}
```

**前端订阅方法:**
```javascript
wsService.subscribeToPhaseTransition(taskId, callback)
wsService.subscribeToAllPhaseTransitions(callback)
wsService.unsubscribeFromPhaseTransition(taskId)
```

---

## 七、验证清单

- [x] 前端构建成功
- [x] 后端 DTO 验证
- [x] 后端 Controller 验证
- [x] 国际化翻译完整
- [x] WebSocket 订阅方法
- [x] 分页支持
- [x] 标签输入组件

---

## 八、构建验证

**前端构建:** ✅ 成功
```
✓ 1692 modules transformed
✓ built in 2.94s
PhaseTransitionConfig.js: 11.03 KB
```

---

## 九、测试建议

1. 创建任务，验证"自动流转"开关显示
2. 访问阶段流转配置页面 `/phase-transitions`
3. 测试规则 CRUD 操作
4. 测试标签输入关键词功能
5. 测试分页和筛选
6. 模拟 AI 输出包含关键词，验证自动流转
7. 测试 WebSocket 事件广播

---

## 十、风险点分析

### 10.1 🔴 关键词误触发风险 ⚠️ **高风险**

**问题描述:**
- AI 输出中可能包含"tests passed"等关键词，但实际并未完成测试
- 例如："I see that tests passed before, but now they fail..."

**影响范围:**
- 任务可能被错误地自动流转到下一阶段
- 影响 `PhaseTransitionService.analyzeAndTransition()` 方法

**缓解措施:**
- [x] 添加任务级别开关 `autoTransitionEnabled`，允许用户禁用自动流转
- [ ] **建议**: 添加关键词上下文分析（检查关键词前后是否为否定句）
- [ ] **建议**: 添加 AI 输出结构化标记（如 `[PHASE_COMPLETE:TESTING]`）
- [ ] **建议**: 添加流转确认机制（WebSocket 通知 + 手动确认）

---

### 10.2 🟡 循环依赖风险 ⚠️ **中风险**

**问题描述:**
- `HeartbeatMonitor` 通过 `@Autowired` setter 注入 `PhaseTransitionService`
- 这表明存在潜在的循环依赖

**代码位置:**
```java
// HeartbeatMonitor.java:25-36
@Autowired
public void setPhaseTransitionService(PhaseTransitionService phaseTransitionService) {
    this.phaseTransitionService = phaseTransitionService;
}
```

**影响范围:**
- 可能导致 Spring 容器初始化失败
- 如果 `PhaseTransitionService` 注入失败，静默跳过阶段流转

**缓解措施:**
- [x] 使用 setter 延迟注入避免循环依赖
- [ ] **建议**: 提取公共依赖到独立服务，重构消除循环依赖

---

### 10.3 🟡 并发流转风险 ⚠️ **中风险**

**问题描述:**
- 多个 Session 同时处理同一任务可能导致并发流转
- `PhaseTransitionService.executeTransition()` 没有事务保护

**代码位置:**
```java
// PhaseTransitionService.java:172-189
private void executeTransition(Task task, TransitionResult result, Session session) {
    task.setStatus(newStatus);
    taskRepository.save(task);  // 无乐观锁
}
```

**影响范围:**
- 任务可能被多次流转
- 状态可能不一致

**缓解措施:**
- [ ] **建议**: 添加 `@Transactional` 注解
- [ ] **建议**: 为 Task 实体添加 `@Version` 字段实现乐观锁
- [ ] **建议**: 添加分布式锁（如 Redis）或数据库行锁

---

### 10.4 🟡 关键词 JSON 解析异常 ⚠️ **中风险**

**问题描述:**
- `PhaseTransitionRule` 的 `completionKeywords` 和 `failureKeywords` 存储为 JSON 字符串
- 如果 JSON 格式错误，`parseKeywords()` 返回空列表，静默失败

**代码位置:**
```java
// PhaseTransitionService.java:214-224
private List<String> parseKeywords(String keywordsJson) {
    try {
        return objectMapper.readValue(keywordsJson, ...);
    } catch (Exception e) {
        log.warn("Failed to parse keywords: {}", keywordsJson, e);
        return List.of();  // 静默返回空列表
    }
}
```

**影响范围:**
- 规则配置错误时，不会触发任何流转
- 用户可能不知道规则配置有问题

**缓解措施:**
- [x] 前端使用标签选择器，避免手动输入 JSON
- [ ] **建议**: 添加规则配置验证 API（保存前校验 JSON 格式）
- [ ] **建议**: 后端使用 `List<String>` 类型 + 自定义 JSON 序列化器

---

### 10.5 🟢 静默异常风险 ⚠️ **低风险**

**问题描述:**
- `FilePhaseTransitionRuleRepository.readAll()` 捕获 IOException 后返回空列表
- 文件损坏时静默失败

**代码位置:**
```java
// FilePhaseTransitionRuleRepository.java
protected List<PhaseTransitionRule> readAll() {
    try {
        return mapper.readValue(file, ...);
    } catch (IOException e) {
        return new ArrayList<>();  // 静默返回空列表
    }
}
```

**影响范围:**
- 规则文件损坏时，所有规则丢失，无警告
- 系统会自动初始化默认规则，可能覆盖手动配置

**缓解措施:**
- [x] 使用原子文件写入（temp file + atomic rename）
- [ ] **建议**: 添加文件完整性校验（如 MD5）
- [ ] **建议**: 添加备份机制（保留历史版本）

---

### 10.6 🟢 WebSocket 连接断开 ⚠️ **低风险**

**问题描述:**
- 前端 WebSocket 断开时，阶段流转事件无法接收
- 看板视图可能显示过期状态

**影响范围:**
- 用户界面状态不同步
- 需要手动刷新页面

**缓解措施:**
- [x] WebSocket 服务有重连机制
- [ ] **建议**: 添加事件持久化（存储最近 N 条流转记录）
- [ ] **建议**: 页面重连时自动同步状态

---

### 10.7 🟢 前端未集成 WebSocket 订阅 ⚠️ **低风险**

**问题描述:**
- `KanbanView.vue` 未订阅 `/topic/phase-transitions` 主题
- 阶段流转后，看板视图不会实时更新

**影响范围:**
- 用户需要手动刷新页面查看最新状态

**缓解措施:**
- [x] WebSocket 服务已添加订阅方法
- [ ] **建议**: 在 KanbanView 中集成 WebSocket 订阅

---

## 十一、建议优先级

| 优先级 | 风险项 | 建议措施 |
|--------|--------|----------|
| 🔴 P0 | 关键词误触发 | 添加 AI 输出结构化标记 |
| 🟡 P1 | 并发流转 | 添加 `@Transactional` + 乐观锁 |
| 🟡 P1 | 循环依赖 | 重构消除循环依赖 |
| 🟡 P2 | JSON 解析异常 | 添加规则配置验证 API |
| 🟢 P3 | WebSocket 实时更新 | KanbanView 集成订阅 |
| 🟢 P3 | 文件备份 | 添加历史版本备份 |

---

## 十二、变更统计

```
20 files changed, 1656 insertions(+), 3 deletions(-)
```
