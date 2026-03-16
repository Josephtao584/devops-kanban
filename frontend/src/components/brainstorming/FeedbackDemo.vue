<template>
  <div class="feedback-demo-container">
    <h2>💬 头脑风暴 - 用户反馈演示</h2>
    <p class="demo-hint">点击预设按钮或输入自定义意见，查看 AI 如何重新生成结论</p>

    <!-- 原始结论 -->
    <div class="original-conclusion">
      <h3>📋 原始结论</h3>
      <div class="conclusion-content" v-html="originalConclusion"></div>
    </div>

    <!-- 预设反馈按钮 -->
    <div class="preset-feedback">
      <h4>💡 预设反馈（点击测试）</h4>
      <div class="feedback-buttons">
        <el-button
          v-for="(example, index) in demoExamples"
          :key="index"
          @click="selectFeedback(example.text)"
          size="small"
        >
          {{ example.label }}
        </el-button>
      </div>
    </div>

    <!-- 用户输入框 -->
    <div class="user-input-section">
      <h4>✍️ 或输入您的自定义意见</h4>
      <el-input
        v-model="userFeedback"
        type="textarea"
        :rows="3"
        placeholder="请输入您的意见，例如：我们预算有限，希望能控制成本..."
        clearable
      />
      <div class="input-actions">
        <el-button
          type="primary"
          :disabled="!userFeedback.trim() || isRegenerating"
          @click="handleRegenerate"
        >
          <el-icon v-if="isRegenerating"><Loading /></el-icon>
          {{ isRegenerating ? '重新生成中...' : '🔄 重新生成结论' }}
        </el-button>
        <el-button @click="clearFeedback">清空</el-button>
      </div>
    </div>

    <!-- 重新生成后的结论 -->
    <div v-if="regeneratedConclusion" class="regenerated-conclusion">
      <h3>✨ 重新生成后的结论</h3>
      <div class="conclusion-content" v-html="regeneratedConclusion"></div>
      <div class="conclusion-actions">
        <el-button type="success" @click="acceptConclusion">✅ 采用此结论</el-button>
        <el-button @click="regenerateAgain">🔁 再次修改</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { integrateUserFeedback, demoFeedbackExamples } from '@/mock/brainstormingFeedbackDemo'

// 原始结论（模拟头脑风暴完成后的结论）
const originalConclusion = `### 综合结论

#### 1. 技术选型
| 层次 | 技术栈 |
|------|--------|
| 前端 | Vue 3 + Element Plus |
| 后端 | Spring Boot 3.x |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis |

#### 2. 工期估算
- 需求分析：1 人日
- 后端开发：3 人日
- 前端开发：2 人日
- 测试验收：1 人日
- **总计：7 人日**

#### 3. 风险评估
| 风险项 | 等级 | 应对措施 |
|--------|------|----------|
| 需求变更 | 中 | 敏捷迭代，及时沟通 |
| 技术难点 | 低 | 提前技术预研 |
| 人员依赖 | 低 | 代码 Review，知识共享 |

#### 4. 关键注意点
1. **先设计后开发**：完成 API 接口定义后再开始编码
2. **测试驱动**：核心功能先写测试用例
3. **代码 Review**：所有代码必须经过 Review 才能合并
4. **文档同步**：及时更新 API 文档和使用说明`

// 用户反馈
const userFeedback = ref('')

// 重新生成状态
const isRegenerating = ref(false)

// 重新生成后的结论
const regeneratedConclusion = ref('')

// 选择预设反馈
const selectFeedback = (text) => {
  userFeedback.value = text
}

// 处理重新生成
const handleRegenerate = async () => {
  if (!userFeedback.value.trim()) return

  isRegenerating.value = true

  // 模拟 AI 生成延迟
  await new Promise(resolve => setTimeout(resolve, 1500))

  // 调用整合函数
  regeneratedConclusion.value = integrateUserFeedback(
    userFeedback.value,
    originalConclusion
  )

  isRegenerating.value = false
}

// 清空反馈
const clearFeedback = () => {
  userFeedback.value = ''
  regeneratedConclusion.value = ''
}

// 采用结论
const acceptConclusion = () => {
  // 实际使用时，这里会将结论传递回父组件
  console.log('用户采用了重新生成的结论')
}

// 再次修改
const regenerateAgain = () => {
  regeneratedConclusion.value = ''
  userFeedback.value = ''
}

// 导出示例数据供外部使用
const demoExamples = demoFeedbackExamples
</script>

<style scoped>
.feedback-demo-container {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.demo-hint {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 24px;
}

h2 {
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

h3 {
  color: var(--el-text-color-primary);
  font-size: 16px;
  margin: 16px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color);
}

h4 {
  color: var(--el-text-color-regular);
  font-size: 14px;
  margin: 16px 0 8px;
}

/* 原始结论 */
.original-conclusion {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.conclusion-content {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

.conclusion-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.conclusion-content :deep(th),
.conclusion-content :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 6px 10px;
  text-align: left;
}

.conclusion-content :deep(th) {
  background: var(--el-fill-color);
  font-weight: 600;
}

.conclusion-content :deep(ul),
.conclusion-content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.conclusion-content :deep(li) {
  margin-bottom: 4px;
}

.conclusion-content :deep(code) {
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.conclusion-content :deep(pre) {
  background: var(--el-fill-color);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

/* 预设反馈按钮 */
.preset-feedback {
  background: var(--el-bg-color-page);
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.feedback-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 用户输入区域 */
.user-input-section {
  margin-bottom: 20px;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

/* 重新生成后的结论 */
.regenerated-conclusion {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 2px solid #86efac;
  border-radius: 8px;
  padding: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.conclusion-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(134, 239, 172, 0.5);
}

/* 用户反馈引用块 */
.regenerated-conclusion :deep(blockquote) {
  border-left: 3px solid var(--el-color-primary);
  padding-left: 12px;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.6);
  padding: 8px 12px;
  border-radius: 0 4px 4px 0;
}
</style>
