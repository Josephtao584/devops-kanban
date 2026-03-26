#!/bin/bash

# DevOps Kanban - 一键启动脚本
# 同时启动前端和后端服务（Node.js 后端）
# 自动检测并清理端口占用的进程

echo "🚀 DevOps Kanban 启动中..."

# 获取脚本所在目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

# 端口配置
FRONTEND_PORT=3000
BACKEND_PORT=8000

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查端口是否被占用
check_port() {
    local port=$1
    lsof -ti :$port 2>/dev/null
}

# 清理指定端口的进程
cleanup_port() {
    local port=$1
    local service_name=$2

    local pid=$(check_port $port)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠ 端口 $port 被占用，正在停止 $service_name...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1

        # 验证是否清理成功
        if check_port $port > /dev/null 2>&1; then
            echo -e "${RED}✗ 无法清理端口 $port 的占用${NC}"
            return 1
        fi
        echo -e "${GREEN}✓ 已清理端口 $port${NC}"
    fi
    return 0
}

# 清理所有相关进程
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"

    # 停止前端
    pkill -f "vite" 2>/dev/null

    # 停止后端
    pkill -f "tsx watch src/main.ts" 2>/dev/null
    pkill -f "node dist/src/main.js" 2>/dev/null

    # 清理端口
    cleanup_port $FRONTEND_PORT "前端服务"
    cleanup_port $BACKEND_PORT "后端服务"

    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  DevOps Kanban - 启动检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ 错误：未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

NODE_VERSION=$(node -v 2>/dev/null)
NODE_MAJOR=$(printf '%s' "$NODE_VERSION" | sed -E 's/^v([0-9]+).*/\1/')
if [ -z "$NODE_MAJOR" ] || ! printf '%s' "$NODE_MAJOR" | grep -Eq '^[0-9]+$'; then
    echo -e "${RED}✗ 错误：无法识别 Node.js 版本，当前输出为 ${NODE_VERSION:-<empty>}${NC}"
    exit 1
fi
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo -e "${RED}✗ 错误：后端需要 Node.js 22+，当前版本为 $NODE_VERSION${NC}"
    exit 1
fi

if [ "$NODE_MAJOR" -ne 22 ]; then
    echo -e "${YELLOW}⚠ 警告：推荐使用 Node.js 22.x，当前版本为 $NODE_VERSION，将继续启动${NC}"
else
    echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
fi

# 初始化数据目录
init_data_dir() {
    local data_dir="$PROJECT_ROOT/data"
    local data_sample_dir="$PROJECT_ROOT/data-sample"

    if [ -d "$data_dir" ]; then
        return 0
    fi

    if [ -d "$data_sample_dir" ]; then
        echo -e "${YELLOW}初始化后端数据：将 data-sample 复制到 data...${NC}"
        cp -R "$data_sample_dir" "$data_dir"
        echo -e "${GREEN}✓ 已初始化 data 目录${NC}"
        return 0
    fi

    echo -e "${YELLOW}未找到 data-sample，已创建空 data 目录...${NC}"
    mkdir -p "$data_dir"
    echo -e "${GREEN}✓ 已创建 data 目录${NC}"
}

init_data_dir

# 检查并清理端口占用
echo ""
echo -e "${YELLOW}检查端口占用...${NC}"

cleanup_port $FRONTEND_PORT "前端服务 (Vite)"
cleanup_port $BACKEND_PORT "后端服务 (Node.js)"

echo ""

# 启动前端
echo -e "${YELLOW}[1/2] 启动前端服务...${NC}"
cd "$FRONTEND_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}首次运行，安装前端依赖...${NC}"
    npm install
fi

# 清理旧的前端进程
pkill -f "vite" 2>/dev/null || true

# 启动前端进程
npm run dev > /tmp/kanban-frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
echo -e "${YELLOW}等待前端服务启动...${NC}"
for i in {1..15}; do
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 前端服务已启动 (PID: $FRONTEND_PID)${NC}"
        echo -e "   访问地址：${BLUE}http://localhost:$FRONTEND_PORT${NC}"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${YELLOW}⚠ 前端启动超时，查看日志：/tmp/kanban-frontend.log${NC}"
        echo -e "${YELLOW}   继续启动后端服务...${NC}"
    fi
    sleep 1
done

# 启动后端
echo ""
echo -e "${YELLOW}[2/2] 启动后端服务 (Node.js)...${NC}"

cd "$BACKEND_DIR"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}首次运行，安装后端依赖...${NC}"
    npm install
fi

# 清理旧的后端进程
pkill -f "tsx watch src/main.ts" 2>/dev/null || true
pkill -f "node dist/src/main.js" 2>/dev/null || true

# 启动后端进程
npm run dev > /tmp/kanban-backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
echo -e "${YELLOW}等待后端服务启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/api/projects > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务已启动 (PID: $BACKEND_PID)${NC}"
        echo -e "   API 地址：${BLUE}http://localhost:$BACKEND_PORT${NC}"
        echo -e "   API Docs: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠ 后端启动超时，请查看日志：/tmp/kanban-backend.log${NC}"
        tail -20 /tmp/kanban-backend.log 2>/dev/null
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

# 等待用户中断
wait
