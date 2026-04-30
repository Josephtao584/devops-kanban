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

根据仓库类型，按对应结构输出：

---

如果是微服务（frontend / backend / bff / gateway）：

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

---

如果是二方库（library）：

## {库名}

**类型**: library
**子类型**: interface（接口/模型定义）/ util（工具/SDK 封装）/ mixed（混合）
**技术栈**: 语言、构建工具、主要依赖
**职责**: 一句话说清楚这个库提供什么能力
**业务域**: 所属业务领域

### 导出的接口/类
列出主要的公开接口、抽象类、Feign Client 定义（包名 + 接口名 + 用途）。

### 导出的模型
列出 DTO、VO、Entity、枚举、常量等公开数据模型（包名/模块 + 类名 + 用途）。

### 工具类/SDK 封装
列出提供的工具类和 SDK 封装（如 Redis 工具、OSS 客户端、通用分页等），说明封装了什么能力。

### 依赖的第三方
列出依赖的外部库或服务 SDK（如 AWS SDK、支付宝 SDK 等）。

---

分析步骤：
1. 找配置文件（package.json / pom.xml / build.gradle / go.mod）确定技术栈
2. 判断仓库类型：有路由/启动类/main 入口的是微服务，只有接口定义/工具类/无独立启动的是二方库
3. 微服务：找路由定义、数据模型、HTTP 调用、MQ 代码、第三方 SDK
4. 二方库：找公开接口和抽象类、DTO/VO/Entity 模型、工具类和封装、导出的常量和枚举

注意：
- 服务依赖只列内部微服务间的调用，第三方放第三方集成
- 前端的服务依赖从 API 调用地址反推对应的后端服务
- 如果无法确定某个调用对应哪个服务，写明调用地址
- 二方库重点关注它导出了什么（被别人用的），而不是它内部怎么实现的'

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

PROFILE_COUNT=$(ls "$OUTPUT_DIR"/*.md 2>/dev/null | wc -l | xargs)

echo ""
echo "========================================="
echo "  完成"
echo "========================================="
echo "单个服务画像: $OUTPUT_DIR/"
echo "已生成:       $PROFILE_COUNT 个"
echo ""
echo "按回车键退出..."
read -r
