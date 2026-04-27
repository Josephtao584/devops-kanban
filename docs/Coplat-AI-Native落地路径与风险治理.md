# Coplat AI-Native 落地路径与风险治理

---

## 一、当前基础

Coplat 已经实现了 AI-Native 的四个核心 Harness 实践：

- **上下文架构**：任务卡片携带完整上下文，上游步骤摘要自动传递给下游，信息不全的任务不允许启动
- **Agent 专业化**：不同步骤绑定不同 Agent，编码、测试、审查各用最合适的执行者
- **持久化记忆**：每步执行摘要和产出物自动归档，断点可重试，执行过程可回放，模板快照保证运行中不受后续修改影响
- **结构化执行**：每个任务在独立 Git Worktree 中执行，多 Agent 并行互不干扰；关键节点暂停等人确认，审查通过才放行

这是一个可用的 AI-Native 执行底座。下一步要解决的核心问题是：**Agent 的执行边界在哪里，特别是当 Agent 能力延伸到 CI/CD 和生产环境时，如何保证安全可控。**

---

## 二、核心问题：Agent 安全边界

### Agent 的能力边界决定风险边界

AI-Native 的本质是 Agent 替代人做创造性执行。Agent 能力越强，能做的事越多，潜在的风险范围也越大。当 Agent 只是在 Worktree 里写代码，风险是可控的——最坏的结果是代码写错了，人审查时能发现。

但当 Agent 的能力延伸到 CI/CD 流水线，风险性质就变了：

- Agent 触发 CI/CD，可能把未经充分验证的代码推进生产环境
- Agent 修改 CI 配置文件，可能改变整个团队的交付流程
- Agent 使用生产环境凭证，可能对线上系统做出不可逆的变更

**这不是"Agent 写错了代码"的问题，而是"Agent 越过了它应该待的边界"的问题。**

### 当前的边界现状

Coplat 的 Claude Code Executor 以 `--dangerously-skip-permissions` 启动，Agent 在 Worktree 内有完整的文件系统和 shell 执行权限。Worktree 和主仓库共享 `.git` 目录，这意味着：

| Agent 能做的 | 风险 |
|------------|------|
| `git push` 推送到远端 | 未经审查的代码进入远端分支 |
| `gh workflow run` 触发 GitHub Actions | 直接触发 CI/CD，绕过审查 |
| `curl` 调用外部 webhook | 触发部署、通知等外部系统变更 |
| 修改 `.github/workflows/*.yml` | 改变整个团队的 CI/CD 行为 |
| `npm publish` / `docker push` | 直接发布到生产环境 |

**结构化执行的 Worktree 隔离保护了主分支，但没有保护远端和外部系统。**

---

## 三、Harness 实践的延伸：Agent 安全控制

四个 Harness 实践解决的是"Agent 产出质量"的问题。Agent 安全控制是第五个维度——解决的是"Agent 行为边界"的问题。两者是不同层次的工程纪律。

### 实践五：Agent 行为边界 — 划定 Agent 能做什么，不能做什么

**① 工具级别的执行限制**

Claude Code 的 `settings.json` 支持 `disallowedTools` 配置，Coplat 已通过 `settingsPath` 支持 Agent 专属 settings 文件。需要把这个能力做成平台级的配置，而不是手动维护文件：

- Agent 配置页增加工具权限配置，平台工程团队可视化管理每个 Agent 的工具白名单/黑名单
- 内置高风险操作的默认禁止规则：`git push`、`gh workflow run`、`curl` 外部 webhook、`npm publish`、`docker push`
- Skill 声明所需工具权限，平台工程团队审批后才能给 Agent 使用

**② 执行环境的凭证隔离**

Agent 执行环境不注入生产环境的 token 和密钥。CI_TOKEN、DEPLOY_KEY、生产数据库连接串——这些凭证不应该出现在 Agent 的执行环境变量里。Agent 需要的是代码仓库访问权限，不是生产系统操作权限。

**③ 敏感文件保护**

CI 配置文件（`.github/workflows/`、`Jenkinsfile`、`.gitlab-ci.yml`）对 Agent 默认只读。Agent 修改这些文件需要额外的确认步骤，不能静默修改。

---

## 四、CI/CD 集成的正确姿势

### CI/CD 触发权归平台，不归 Agent

Agent 的边界是：在 Worktree 内写代码、写测试、做审查。代码合并、CI 触发、部署发布——这些是平台的职责，由平台在人确认后执行，不是 Agent 的 Bash 命令。

**Workflow 设计原则：**

```
编码步骤（Agent 执行，Worktree 内）
    ↓
测试步骤（Agent 执行，Worktree 内）
    ↓
审查步骤（结构化执行：暂停，人确认产出质量）
    ↓
合并步骤（平台执行 git merge，不经过 Agent）
    ↓
CI 触发步骤（平台调用 CI API，人确认后执行）
    ↓
CI 状态回流（结果同步回 Workflow Timeline）
```

**需要做的：**

1. **新增 CI/CD 触发原生步骤类型**——不走 Agent Executor，走平台直接调用 GitHub Actions API / Jenkins API / GitLab CI API，有完整审计日志
2. **CI 触发步骤强制人工确认**——平台层面强制，不依赖 prompt 约束 Agent 行为
3. **CI 执行状态回流 Workflow Timeline**——从需求到上线形成完整可追溯的执行链路

---

## 五、执行审计：让 Agent 行为可观测

结构化执行已经保证了 Worktree 隔离和关键节点暂停。在此基础上，需要对 Agent 行为做更细粒度的可观测：

- **高风险命令实时告警**：Agent 执行 `git push`、`curl`、发布命令时，实时推送告警给编排者，不等到步骤结束才发现
- **CI/CD 相关操作专项审计**：单独记录，方便事后追溯和合规审查
- **异常模式检测**：Agent 在短时间内执行大量 git 操作或网络请求时，自动触发结构化执行的暂停机制，等人介入

---

## 六、分阶段落地

### 阶段一（近期）

- 为所有 Agent 配置默认 `disallowedTools` settings 文件，禁止 `git push`、`gh workflow run`、`curl` 等高风险命令——利用现有 `settingsPath` 机制，不需要改代码
- 在 Workflow 模板规范中明确：CI/CD 触发不写进 Agent 的 instructionPrompt，由人工在合并后手动触发
- Skill 开发规范：涉及外部系统调用的 Skill 标注风险等级，平台工程团队审批

### 阶段二（中期）

- Agent 配置页增加工具权限 UI，平台工程团队可视化配置
- 新增 CI/CD 触发原生步骤类型，对接 GitHub Actions API
- 高风险命令实时告警，推送到编排者通知中心

### 阶段三（长期）

- CI 执行状态回流 Workflow Timeline，完整交付链路可追溯
- 敏感文件保护（CI 配置文件对 Agent 只读）
- 执行环境凭证隔离（Agent 环境和 CI/CD 凭证环境分离）

---

## 七、核心立场

**AI-Native 的工程纪律不只是保证 Agent 产出质量，还要保证 Agent 行为在可控边界内。**

四个 Harness 实践（上下文架构、Agent 专业化、持久化记忆、结构化执行）解决的是产出质量问题。Agent 安全控制解决的是行为边界问题。两者缺一不可——产出质量好但行为越界，同样会造成不可逆的损失。

Agent 能力越强，边界越重要。不是限制 Agent，而是让 Agent 的能力在正确的轨道上释放。
