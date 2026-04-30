#!/bin/bash
# 微服务架构分析脚本
# 用法: ./analyze-services.sh [services.csv]
# 依赖: git, claude (Claude Code CLI)

LOG_DIR=""

cleanup() {
  if [ -n "$LOG_DIR" ] && [ -d "$LOG_DIR" ]; then
    rm -rf "$LOG_DIR"
  fi
}
trap cleanup EXIT

WORK_DIR="$(pwd)/service-analysis"
OUTPUT_DIR="$WORK_DIR/profiles"
REPOS_DIR="$WORK_DIR/repos"
SUMMARY_FILE="$WORK_DIR/architecture.md"
CSV_FILE="${1:-services.csv}"

if [ ! -f "$CSV_FILE" ]; then
  echo "错误: 找不到 $CSV_FILE"
  echo "用法: ./analyze-services.sh [services.csv]"
  echo "请参考 services.csv.example 创建你的 services.csv"
  exit 1
fi

LOG_DIR="$WORK_DIR/logs"
mkdir -p "$OUTPUT_DIR" "$REPOS_DIR" "$LOG_DIR"

PROMPT='你是一个代码架构分析师。请分析当前代码仓库，输出 Markdown 格式的服务画像（不要用 ```markdown 包裹，直接输出内容）。
只基于代码中实际存在的内容，找不到的部分不要写。

按以下结构输出：

## {服务名}

**类型**: frontend / backend / bff / gateway
**技术栈**: 框架、语言、主要依赖
**职责**: 一句话说清楚这个服务做什么
**业务域**: 所属业务领域（如：交易、用户、营销、基础设施）

### 数据模型
- 后端列出拥有的数据库表（从 migration/entity/model 提取）
- 前端列出主要的状态管理模块（从 store 目录提取）

### 对外接口
- 后端列出暴露的 API 路由（方法 + 路径），不列框架自带的如 /health /actuator
- 前端列出路由页面（路径 + 用途）

### 服务依赖
列出依赖的内部微服务，说明调用目的。从 HTTP 调用、Feign、API 导入等提取。

### 消息队列
列出消费和生产的 topic/queue。

### 第三方集成
列出对接的外部服务（如支付宝、微信、OSS、短信等）。

分析步骤：
1. 找配置文件（package.json / pom.xml / build.gradle / go.mod）确定技术栈
2. 找路由定义提取 API 或页面路由
3. 找数据模型/实体定义提取表名或 store 模块
4. 全局搜索 HTTP 调用（axios/fetch/RestTemplate/Feign/HttpClient）提取服务间依赖
5. 搜索 MQ 相关代码（KafkaListener/RabbitListener/consumer/producer/subscribe/publish）
6. 搜索第三方 SDK 调用

注意：
- 服务依赖只列内部微服务间的调用，第三方放第三方集成
- 前端的服务依赖从 API 调用地址反推对应的后端服务
- 如果无法确定某个调用对应哪个服务，写明调用地址'

SUCCESS=0
FAIL=0
SKIP=0

TOTAL=0
echo "========================================="
echo "  微服务架构分析"
echo "========================================="
echo "输入文件: $CSV_FILE"
echo "工作目录: $WORK_DIR"
echo ""
echo "本次待分析服务列表："
echo "-----------------------------------------"
printf "  %-4s %-30s %-10s\n" "序号" "服务名" "类型"
echo "-----------------------------------------"
while IFS=',' read -r name type repo; do
  name=$(echo "$name" | xargs)
  type=$(echo "$type" | xargs)
  [ -z "$name" ] && continue
  TOTAL=$((TOTAL + 1))
  printf "  %-4s %-30s %-10s\n" "$TOTAL" "$name" "$type"
done < <(tail -n +2 "$CSV_FILE")
echo "-----------------------------------------"
echo "共 $TOTAL 个服务"
echo ""

# 使用文件描述符 3 读取 CSV，避免 claude 命令吃掉 stdin
while IFS=',' read -r name type repo <&3; do
  name=$(echo "$name" | xargs)
  type=$(echo "$type" | xargs)
  repo=$(echo "$repo" | xargs)

  [ -z "$name" ] && continue

  echo "--- [$name] ($type) ---"

  # clone
  REPO_PATH="$REPOS_DIR/$name"
  if [ -d "$REPO_PATH" ]; then
    echo "  已存在，跳过 clone"
  else
    echo "  正在 clone..."
    if ! git clone --depth 1 "$repo" "$REPO_PATH" 2>&1 | tail -5; then
      echo "  [失败] clone 失败，跳过"
      FAIL=$((FAIL + 1))
      continue
    fi
  fi

  # 如果已有分析结果，跳过（支持断点续跑）
  if [ -f "$OUTPUT_DIR/${name}.md" ]; then
    echo "  已有分析结果，跳过（删除 $OUTPUT_DIR/${name}.md 可重新分析）"
    SKIP=$((SKIP + 1))
    continue
  fi

  # 用 Claude Code 分析
  echo "  正在分析（可能需要 1-2 分钟）..."
  CURRENT_DIR=$(pwd)
  cd "$REPO_PATH"

  ERROR_LOG="$LOG_DIR/${name}.log"
  if claude -p "$PROMPT" < /dev/null > "$OUTPUT_DIR/${name}.md" 2>"$ERROR_LOG"; then
    if [ -s "$OUTPUT_DIR/${name}.md" ]; then
      echo "  [完成] → profiles/${name}.md"
      rm -f "$ERROR_LOG"
      SUCCESS=$((SUCCESS + 1))
    else
      echo "  [失败] Claude 返回空内容"
      rm -f "$OUTPUT_DIR/${name}.md"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  [失败] Claude 分析出错，错误信息："
    echo "  ----------------------------------------"
    sed 's/^/  /' "$ERROR_LOG"
    echo "  ----------------------------------------"
    echo "  完整日志: $ERROR_LOG"
    rm -f "$OUTPUT_DIR/${name}.md"
    FAIL=$((FAIL + 1))
  fi

  cd "$CURRENT_DIR"
  echo ""
done 3< <(tail -n +2 "$CSV_FILE")

# === 汇总 ===
echo "========================================="
echo "  汇总所有服务画像"
echo "========================================="

PROFILE_COUNT=$(ls "$OUTPUT_DIR"/*.md 2>/dev/null | wc -l | xargs)

if [ "$PROFILE_COUNT" -eq 0 ]; then
  echo "没有生成任何服务画像，跳过汇总"
  exit 1
fi

cat > "$SUMMARY_FILE" << EOF
# 微服务架构全景

> 自动生成于 $(date '+%Y-%m-%d %H:%M:%S') | 服务总数: $PROFILE_COUNT
>
> 用途: 作为 LLM 上下文，用于需求分析时定位涉及的微服务

---
EOF

for f in "$OUTPUT_DIR"/*.md; do
  if [ -f "$f" ]; then
    echo "" >> "$SUMMARY_FILE"
    cat "$f" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    echo "---" >> "$SUMMARY_FILE"
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
echo ""
echo "按回车键退出..."
read -r
