/**
 * Generate preset ZIP packages for kanban-template/ directory.
 * Usage: npx tsx scripts/generate-presets.ts
 */
import AdmZip from 'adm-zip';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'kanban-template');
const SKILLS_DIR = resolve(PROJECT_ROOT, 'data', 'skills');

// --- Agent definitions ---
const agents = {
  architect: {
    name: '架构师',
    executorType: 'OPEN_CODE',
    role: 'ARCHITECT',
    description: '负责系统架构设计与技术方案评审',
    enabled: true,
    skillNames: ['superpowers', 'git'],
    mcpServerNames: ['context7', 'github'],
  },
  backend: {
    name: '后端开发',
    executorType: 'OPEN_CODE',
    role: 'BACKEND_DEV',
    description: '负责后端服务开发与接口实现',
    enabled: true,
    skillNames: ['git', 'tdd'],
    mcpServerNames: ['context7', 'github'],
  },
  frontend: {
    name: '前端开发',
    executorType: 'OPEN_CODE',
    role: 'FRONTEND_DEV',
    description: '负责前端页面开发与交互实现',
    enabled: true,
    skillNames: ['git', 'frontend-design', 'playwright'],
    mcpServerNames: ['playwright', 'context7'],
  },
  qa: {
    name: '测试工程师',
    executorType: 'OPEN_CODE',
    role: 'QA_ENGINEER',
    description: '负责测试验证与质量保障',
    enabled: true,
    skillNames: ['playwright', 'tdd', 'git'],
    mcpServerNames: ['playwright', 'context7'],
  },
};

