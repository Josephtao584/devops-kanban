#!/bin/bash

# DevOps Kanban - 一键启动脚本
# 同时启动前端和后端服务（Node.js 后端）
# 自动检测并清理端口占用的进程

echo "🚀 DevOps Kanban 启动中..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

FRONTEND_PORT=3000
BACKEND_PORT=8000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check_port() {
    local port=$1
    lsof -ti :$port 2>/dev/null
}

cleanup_port() {
    local port=$1
    local service_name=$2

    local pid
    pid=$(check_port "$port")
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠ 端口 $port 被占用，正在停止 $service_name...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
        if check_port "$port" > /dev/null 2>&1; then
            echo -e "${RED}✗ 无法清理端口 $port 的占用${NC}"
            return 1
        fi
        echo -e "${GREEN}✓ 已清理端口 $port${NC}"
    fi
    return 0
}

cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"
    pkill -f "vite" 2>/dev/null
    pkill -f "tsx watch src/main.ts" 2>/dev/null
    pkill -f "node dist/src/main.js" 2>/dev/null
    cleanup_port "$FRONTEND_PORT" "前端服务"
    cleanup_port "$BACKEND_PORT" "后端服务"
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  DevOps Kanban - 启动检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if ! command -v node > /dev/null 2>&1; then
    echo -e "${RED}✗ 错误：未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null | tr -dc '0-9')
if [ -z "$NODE_MAJOR" ]; then
    NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')
fi
if [ -z "$NODE_MAJOR" ] || ! [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}✗ 错误：无法识别 Node.js 主版本号，当前版本为 $(node -v)${NC}"
    exit 1
fi

if [ "$NODE_MAJOR" -lt 22 ]; then
    echo -e "${RED}✗ 错误：后端需要 Node.js 22+，当前版本为 $(node -v)${NC}"
    exit 1
fi

if [ "$NODE_MAJOR" -ne 22 ]; then
    echo -e "${YELLOW}⚠ 警告：推荐使用 Node.js 22.x，当前版本为 $(node -v)，将继续启动${NC}"
else
    echo -e "${GREEN}✓ Node.js: $(node -v)${NC}"
fi

DATA_DIR="$PROJECT_ROOT/data"
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}首次运行，创建 data 目录...${NC}"
    mkdir -p "$DATA_DIR"
    echo -e "${GREEN}✓ 已创建 data 目录，后端启动时将自动初始化数据库和种子数据${NC}"
fi
echo -e "${GREEN}✓ 数据目录已就绪${NC}"

echo ""
echo -e "${YELLOW}npm 配置...${NC}"
npm config set strict-ssl false
echo -e "${GREEN}✓ 镜像源：$(npm config get registry)${NC}"
echo -e "${GREEN}✓ strict-ssl: false${NC}"

echo ""
echo -e "${YELLOW}检查端口占用...${NC}"
cleanup_port "$FRONTEND_PORT" "前端服务 (Vite)"
cleanup_port "$BACKEND_PORT" "后端服务 (Uvicorn)"
echo ""

mkdir -p "$PROJECT_ROOT/log/frontend" "$PROJECT_ROOT/log/backend"
TIMESTAMP=$(date +%Y%m%d-%H%M%S-%3N)

echo -e "${YELLOW}[1/2] 启动后端服务 (Node.js)...${NC}"
cd "$BACKEND_DIR"
npm install --no-audit 2>/dev/null
pkill -f "tsx watch src/main.ts" 2>/dev/null || true
pkill -f "node dist/src/main.js" 2>/dev/null || true
BACKEND_LOG="$PROJECT_ROOT/log/backend/kanban-backend-${TIMESTAMP}.log"
npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo -e "${YELLOW}等待后端服务启动...${NC}"
for i in {1..30}; do
    if curl -s "http://localhost:$BACKEND_PORT/api/projects" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务已启动 (PID: $BACKEND_PID)${NC}"
        echo -e "   API 地址：${BLUE}http://localhost:$BACKEND_PORT${NC}"
        echo -e "   API Docs: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo -e "${YELLOW}⚠ 后端启动超时，请查看日志：$BACKEND_LOG${NC}"
        tail -20 "$BACKEND_LOG" 2>/dev/null
    fi
    sleep 1
done

echo ""
echo -e "${YELLOW}[2/2] 启动前端服务...${NC}"
cd "$FRONTEND_DIR"
npm install --no-audit 2>/dev/null
pkill -f "vite" 2>/dev/null || true
FRONTEND_LOG="$PROJECT_ROOT/log/frontend/kanban-frontend-${TIMESTAMP}.log"
LANG=en_US.UTF-8 NO_COLOR=1 npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

echo -e "${YELLOW}等待前端服务启动...${NC}"
for i in {1..15}; do
    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 前端服务已启动 (PID: $FRONTEND_PID)${NC}"
        echo -e "   访问地址：${BLUE}http://localhost:$FRONTEND_PORT${NC}"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo -e "${YELLOW}⚠ 前端启动超时，查看日志：$FRONTEND_LOG${NC}"
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  DevOps Kanban 启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  前端：${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  后端：${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo -e "  API Docs: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
echo -e "  ${YELLOW}提示：${NC}按 Ctrl+C 停止所有服务"
echo -e "  ${YELLOW}提示：${NC}再次运行 ./start.sh 会自动重启"
echo ""

wait
