#!/bin/bash
# 汇总所有服务画像为一个 architecture.md
# 用法: ./summarize.sh [profiles目录]

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

echo "找到 $PROFILE_COUNT 个服务画像，开始汇总..."

cat > "$OUTPUT_FILE" << EOF
# 微服务架构全景

> 自动生成于 $(date '+%Y-%m-%d %H:%M:%S') | 服务总数: $PROFILE_COUNT
>
> 用途: 作为 LLM 上下文，用于需求分析时定位涉及的微服务

---
EOF

for f in "$PROFILES_DIR"/*.md; do
  if [ -f "$f" ]; then
    SERVICE_NAME=$(basename "$f" .md)
    echo "  + $SERVICE_NAME"
    echo "" >> "$OUTPUT_FILE"
    cat "$f" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
  fi
done

echo ""
echo "汇总完成: $OUTPUT_FILE"
echo "服务总数: $PROFILE_COUNT"
echo ""
echo "按回车键退出..."
read -r
