#!/bin/bash
# 用 AI 总结所有服务画像，生成精简的架构总览
# 用法: ./summarize.sh [profiles目录]
# 依赖: claude (Claude Code CLI)

PROFILES_DIR="${1:-service-analysis/profiles}"
OUTPUT_FILE="service-analysis/architecture.md"

if [ ! -d "$PROFILES_DIR" ]; then
  echo "错误: 找不到目录 $PROFILES_DIR"
  echo "用法: ./summarize.sh [profiles目录]"
  exit 1
fi

PROFILE_COUNT=$(ls "$PROFILES_DIR"/*.md 2>/dev/null | wc -l | xargs)

if [ "$PROFILE_COUNT" -eq 0 ]; then
  echo "错误: $PROFILES_DIR 下没有 .md 文件"
  exit 1
fi

# 用绝对路径，避免 claude 在任意 cwd 下也能正确定位
ABS_PROFILES_DIR=$(cd "$PROFILES_DIR" && pwd)
ABS_OUTPUT_DIR=$(cd "$(dirname "$OUTPUT_FILE")" 2>/dev/null && pwd || mkdir -p "$(dirname "$OUTPUT_FILE")" && cd "$(dirname "$OUTPUT_FILE")" && pwd)
ABS_OUTPUT_FILE="$ABS_OUTPUT_DIR/$(basename "$OUTPUT_FILE")"

echo "========================================="
echo "  架构总览生成"
echo "========================================="
echo "服务画像目录: $ABS_PROFILES_DIR"
echo "服务数量:     $PROFILE_COUNT"
echo "输出文件:     $ABS_OUTPUT_FILE"
echo ""
echo "正在让 AI 读取画像并生成架构总览（可能需要几分钟）..."

PROMPT="你是一个架构师。请使用你的 Read/Glob 工具读取目录 \`$ABS_PROFILES_DIR\` 下所有 .md 文件（共 $PROFILE_COUNT 个服务画像），然后生成一份精简的架构总览文档。

读取方法：
- 先用 Glob 列出 \`$ABS_PROFILES_DIR/*.md\` 所有文件
- 逐个 Read 每个 .md 文件了解服务详情
- 读完后再开始生成总览

输出要求：
1. 不要重复每个服务的完整信息，只提炼关键内容
2. 将最终总览内容直接输出到 stdout（纯 Markdown，不要用 \`\`\`markdown 包裹，不要写任何其它文件）
3. 按以下结构输出：

# 微服务架构总览

## 服务清单

用表格列出所有服务/库：| 名称 | 类型 | 技术栈 | 职责（一句话）| 业务域 |

## 业务域划分

按业务域分组，说明每个域包含哪些服务，域之间的关系

## 服务依赖关系

用文字描述核心调用链路，比如：
- 用户下单：mall-web → order-service → inventory-service / payment-service
- 列出关键的依赖方向，不需要画图

## 二方库依赖关系

哪些二方库被哪些服务依赖，起什么作用

## 数据存储分布

哪些服务有自己的数据库表，核心数据实体分布在哪些服务

## 外部集成汇总

所有对外的第三方集成（支付、短信、OSS 等）集中列出，标注由哪个服务负责"

# --permission-mode acceptEdits 允许 Read/Glob 等只读工具在非交互模式下直接执行
if claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    < /dev/null \
    > "$ABS_OUTPUT_FILE" \
    2> "$ABS_OUTPUT_FILE.err"; then
  if [ -s "$ABS_OUTPUT_FILE" ]; then
    echo ""
    echo "========================================="
    echo "  完成"
    echo "========================================="
    echo "架构总览: $ABS_OUTPUT_FILE"
    echo ""
    echo "做需求分析时，先给 AI 看这个总览文件定位涉及的服务，"
    echo "再让它看 profiles/ 下对应服务的详细画像了解细节。"
    rm -f "$ABS_OUTPUT_FILE.err"
  else
    echo "[失败] AI 返回空内容"
    if [ -s "$ABS_OUTPUT_FILE.err" ]; then
      echo "--- claude stderr ---"
      cat "$ABS_OUTPUT_FILE.err"
      echo "---------------------"
    fi
    rm -f "$ABS_OUTPUT_FILE" "$ABS_OUTPUT_FILE.err"
  fi
else
  EXIT_CODE=$?
  echo "[失败] AI 总结出错 (claude 退出码: $EXIT_CODE)"
  if [ -s "$ABS_OUTPUT_FILE.err" ]; then
    echo "--- claude stderr ---"
    cat "$ABS_OUTPUT_FILE.err"
    echo "---------------------"
  fi
  rm -f "$ABS_OUTPUT_FILE" "$ABS_OUTPUT_FILE.err"
fi

echo ""
echo "按回车键退出..."
read -r
