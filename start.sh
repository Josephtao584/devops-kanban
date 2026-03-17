#!/bin/bash

# DevOps Kanban - 一键启动脚本
# 同时启动前端和后端服务

echo "🚀 DevOps Kanban 启动中..."

# 获取脚本所在目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 清理旧进程
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"

    # 停止前端 (npm dev)
    pkill -f "vite" 2>/dev/null

    # 停止后端 (Spring Boot)
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true

    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误：未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

# 检查 Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}错误：未找到 Java，请先安装 Java 17+${NC}"
    exit 1
fi

# 检查 Maven
if ! command -v mvn &> /dev/null; then
    echo -e "${YELLOW}警告：未找到 Maven，尝试使用 Maven wrapper${NC}"
    if [ -f "$PROJECT_ROOT/mvnw" ]; then
        MVN_CMD="./mvnw"
    else
        echo -e "${RED}错误：无法找到 Maven，请先安装或使用 mvnw${NC}"
        exit 1
    fi
else
    MVN_CMD="mvn"
fi

echo -e "${GREEN}✓ 环境检查完成${NC}"
echo ""

# 启动前端
echo -e "${YELLOW}[1/2] 启动前端服务...${NC}"
cd "$FRONTEND_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}首次运行，安装依赖...${NC}"
    npm install
fi

npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
sleep 3
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ 前端服务已启动 (PID: $FRONTEND_PID)${NC}"
    echo -e "   访问地址：http://localhost:5173"
else
    echo -e "${RED}✗ 前端启动失败，查看日志：/tmp/frontend.log${NC}"
    exit 1
fi

# 启动后端
echo ""
echo -e "${YELLOW}[2/2] 启动后端服务...${NC}"
cd "$PROJECT_ROOT"

$MVN_CMD spring-boot:run > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
echo -e "${YELLOW}等待后端启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8080/api/projects > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务已启动 (PID: $BACKEND_PID)${NC}"
        echo -e "   API 地址：http://localhost:8080"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠ 后端启动超时，请查看日志：/tmp/backend.log${NC}"
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DevOps Kanban 启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  前端：${GREEN}http://localhost:5173${NC}"
echo -e "  后端：${GREEN}http://localhost:8080${NC}"
echo ""
echo -e "  按 ${YELLOW}Ctrl+C${NC} 停止所有服务"
echo ""

# 等待用户中断
wait
