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

echo "========================================="
echo "  架构总览生成"
echo "========================================="
echo "服务画像目录: $PROFILES_DIR"
echo "服务数量:     $PROFILE_COUNT"
echo ""

# 拼接所有 profiles 作为输入
ALL_PROFILES=""
for f in "$PROFILES_DIR"/*.md; do
  if [ -f "$f" ]; then
    SERVICE_NAME=$(basename "$f" .md)
    echo "  读取: $SERVICE_NAME"
    ALL_PROFILES="$ALL_PROFILES
---
$(cat "$f")
"
  fi
done

echo ""
echo "正在让 AI 生成架构总览（可能需要几分钟）..."

PROMPT="你是一个架构师。以下是我们所有微服务和二方库的详细画像，请生成一份精简的架构总览文档。

要求：
1. 不要重复每个服务的完整信息，只提炼关键内容
2. 按以下结构输出（直接输出 Markdown，不要用 \`\`\`markdown 包裹）：

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

所有对外的第三方集成（支付、短信、OSS 等）集中列出，标注由哪个服务负责

---

以下是所有服务的详细画像：

$ALL_PROFILES"

if claude -p "$PROMPT" < /dev/null > "$OUTPUT_FILE" 2>/dev/null; then
  if [ -s "$OUTPUT_FILE" ]; then
    echo ""
    echo "========================================="
    echo "  完成"
    echo "========================================="
    echo "架构总览: $OUTPUT_FILE"
    echo ""
    echo "做需求分析时，先给 AI 看这个总览文件定位涉及的服务，"
    echo "再让它看 profiles/ 下对应服务的详细画像了解细节。"
  else
    echo "[失败] AI 返回空内容"
    rm -f "$OUTPUT_FILE"
  fi
else
  echo "[失败] AI 总结出错"
  rm -f "$OUTPUT_FILE"
fi

echo ""
echo "按回车键退出..."
read -r
