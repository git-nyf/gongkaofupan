@echo off
setlocal

cd /d "%~dp0"
title Gongkao Memory Card

echo.
echo ========================================
echo  Gongkao Memory Card
echo ========================================
echo.

if not exist package.json (
  echo package.json was not found.
  echo Please keep this file in the project root directory.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Please install Node.js 22.12 or newer: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f %%v in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22.12 or newer is required.
  echo Current version:
  node -v
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found.
  echo Please reinstall Node.js or check your PATH.
  echo.
  pause
  exit /b 1
)

if "%~1"=="--check" (
  echo Entry check passed.
  exit /b 0
)

if not exist .env (
  if exist .env.example (
    echo Creating local .env from .env.example...
    copy .env.example .env >nul
  )
)

if not exist node_modules (
  echo Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Please check the npm output above.
    echo.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=@(Get-NetTCPConnection -LocalPort 5173,8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort); if (($ports -contains 5173) -and ($ports -contains 8787)) { exit 10 }; if ($ports -contains 8787) { exit 11 }; exit 0" >nul 2>nul
set "PORT_STATUS=%errorlevel%"
if "%PORT_STATUS%"=="10" (
  echo Development server is already running.
  start "" "http://127.0.0.1:5173"
  exit /b 0
)
if "%PORT_STATUS%"=="11" (
  echo Server is already running.
  start "" "http://127.0.0.1:8787"
  exit /b 0
)

set "NEED_BUILD=0"
if not exist dist-server\index.js set "NEED_BUILD=1"
if not exist dist\client\index.html set "NEED_BUILD=1"

if "%NEED_BUILD%"=="1" (
  echo Building the app for local use...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Build failed. Please check the output above.
    echo.
    pause
    exit /b 1
  )
)

echo Starting the app at http://127.0.0.1:8787
start "Open Gongkao Memory Card" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 4; Start-Process 'http://127.0.0.1:8787'"
echo.
echo Press Ctrl+C in this window to stop the app.
echo.
call npm start

echo.
echo App stopped.
pause
