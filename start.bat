@echo off
setlocal EnableDelayedExpansion

:: DevOps Kanban - Windows Startup Script

echo.
echo ========================================
echo   DevOps Kanban Starting...
echo ========================================
echo.

set "PROJECT_ROOT=%~dp0"
if "!PROJECT_ROOT:~-1!"=="\" set "PROJECT_ROOT=!PROJECT_ROOT:~0,-1!"
set "FRONTEND_DIR=!PROJECT_ROOT!\frontend"
set "BACKEND_DIR=!PROJECT_ROOT!\backend"
set "FRONTEND_PORT=3000"
set "BACKEND_PORT=8000"

:: ========================================
:: Check Node.js
:: ========================================
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 22+
    echo         https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do (
    set "NODE_VERSION=%%v"
)
set "NODE_VERSION=!NODE_VERSION:v=!"

if !NODE_VERSION! lss 22 (
    echo [ERROR] Node.js 22+ required, current:
    node -v
    echo         https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js:
node -v

:: ========================================
:: Init data directory
:: ========================================
set "DATA_DIR=!PROJECT_ROOT!\data"

if not exist "!DATA_DIR!" (
    echo [INFO] Creating data directory...
    mkdir "!DATA_DIR!"
    echo [OK] Data directory created. Database and seed data will be initialized on backend startup.
)

echo [OK] Data directory ready
echo.

:: ========================================
:: Configure npm
:: ========================================
echo [INFO] Checking npm config...
call npm config set strict-ssl false >nul 2>&1
for /f "delims=" %%r in ('npm config get registry 2^>nul') do set "NPM_REGISTRY=%%r"
echo [OK] Registry: !NPM_REGISTRY!
echo [OK] strict-ssl: false
echo.

:: ========================================
:: Cleanup ports
:: ========================================
echo [INFO] Checking ports...

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":!FRONTEND_PORT! " ^| findstr "LISTENING"') do (
    echo [WARN] Port !FRONTEND_PORT! in use, killing PID %%a...
    taskkill /F /PID %%a >nul 2>&1
    ping -n 3 127.0.0.1 >nul
    echo [OK] Port !FRONTEND_PORT! cleared
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":!BACKEND_PORT! " ^| findstr "LISTENING"') do (
    echo [WARN] Port !BACKEND_PORT! in use, killing PID %%a...
    taskkill /F /PID %%a >nul 2>&1
    ping -n 3 127.0.0.1 >nul
    echo [OK] Port !BACKEND_PORT! cleared
)

echo.

:: ========================================
:: Start frontend
:: ========================================
echo [1/2] Starting frontend...
cd /d "!FRONTEND_DIR!"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install --loglevel=verbose --no-audit
    if !errorlevel! neq 0 (
        echo [ERROR] Frontend install failed
        pause
        exit /b 1
    )
)

if not exist "!PROJECT_ROOT!\log\frontend" mkdir "!PROJECT_ROOT!\log\frontend"
if not exist "!PROJECT_ROOT!\log\backend" mkdir "!PROJECT_ROOT!\log\backend"
for /f "usebackq" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss-fff'"`) do set "TS=%%i"
start /b cmd /c "chcp 65001 >nul 2>&1 && set NO_COLOR=1 && npm run dev" > "!PROJECT_ROOT!\log\frontend\kanban-frontend-!TS!.log" 2>&1
echo [INFO] Waiting for frontend...

set "FRONTEND_READY=0"
for /l %%i in (1,1,15) do (
    if "!FRONTEND_READY!"=="0" (
        ping -n 2 127.0.0.1 >nul
        curl -s http://localhost:!FRONTEND_PORT! >nul 2>&1
        if !errorlevel! equ 0 (
            set "FRONTEND_READY=1"
            echo [OK] Frontend started
            echo      URL: http://localhost:!FRONTEND_PORT!
        )
    )
)
if "!FRONTEND_READY!"=="0" (
    echo [WARN] Frontend startup timeout
)

echo.

:: ========================================
:: Start backend
:: ========================================
echo [2/2] Starting backend...
cd /d "!BACKEND_DIR!"

if not exist "node_modules" (
    echo [INFO] Installing backend dependencies...
    call npm install --loglevel=verbose --no-audit
    if !errorlevel! neq 0 (
        echo [ERROR] Backend install failed
        pause
        exit /b 1
    )
)

start /b npm run dev > "!PROJECT_ROOT!\log\backend\kanban-backend-!TS!.log" 2>&1
echo [INFO] Waiting for backend...

set "BACKEND_READY=0"
for /l %%i in (1,1,30) do (
    if "!BACKEND_READY!"=="0" (
        ping -n 2 127.0.0.1 >nul
        curl -s http://localhost:!BACKEND_PORT!/api/projects >nul 2>&1
        if !errorlevel! equ 0 (
            set "BACKEND_READY=1"
            echo [OK] Backend started
            echo      API: http://localhost:!BACKEND_PORT!
        )
    )
)
if "!BACKEND_READY!"=="0" (
    echo [WARN] Backend startup timeout
)

echo.
echo ========================================
echo   DevOps Kanban Started!
echo ========================================
echo.
echo   Frontend: http://localhost:!FRONTEND_PORT!
echo   Backend:  http://localhost:!BACKEND_PORT!
echo.
echo   Press Ctrl+C to stop all services
echo   Frontend Log: !PROJECT_ROOT!\log\frontend\kanban-frontend-*.log
echo   Backend Log:  !PROJECT_ROOT!\log\backend\kanban-backend-*.log
echo.

echo [INFO] Opening browser...
start "" "http://localhost:!FRONTEND_PORT!"

:wait_loop
ping -n 10 127.0.0.1 >nul
goto wait_loop
