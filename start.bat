@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: DevOps Kanban - Windows 一键启动脚本
:: 同时启动前端和后端服务
:: 自动检测并清理端口占用的进程

echo.
echo ========================================
echo   DevOps Kanban 启动中...
echo ========================================
echo.

set "PROJECT_ROOT=%~dp0"
:: Remove trailing backslash
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_PORT=3000"
set "BACKEND_PORT=8000"

:: ========================================
:: 检查 Node.js
:: ========================================
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do (
    set "NODE_VERSION=%%v"
)
set "NODE_VERSION=%NODE_VERSION:v=%"

if %NODE_VERSION% lss 22 (
    echo [错误] 后端需要 Node.js 22+，当前版本：
    node -v
    echo 请升级 Node.js：https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js:
node -v

:: ========================================
:: 初始化数据目录
:: ========================================
set "DATA_DIR=%PROJECT_ROOT%\data"
set "DATA_SAMPLE_DIR=%PROJECT_ROOT%\data-sample"

if not exist "%DATA_DIR%" (
    if exist "%DATA_SAMPLE_DIR%" (
        echo [信息] 初始化后端数据：将 data-sample 复制到 data...
        xcopy "%DATA_SAMPLE_DIR%" "%DATA_DIR%\" /E /I /Q >nul
        echo [OK] 已初始化 data 目录
    ) else (
        echo [信息] 创建空 data 目录...
        mkdir "%DATA_DIR%"
        echo [OK] 已创建 data 目录
    )
)

:: 确保必要的数据文件存在
for %%f in (projects.json tasks.json agents.json sessions.json executions.json task_sources.json skills.json) do (
    if not exist "%DATA_DIR%\%%f" (
        echo []> "%DATA_DIR%\%%f"
    )
)
if not exist "%DATA_DIR%\skills" mkdir "%DATA_DIR%\skills"

echo [OK] 数据目录已就绪
echo.

:: ========================================
:: 配置 npm 镜像源
:: ========================================
echo [信息] 配置 npm 镜像源...
call npm config set registry https://registry.npmmirror.com
call npm config set strict-ssl false
for /f "delims=" %%r in ('npm config get registry 2^>nul') do set "NPM_REGISTRY=%%r"
echo [OK] 镜像源：!NPM_REGISTRY!
echo [OK] strict-ssl: false
echo.

:: ========================================
:: 清理端口占用
:: ========================================
echo [信息] 检查端口占用...

:: 清理前端端口
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    echo [警告] 端口 %FRONTEND_PORT% 被占用，正在停止进程 %%a...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo [OK] 已清理端口 %FRONTEND_PORT%
)

:: 清理后端端口
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do (
    echo [警告] 端口 %BACKEND_PORT% 被占用，正在停止进程 %%a...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo [OK] 已清理端口 %BACKEND_PORT%
)

echo.

:: ========================================
:: 启动前端服务
:: ========================================
echo [1/2] 启动前端服务...
cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo [信息] 首次运行，安装前端依赖...
    call npm install --loglevel=verbose --no-audit
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
)

start "DevOps Kanban - Frontend" cmd /c "npm run dev"
echo [信息] 等待前端服务启动...

set "FRONTEND_READY=0"
for /l %%i in (1,1,15) do (
    if !FRONTEND_READY! equ 0 (
        timeout /t 1 /nobreak >nul
        curl -s "http://localhost:%FRONTEND_PORT%" >nul 2>&1
        if !errorlevel! equ 0 (
            set "FRONTEND_READY=1"
            echo [OK] 前端服务已启动
            echo      访问地址：http://localhost:%FRONTEND_PORT%
        )
    )
)
if %FRONTEND_READY% equ 0 (
    echo [警告] 前端启动超时，请检查上方窗口的输出
)

echo.

:: ========================================
:: 启动后端服务
:: ========================================
echo [2/2] 启动后端服务...
cd /d "%BACKEND_DIR%"

if not exist "node_modules" (
    echo [信息] 首次运行，安装后端依赖...
    call npm install --loglevel=verbose --no-audit
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
)

start "DevOps Kanban - Backend" cmd /c "npm run dev"
echo [信息] 等待后端服务启动...

set "BACKEND_READY=0"
for /l %%i in (1,1,30) do (
    if !BACKEND_READY! equ 0 (
        timeout /t 1 /nobreak >nul
        curl -s "http://localhost:%BACKEND_PORT%/api/projects" >nul 2>&1
        if !errorlevel! equ 0 (
            set "BACKEND_READY=1"
            echo [OK] 后端服务已启动
            echo      API 地址：http://localhost:%BACKEND_PORT%
        )
    )
)
if %BACKEND_READY% equ 0 (
    echo [警告] 后端启动超时，请检查上方窗口的输出
)

echo.
echo ========================================
echo   DevOps Kanban 启动完成！
echo ========================================
echo.
echo   前端：http://localhost:%FRONTEND_PORT%
echo   后端：http://localhost:%BACKEND_PORT%
echo.
echo   提示：关闭弹出的窗口即可停止对应服务
echo   提示：再次运行 start.bat 会自动重启
echo.

:: 打开浏览器
echo [信息] 正在打开浏览器...
start "" "http://localhost:%FRONTEND_PORT%"

echo 按任意键退出此窗口（服务将继续运行）...
pause >nul