// --- MCP Server definitions ---
const mcpServers = {
  context7: {
    name: 'context7',
    description: '查询库/框架的最新文档和代码示例',
    server_type: 'stdio',
    config: { command: 'npx', args: ['-y', '@anthropic-ai/context7-mcp'] },
    auto_install: 1,
    install_command: 'npm install -g @anthropic-ai/context7-mcp',
  },
  playwright: {
    name: 'playwright',
    description: '浏览器自动化测试，支持页面交互、截图、E2E 测试',
    server_type: 'stdio',
    config: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
    auto_install: 1,
    install_command: 'npm install -g @playwright/mcp',
  },
  github: {
    name: 'github',
    description: 'GitHub 操作：PR、Issue、代码审查',
    server_type: 'stdio',
    config: { command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-github'] },
    auto_install: 1,
    install_command: 'npm install -g @anthropic-ai/mcp-server-github',
  },
};

// --- Skill definitions ---
const skills = {
  git: { identifier: 'git', name: 'Git', description: 'Git 版本控制最佳实践' },
  playwright: { identifier: 'playwright', name: 'Playwright', description: 'E2E 浏览器测试' },
  superpowers: { identifier: 'superpowers', name: 'Superpowers', description: '结构化设计方法论：头脑风暴、方案规划、架构评审、代码审查' },
  tdd: { identifier: 'tdd', name: 'TDD', description: 'TDD 方法论：红绿重构、测试先行设计、最小实现' },
  'frontend-design': { identifier: 'frontend-design', name: 'Frontend Design', description: '前端 UI 开发最佳实践、组件设计模式、响应式布局' },
};

// --- Workflow template definitions (from seed.sql) ---
const templates = {
  'workflow-v1': {
    template_id: 'workflow-v1',
    name: '默认工作流',
    steps: [
      { id: 'solution-design', name: '头脑风暴设计', instructionPrompt: '使用头脑风暴Skill思考。先完成 Spec-Driven 方案设计。必须基于任务上下文输出可直接执行的设计结果，并将设计文档写入 docs：1）明确目标、范围与验收标准；2）梳理用户场景、边界条件与异常场景；3）说明关键约束、依赖与风险；4）给出实现思路、模块改动点与任务拆分；5）定义测试策略、关键测试用例与完成标准；6）列出需要前置确认的问题。最后输出可供下游步骤直接消费的 summary。', agentName: '架构师' },
      { id: 'feature-development', name: '开发实现', instructionPrompt: '基于上游设计文档与 summary，按 TDD 完成开发实现。要求：1）先对齐验收标准与测试用例；2）优先补齐或新增失败测试，再完成实现并让相关测试通过；3）严格按设计范围修改，避免无关改动；4）优先复用现有能力与实现模式；5）必要时同步更新文档、配置或脚本；6）总结核心改动点、影响范围、测试执行结果与遗留问题。最后输出可供测试阶段直接消费的 summary。', agentName: '后端开发' },
      { id: 'qa-validation', name: '测试验证', instructionPrompt: '基于上游设计文档、开发 summary、代码改动与测试结果执行测试验证。至少覆盖：1）验收标准是否全部满足；2）新增或修改测试是否覆盖核心路径、边界场景与异常场景；3）相关回归是否受影响；4）发现的问题、复现方式与影响判断；5）当前结果是否允许进入评审。最后输出可供评审阶段直接消费的 summary。', agentName: '测试工程师' },
      { id: 'final-review', name: '结果评审', instructionPrompt: '基于前序设计文档、各步骤 summary、代码 diff 与测试结果完成最终评审。重点确认：1）实现是否满足规格、范围与验收标准；2）设计、实现与测试是否保持一致；3）测试策略与测试结果是否足以支撑交付；4）是否存在明显质量、安全或可维护性风险；5）是否还有阻塞交付的问题；6）给出明确评审结论与后续处理建议。', agentName: '架构师' },
    ],
  },
  'dev-feature-sdd-tdd-v1': {
    template_id: 'dev-feature-sdd-tdd-v1',
    name: '研发交付：标准功能开发',
    steps: [
      { id: 'feature-sdd-requirement-clarification', name: 'SDD 需求澄清与验收定义', instructionPrompt: '你当前负责标准功能开发交付的 SDD 需求澄清与验收定义阶段。目标：把原始需求整理成可执行的交付说明，明确范围、非目标、验收标准和关键场景。执行要求：1）提炼业务目标、用户价值和成功标准；2）明确范围内内容、范围外内容、依赖前提和待确认问题；3）梳理核心路径、边界场景和异常路径；4）输出下游设计与测试可直接使用的验收定义。禁止事项：1）不要直接进入方案或实现；2）不要忽略边界与非目标；3）不要输出模糊结论。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单（必须列出已产出文档、测试、实现或验证结果）、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
      { id: 'feature-sdd-solution-design', name: 'SDD 方案设计与任务拆解', instructionPrompt: '你当前负责标准功能开发交付的 SDD 方案设计与任务拆解阶段。目标：基于已澄清需求输出可实施方案，并拆出相对独立的阶段边界。执行要求：1）明确模块改动点、接口或数据影响、关键实现路径；2）说明实施顺序、阶段边界、依赖关系和回滚思路；3）输出测试策略与真实前端验证关注点；4）确保下游实现和验证只依赖当前 summary 也能继续执行。禁止事项：1）不要直接写实现代码；2）不要遗漏测试与回滚考虑；3）不要把多个职责混成一个阶段。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
      { id: 'feature-tdd-test-design', name: 'TDD 测试先行设计', instructionPrompt: '你当前负责标准功能开发交付的 TDD 测试先行设计阶段。目标：先定义失败测试、验证范围和通过标准，再进入实现。执行要求：1）列出要先失败的单元测试、集成测试或关键验证点；2）说明核心路径、边界场景、异常场景和回归范围；3）单独列出真实前端验证清单、验证环境和关键交互路径；4）明确哪些内容尚未覆盖。禁止事项：1）不要先写实现再补测试；2）不要把自动化测试通过等同于验收通过；3）不要遗漏真实前端验证要求。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'feature-tdd-minimal-implementation', name: 'TDD 最小实现', instructionPrompt: '你当前负责标准功能开发交付的 TDD 最小实现阶段。目标：基于前序失败测试与方案设计完成最小必要实现。执行要求：1）先对齐验收标准和失败测试，再完成聚焦实现；2）优先复用现有模式，控制改动范围；3）说明通过了哪些验证、还缺哪些验证；4）记录影响范围和遗留问题。禁止事项：1）不要扩展需求；2）不要做无关重构；3）不要省略验证依据。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '后端开发' },
      { id: 'feature-automation-validation', name: '自动化测试与回归验证', instructionPrompt: '你当前负责标准功能开发交付的自动化测试与回归验证阶段。目标：独立确认自动化测试层面的质量结论。执行要求：1）执行核心路径、边界场景、异常场景和必要回归验证；2）区分已验证、未验证、验证失败和环境问题；3）说明测试结果、影响范围和残余风险；4）为真实前端验收提供明确输入。禁止事项：1）不要直接信任开发结论；2）不要把未验证项当作通过；3）不要把自动化测试通过直接视为完整交付通过。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'feature-real-frontend-validation', name: '真实前端验收', instructionPrompt: '你当前负责标准功能开发交付的真实前端验收阶段。目标：在真实页面和真实交互上下文中确认功能可用且满足验收标准。执行要求：1）说明验证环境、页面入口和操作路径；2）验证核心路径、边界交互和异常交互；3）记录页面表现、交互反馈、发现的问题和未覆盖范围；4）明确当前结果是否达到进入交付评审的条件。禁止事项：1）不要仅凭单元测试、集成测试或 mock 结果给通过结论；2）不要忽略 UI/交互问题；3）不要模糊说明验证范围。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'feature-delivery-review', name: '交付评审', instructionPrompt: '你当前负责标准功能开发交付的交付评审阶段。目标：综合需求、设计、实现、自动化验证和真实前端验收结果，判断是否具备交付条件。执行要求：1）检查各阶段结论是否一致、交付物是否齐全；2）区分阻塞问题、重要风险和一般建议；3）明确是否建议继续推进、合入或上线；4）总结后续跟进事项。禁止事项：1）不要只复述上游 summary；2）不要遗漏交付结论；3）不要把风险藏在模糊表述里。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
    ],
  },
  'bugfix-sdd-tdd-v1': {
    template_id: 'bugfix-sdd-tdd-v1',
    name: '研发交付：缺陷修复与防回归',
    steps: [
      { id: 'bugfix-sdd-problem-definition', name: 'SDD 问题澄清与复现定义', instructionPrompt: '你当前负责缺陷修复与防回归交付的 SDD 问题澄清与复现定义阶段。目标：明确问题现象、稳定复现路径、影响范围和修复验收标准。执行要求：1）整理前置条件、复现步骤、预期行为与实际行为；2）识别受影响模块、用户影响和关键回归路径；3）明确修复边界、非目标和待确认问题；4）为根因分析和失败测试设计提供可靠输入。禁止事项：1）不要跳过复现条件；2）不要直接进入修复实现；3）不要模糊描述影响范围。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
      { id: 'bugfix-sdd-root-cause-design', name: 'SDD 根因与修复设计', instructionPrompt: '你当前负责缺陷修复与防回归交付的 SDD 根因与修复设计阶段。目标：基于证据确认根因并输出最小修复方案。执行要求：1）给出根因假设与证据链；2）说明受影响代码、数据或配置路径；3）定义最小修复范围、回滚思路和验证策略；4）为失败测试补齐和最小实现提供清晰输入。禁止事项：1）不要在证据不足时武断定性；2）不要直接进入实现；3）不要遗漏回归风险。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
      { id: 'bugfix-tdd-regression-test-design', name: 'TDD 失败测试补齐', instructionPrompt: '你当前负责缺陷修复与防回归交付的 TDD 失败测试补齐阶段。目标：先用失败测试锁定问题，再进入修复实现。执行要求：1）定义能够稳定暴露原问题的失败测试或缺失验证；2）说明关键回归路径、边界场景和异常场景；3）列出真实前端复现与验收时必须覆盖的操作链路；4）总结当前尚未覆盖的风险。禁止事项：1）不要先修复再补测试；2）不要把无法稳定复现的问题直接判定为已修复；3）不要遗漏真实前端复现要求。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'bugfix-tdd-minimal-fix', name: 'TDD 最小修复实现', instructionPrompt: '你当前负责缺陷修复与防回归交付的 TDD 最小修复实现阶段。目标：在最小必要改动范围内修复问题并控制副作用。执行要求：1）围绕失败测试与根因分析完成最小修复；2）说明修复点、影响范围和潜在副作用；3）确认相关验证是否已通过、哪些验证仍待执行；4）避免无关重构。禁止事项：1）不要扩大修复范围；2）不要跳过防回归考虑；3）不要只说「已修复」而没有验证依据。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '后端开发' },
      { id: 'bugfix-automation-regression-validation', name: '自动化回归验证', instructionPrompt: '你当前负责缺陷修复与防回归交付的自动化回归验证阶段。目标：确认原问题被自动化验证锁住且未引入明显回归。执行要求：1）执行原问题验证、关键回归路径和必要边界场景；2）区分验证通过、验证失败、环境问题和未执行项；3）说明残余风险和是否建议进入真实前端复现验收；4）为后续真实前端验收提供清晰输入。禁止事项：1）不要直接相信开发结论；2）不要把未验证项当作通过；3）不要把自动化回归通过直接等同于问题已彻底关闭。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'bugfix-real-frontend-validation', name: '真实前端复现与验收', instructionPrompt: '你当前负责缺陷修复与防回归交付的真实前端复现与验收阶段。目标：在真实界面中确认原问题无法复现，并检查相邻交互链路。执行要求：1）说明验证环境、页面入口、原始复现路径和新的验证结果；2）确认原问题在真实界面中已不可复现；3）检查相邻功能、边界交互和异常交互是否受影响；4）记录发现的问题、限制和未覆盖范围。禁止事项：1）不要仅凭自动化测试结果给出通过结论；2）不要忽略相邻交互链路；3）不要模糊说明复现和验证过程。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '测试工程师' },
      { id: 'bugfix-delivery-review', name: '修复交付评审', instructionPrompt: '你当前负责缺陷修复与防回归交付的修复交付评审阶段。目标：综合问题澄清、根因设计、失败测试、修复实现、自动化验证和真实前端验收结果，判断当前缺陷是否具备关闭或继续推进条件。执行要求：1）检查修复证据链是否完整、交付物是否齐全；2）区分阻塞问题、重要风险和一般建议；3）明确是否建议关闭问题、合入修复或继续观察；4）总结后续观察项。禁止事项：1）不要只复述前序 summary；2）不要隐藏剩余风险；3）不要缺少最终结论。输出要求：最终只输出 summary，并严格包含以下小节：本步结论（通过/有风险通过/不通过/需补充信息）、已完成内容、交付物清单、未完成或范围外内容、风险与影响、阻塞与待确认问题、给下游步骤的交接建议。', agentName: '架构师' },
    ],
  },
  'frontend-dev-v1': {
    template_id: 'frontend-dev-v1',
    name: '前端开发：通用功能交付',
    steps: [
      { id: 'frontend-requirement-and-prototype', name: '需求分析与原型绘制', instructionPrompt: '理解原始需求，产出可视化原型。交付物：1）需求分析写入 docs/workflow/01-requirement-analysis.md，含交互流程、页面状态矩阵、边界场景和非目标；2）用 ASCII/文字符号绘制关键 UI 状态的可视化原型，直接在回复中输出，展示页面布局和交互变化。注意：ASCII 可视化原型直接输出在回复内容中给用户查看，不要放入 summary。summary 只引用文件路径，不重复内容。', agentName: '前端开发', requiresConfirmation: true },
      { id: 'frontend-solution-design', name: '方案设计', instructionPrompt: '基于上游原型和需求分析，输出可执行的前端技术方案。交付物写入 docs/workflow/02-solution-design.md，含组件结构、状态管理、接口依赖、实施顺序、回退策略和验收标准。不写实现代码，不遗漏空状态和错误态。summary 只引用文件路径。', agentName: '架构师', requiresConfirmation: false },
      { id: 'frontend-test-design', name: '测试先行设计', instructionPrompt: '基于原型和方案，先定义失败测试和页面走查清单。交付物：1）测试用例写入 docs/workflow/03-test-cases.md，含编号、名称、类型、步骤、预期结果和优先级；2）自动化测试代码写在项目测试目录。覆盖核心路径、边界和异常场景。summary 只引用文件路径。', agentName: '测试工程师', requiresConfirmation: true },
      { id: 'frontend-implementation', name: '前端功能实现', instructionPrompt: '基于方案和测试清单，将原型转化为完整功能实现。交付物：1）实现说明写入 docs/workflow/04-implementation-notes.md，含修改文件清单、新增组件、接口变更和关键决策；2）功能代码写在源码目录。替换模拟数据为真实接口，实现完整业务逻辑和异常处理，不扩展需求，不混入无关重构。summary 只引用文件路径。', agentName: '前端开发', requiresConfirmation: false },
      { id: 'frontend-test-execution', name: '测试执行与结果记录', instructionPrompt: '按测试清单逐条执行，记录每条用例结果。交付物写入 docs/workflow/05-test-report.md，含逐条结果表（编号、名称、预期、实际、通过/失败）、失败原因分析、未执行项说明、汇总统计（通过/失败/未执行数）。不跳过用例，不把未执行标为通过。summary 只引用文件路径和汇总数字。', agentName: '测试工程师', requiresConfirmation: false },
      { id: 'frontend-delivery-review', name: '交付评审', instructionPrompt: '综合各阶段交付物和测试结果，判断是否具备交付条件。交付物写入 docs/workflow/06-delivery-review.md，含交付物完整性检查、验收达成情况、测试关键发现、阻塞问题与风险、最终结论。不只复述上游 summary，不隐藏失败风险，给出明确结论。summary 只引用文件路径和评审结论。', agentName: '架构师', requiresConfirmation: true },
    ],
  },
  'repo-explorer': {
    template_id: 'repo-explorer',
    name: '探索代码仓',
    steps: [
      { id: 'explore', name: '代码仓探索', instructionPrompt: '你是一个代码分析专家。请深入分析当前代码仓库，生成一份结构化的介绍报告。\n\n分析内容：\n1. **项目概览**：目录结构、技术栈识别、主要语言统计、README 摘要\n2. **核心模块**：识别核心模块及其职责、入口文件分析\n3. **依赖关系**：主要依赖及其用途、模块间依赖关系\n4. **架构模式**：识别架构模式（MVC、分层架构等）\n\n最终输出格式化的 Markdown 报告，保存到 KANBAN_COMPASS.md 文件中。该文件将作为后续工作流执行的参考文档，其他工作流的 Agent 会读取此文件来了解项目结构。', agentName: '架构师', requiresConfirmation: false },
    ],
  },
};

// --- Preset definitions ---
const presets = [
  {
    filename: 'devops-kanban-full-starter.zip',
    templateIds: ['workflow-v1', 'dev-feature-sdd-tdd-v1', 'bugfix-sdd-tdd-v1', 'frontend-dev-v1', 'repo-explorer'],
    agentKeys: ['architect', 'backend', 'frontend', 'qa'],
    skillKeys: ['git', 'playwright', 'superpowers', 'tdd', 'frontend-design'],
    mcpKeys: ['context7', 'playwright', 'github'],
  },
  {
    filename: 'devops-kanban-default-workflow.zip',
    templateIds: ['workflow-v1'],
    agentKeys: ['architect', 'backend', 'qa'],
    skillKeys: ['git', 'superpowers', 'tdd', 'playwright'],
    mcpKeys: ['context7', 'github', 'playwright'],
  },
  {
    filename: 'devops-kanban-standard-feature-dev-sdd-tdd.zip',
    templateIds: ['dev-feature-sdd-tdd-v1'],
    agentKeys: ['architect', 'backend', 'qa'],
    skillKeys: ['git', 'superpowers', 'tdd', 'playwright'],
    mcpKeys: ['context7', 'github', 'playwright'],
  },
  {
    filename: 'devops-kanban-bugfix-regression-prevention.zip',
    templateIds: ['bugfix-sdd-tdd-v1'],
    agentKeys: ['architect', 'backend', 'qa'],
    skillKeys: ['git', 'superpowers', 'tdd', 'playwright'],
    mcpKeys: ['context7', 'github', 'playwright'],
  },
  {
    filename: 'devops-kanban-frontend-dev-delivery.zip',
    templateIds: ['frontend-dev-v1'],
    agentKeys: ['frontend', 'architect', 'qa'],
    skillKeys: ['git', 'frontend-design', 'playwright', 'superpowers', 'tdd'],
    mcpKeys: ['playwright', 'context7', 'github'],
  },
  {
    filename: 'devops-kanban-code-explorer.zip',
    templateIds: ['repo-explorer'],
    agentKeys: ['architect'],
    skillKeys: ['git', 'superpowers'],
    mcpKeys: ['context7', 'github'],
  },
];

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true })
    .filter((p): p is string => typeof p === 'string');
  return entries.filter(entry => {
    const fullPath = resolve(dir, entry);
    return existsSync(fullPath) && statSync(fullPath).isFile();
  }).map(entry => entry.split(sep).join('/'));
}

function generateBundle(preset: typeof presets[number]): Buffer {
  const bundleData = {
    version: '2.1',
    exportedAt: new Date().toISOString(),
    templates: preset.templateIds.map(id => templates[id as keyof typeof templates]),
    agents: preset.agentKeys.map(key => agents[key as keyof typeof agents]),
    skills: preset.skillKeys.map(key => skills[key as keyof typeof skills]),
    mcpServers: preset.mcpKeys.map(key => mcpServers[key as keyof typeof mcpServers]),
  };

  const zip = new AdmZip();
  zip.addFile('bundle.json', Buffer.from(JSON.stringify(bundleData, null, 2)));

  // Add skill files
  for (const skillKey of preset.skillKeys) {
    const identifier = skills[skillKey as keyof typeof skills].identifier;
    const skillDir = resolve(SKILLS_DIR, identifier);
    if (!existsSync(skillDir)) {
      console.warn(`  Warning: skill directory not found: ${skillDir}`);
      continue;
    }
    const files = listFilesRecursive(skillDir);
    for (const file of files) {
      const fullPath = resolve(skillDir, file);
      const content = readFileSync(fullPath);
      zip.addFile(`skills/${identifier}/${file}`, content);
    }
  }

  return zip.toBuffer();
}

// --- Main ---
console.log('Generating preset ZIP packages...\n');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

for (const preset of presets) {
  console.log(`Generating ${preset.filename}...`);
  const buffer = generateBundle(preset);
  const outputPath = resolve(OUTPUT_DIR, preset.filename);
  writeFileSync(outputPath, buffer);
  console.log(`  -> ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

console.log('\nDone! All preset packages generated in kanban-template/');
