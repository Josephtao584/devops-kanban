/**
 * 头脑风暴用户反馈演示脚本
 * 用于演示用户输入意见后，AI 重新生成结论的效果
 */

// 用户反馈回应模板库
export const feedbackResponses = {
  // 预算/成本相关
  budget: {
    keywords: ['预算', '成本', '便宜', '免费', '开源', '资金', '经费'],
    response: `
#### 针对预算约束的补充建议

> 💰 **成本优化方案**

感谢您的预算约束说明！基于"控制成本，使用开源方案为主"的要求，我们调整建议如下：

**1. 技术栈（全部开源免费）**
| 组件 | 技术选型 | License | 年成本 |
|------|---------|--------|--------|
| 前端框架 | Vue 3 | MIT | ¥0 |
| UI 组件库 | Element Plus | MIT | ¥0 |
| 后端框架 | Spring Boot | Apache 2.0 | ¥0 |
| 数据库 | MySQL Community | GPL | ¥0 |
| 缓存 | Redis | BSD | ¥0 |
| 操作系统 | Linux (Ubuntu/CentOS) | GPL | ¥0 |

**2. 云资源建议（入门级）**
- 阿里云：经济型 e 系列，约 ¥99/月
- 腾讯云：标准型 S5，约 ¥88/月
- 初期可使用免费试用额度

**3. 总体拥有成本（TCO）估算**
| 项目 | 费用 |
|------|------|
| 软件许可 | ¥0 |
| 云服务器（入门） | ¥1,000-1,500/年 |
| 域名 | ¥60/年 |
| **合计** | **约 ¥1,500/年** |`
  },

  // 性能相关
  performance: {
    keywords: ['性能', '速度', '快', '流畅', '并发', '负载', '压力'],
    response: `
#### 针对性能要求的补充建议

> ⚡ **性能优化方案**

感谢您的性能要求说明！我们补充以下建议：

**1. 性能目标**
- 页面加载时间：< 2 秒
- API 响应时间：< 200ms
- 支持并发用户：1000+

**2. 优化措施**
- 前端：懒加载、代码分割、CDN 加速
- 后端：Redis 缓存、数据库索引优化
- 架构：读写分离、动静分离`
  },

  // 时间/工期相关
  timeline: {
    keywords: ['时间', '工期', '进度', '紧急', '快点', '赶工', 'deadline', '截止'],
    response: `
#### 针对工期要求的补充建议

> ⏰ **快速交付方案**

感谢您的时间约束说明！我们补充以下建议：

**1. 快速交付策略**
- 采用 MVP（最小可行产品）方式，优先交付核心功能
- 并行开发：前后端同时开工
- 每日站会，快速同步进度

**2. 工期压缩建议**
| 原计划 | 压缩后 | 措施 |
|--------|--------|------|
| 7 人日 | 5 人日 | 减少非核心功能 |
| 分阶段 | 一次性 | 增加人力投入 |`
  },

  // 安全相关
  security: {
    keywords: ['安全', '加密', '权限', '防护', '攻击', '漏洞'],
    response: `
#### 针对安全要求的补充建议

> 🔒 **安全加固方案**

感谢您的安全要求说明！我们补充以下建议：

**1. 安全措施清单**
- 输入验证：前端 + 后端双重校验
- SQL 防护：参数化查询，禁用动态 SQL
- 认证授权：JWT + RBAC 权限模型
- 数据加密：敏感数据 AES 加密存储

**2. 安全测试**
- 渗透测试：上线前必做
- 代码审计：关键模块 100% 覆盖`
  },

  // 默认回应
  default: {
    response: `
#### 针对您意见的回应

> 💬 **用户反馈**

感谢您的宝贵意见！我们已经将此建议纳入方案考量，会在后续实施中予以关注。

如有更多细节要求，欢迎随时补充。`
  }
}

/**
 * 根据用户反馈生成回应
 * @param {string} userFeedback - 用户输入的意见
 * @param {string} originalConclusion - 原始结论
 * @returns {string} - 整合后的结论
 */
export const integrateUserFeedback = (userFeedback, originalConclusion) => {
  const feedback = userFeedback.toLowerCase()

  // 匹配关键词找到对应的回应模板
  let responseTemplate = feedbackResponses.default.response

  for (const [key, template] of Object.entries(feedbackResponses)) {
    if (key === 'default') continue

    const hasKeyword = template.keywords?.some(keyword =>
      feedback.includes(keyword.toLowerCase())
    )

    if (hasKeyword) {
      responseTemplate = template.response
      break
    }
  }

  // 拼接完整结论
  return `${originalConclusion}

---

${responseTemplate}`
}

/**
 * 演示数据 - 预设的用户反馈示例
 */
export const demoFeedbackExamples = [
  {
    label: '预算有限',
    text: '我们预算有限，希望能控制成本，使用开源方案为主'
  },
  {
    label: '性能要求高',
    text: '这个系统预计会有高并发访问，性能要求比较高'
  },
  {
    label: '时间紧急',
    text: '老板要求下周必须上线，时间比较紧急'
  },
  {
    label: '安全性重要',
    text: '涉及用户敏感数据，安全性非常重要'
  },
  {
    label: '通用意见',
    text: '希望能简单易用，降低学习成本'
  }
]
