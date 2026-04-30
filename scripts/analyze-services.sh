#!/bin/bash
# 微服务架构分析脚本
# 用法: ./analyze-services.sh [services.csv]
# 依赖: git, claude (Claude Code CLI)

set -e

WORK_DIR="$(pwd)/service-analysis"
OUTPUT_DIR="$WORK_DIR/profiles"
REPOS_DIR="$WORK_DIR/repos"
SUMMARY_FILE="$WORK_DIR/architecture.yaml"
CSV_FILE="${1:-services.csv}"

if [ ! -f "$CSV_FILE" ]; then
  echo "错误: 找不到 $CSV_FILE"
  echo "用法: ./analyze-services.sh [services.csv]"
  echo "请参考 services.csv.example 创建你的 services.csv"
  exit 1
fi

mkdir -p "$OUTPUT_DIR" "$REPOS_DIR"

PROMPT='你是一个代码架构分析师。请分析当前代码仓库，输出纯 YAML（不要用 ```yaml 包裹，直接输出 YAML 内容）。
只基于代码中实际存在的内容，找不到的字段填 null。

name: {服务名}
type: frontend | backend | bff | gateway
tech_stack:
  framework:
  language:
  key_dependencies: []
description: # 一句话说清楚这个服务做什么
domain: # 业务领域，如：交易、用户、营销、基础设施
owns_tables: []        # 后端：数据库表（从 migration/entity/model 提取）
owns_stores: []        # 前端：状态管理模块（从 store 目录提取）
apis: []               # 后端：暴露的路由（方法 + 路径），不列框架自带的如 /health /actuator
pages: []              # 前端：路由页面（路径 + 用途）
depends_on:            # 从 HTTP 调用、Feign、API 导入等提取，只列内部微服务
  - service:
    reason:
consumes_mq: []
produces_mq: []
external_integrations: []  # 第三方服务：支付宝、微信、OSS、短信等

分析步骤：
1. 找配置文件（package.json / pom.xml / build.gradle / go.mod）确定技术栈
2. 找路由定义提取 API 或页面路由
3. 找数据模型/实体定义提取表名或 store 模块
4. 全局搜索 HTTP 调用（axios/fetch/RestTemplate/Feign/HttpClient）提取服务间依赖
5. 搜索 MQ 相关代码（KafkaListener/RabbitListener/consumer/producer/subscribe/publish）
6. 搜索第三方 SDK 调用

注意：
- depends_on 只列内部微服务间的调用，第三方放 external_integrations
- 前端的 depends_on 从 API 调用地址反推对应的后端服务
- 如果无法确定某个调用对应哪个服务，在 reason 里写明调用地址'

SUCCESS=0
FAIL=0
SKIP=0

echo "========================================="
echo "  微服务架构分析"
echo "========================================="
echo "输入文件: $CSV_FILE"
echo "工作目录: $WORK_DIR"
echo ""

tail -n +2 "$CSV_FILE" | while IFS=',' read -r name type repo; do
  # 去除空白
  name=$(echo "$name" | xargs)
  type=$(echo "$type" | xargs)
  repo=$(echo "$repo" | xargs)

  # 跳过空行
  [ -z "$name" ] && continue

  echo "--- [$name] ($type) ---"

  # clone
  REPO_PATH="$REPOS_DIR/$name"
  if [ -d "$REPO_PATH" ]; then
    echo "  已存在，跳过 clone"
  else
    echo "  正在 clone..."
    if ! git clone --depth 1 "$repo" "$REPO_PATH" 2>/dev/null; then
      echo "  [失败] clone 失败，跳过"
      FAIL=$((FAIL + 1))
      continue
    fi
  fi

  # 如果已有分析结果，跳过（支持断点续跑）
  if [ -f "$OUTPUT_DIR/${name}.yaml" ]; then
    echo "  已有分析结果，跳过（删除 $OUTPUT_DIR/${name}.yaml 可重新分析）"
    SKIP=$((SKIP + 1))
    continue
  fi

  # 用 Claude Code 分析
  echo "  正在分析（可能需要 1-2 分钟）..."
  CURRENT_DIR=$(pwd)
  cd "$REPO_PATH"

  if claude -p "$PROMPT" --output-file "$OUTPUT_DIR/${name}.yaml" 2>/dev/null; then
    echo "  [完成] → profiles/${name}.yaml"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  [失败] Claude 分析出错"
    FAIL=$((FAIL + 1))
  fi

  cd "$CURRENT_DIR"
  echo ""
done

# === 汇总 ===
echo "========================================="
echo "  汇总所有服务画像"
echo "========================================="

PROFILE_COUNT=$(ls "$OUTPUT_DIR"/*.yaml 2>/dev/null | wc -l | xargs)

if [ "$PROFILE_COUNT" -eq 0 ]; then
  echo "没有生成任何服务画像，跳过汇总"
  exit 1
fi

cat > "$SUMMARY_FILE" << EOF
# 微服务架构全景
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# 服务总数: $PROFILE_COUNT
# 用途: 作为 LLM 上下文，用于需求分析时定位涉及的微服务

services:
EOF

for f in "$OUTPUT_DIR"/*.yaml; do
  if [ -f "$f" ]; then
    SERVICE_NAME=$(basename "$f" .yaml)
    echo "" >> "$SUMMARY_FILE"
    echo "  # -------- $SERVICE_NAME --------" >> "$SUMMARY_FILE"
    # 缩进两个空格作为 services 的子项
    sed 's/^/  /' "$f" >> "$SUMMARY_FILE"
  fi
done

echo ""
echo "========================================="
echo "  完成"
echo "========================================="
echo "单个服务画像: $OUTPUT_DIR/"
echo "汇总文件:     $SUMMARY_FILE"
echo "服务总数:     $PROFILE_COUNT"
echo ""
echo "下一步: 用 requirement-analysis-prompt.md 中的 prompt 做需求分析"
