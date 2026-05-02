@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  lagaao.com - Start All Services
::  Double-click this file OR run:  .\start.bat
:: ============================================================

title lagaao.com Launcher

:: ── Colour codes for Windows console ────────────────────────
:: (used via FIND to colour the launcher window itself)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "CYAN=[96m"
set "WHITE=[97m"
set "BOLD=[1m"
set "RESET=[0m"

cls
echo.
echo %CYAN%  =================================================%RESET%
echo %CYAN%  ^|                                               ^|%RESET%
echo %CYAN%  ^|   %BOLD%%WHITE%lagaao.com%RESET%%CYAN%  - Starting All Services         ^|%RESET%
echo %CYAN%  ^|                                               ^|%RESET%
echo %CYAN%  =================================================%RESET%
echo.

:: ── Resolve the root folder (where this .bat lives) ─────────
set "ROOT=%~dp0"
:: Remove trailing backslash
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo %WHITE%  Project root: %YELLOW%%ROOT%%RESET%
echo.

:: ============================================================
::  STEP 1 — Check MySQL80 is running
:: ============================================================
echo %WHITE%  [1/3] Checking MySQL...%RESET%

sc query MySQL80 | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%  MySQL80 is not running. Attempting to start it...%RESET%
    net start MySQL80 >nul 2>&1
    if %errorlevel% neq 0 (
        echo %RED%  ERROR: Could not start MySQL80.%RESET%
        echo %RED%  Please start MySQL manually from Services or MySQL Workbench.%RESET%
        echo.
        pause
        exit /b 1
    )
    echo %GREEN%  MySQL80 started successfully.%RESET%
) else (
    echo %GREEN%  MySQL80 is running.%RESET%
)

:: ============================================================
::  STEP 2 — Check Node.js is available
:: ============================================================
echo %WHITE%  [2/3] Checking Node.js...%RESET%

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ERROR: Node.js not found in PATH.%RESET%
    echo %RED%  Install from https://nodejs.org%RESET%
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo %GREEN%  Node.js %NODE_VER% found.%RESET%

:: ============================================================
::  STEP 3 — Launch each service in its own colour-titled window
:: ============================================================
echo %WHITE%  [3/3] Launching services...%RESET%
echo.

:: Each START command:
::   /D  = working directory for that window
::   /MIN = start minimised (remove if you want them visible)
::   The title appears in the taskbar and in stop.bat's TASKKILL filter

:: ── Auth Service  :3001  (Green) ────────────────────────────
echo %GREEN%  Starting  AUTH SERVICE       → http://localhost:3001%RESET%
start "lagaao - AUTH :3001" /D "%ROOT%\backend\services\auth-service" cmd /k ^
    "title lagaao - AUTH :3001 && color 2F && echo. && echo   [AUTH SERVICE - PORT 3001] && echo. && npm run start:dev"

:: ── Product Service  :3002  (Magenta) ───────────────────────
echo %WHITE%  Starting  PRODUCT SERVICE    → http://localhost:3002%RESET%
start "lagaao - PRODUCT :3002" /D "%ROOT%\backend\services\product-service" cmd /k ^
    "title lagaao - PRODUCT :3002 && color 5F && echo. && echo   [PRODUCT SERVICE - PORT 3002] && echo. && npm run start:dev"

:: ── Cart Service  :3003  (Cyan) ─────────────────────────────
echo %CYAN%  Starting  CART SERVICE       → http://localhost:3003%RESET%
start "lagaao - CART :3003" /D "%ROOT%\backend\services\cart-service" cmd /k ^
    "title lagaao - CART :3003 && color 3F && echo. && echo   [CART SERVICE - PORT 3003] && echo. && npm run start:dev"

:: ── Order Service  :3004  (Yellow) ──────────────────────────
echo %YELLOW%  Starting  ORDER SERVICE      → http://localhost:3004%RESET%
start "lagaao - ORDER :3004" /D "%ROOT%\backend\services\order-service" cmd /k ^
    "title lagaao - ORDER :3004 && color 6F && echo. && echo   [ORDER SERVICE - PORT 3004] && echo. && npm run start:dev"

:: ── Payment Service  :3005  (Red) ───────────────────────────
echo %RED%  Starting  PAYMENT SERVICE    → http://localhost:3005%RESET%
start "lagaao - PAYMENT :3005" /D "%ROOT%\backend\services\payment-service" cmd /k ^
    "title lagaao - PAYMENT :3005 && color 4F && echo. && echo   [PAYMENT SERVICE - PORT 3005] && echo. && npm run start:dev"

:: ── API Gateway  :4000  (Blue) ──────────────────────────────
echo %WHITE%  Starting  API GATEWAY       → http://localhost:4000%RESET%
start "lagaao - GATEWAY :4000" /D "%ROOT%\backend\api-gateway" cmd /k ^
    "title lagaao - GATEWAY :4000 && color 1F && echo. && echo   [API GATEWAY - PORT 4000] && echo. && npm run start:dev"

:: ── Frontend  :3000  (White/bright) ─────────────────────────
echo %WHITE%  Starting  FRONTEND (Next.js) → http://localhost:3000%RESET%
start "lagaao - FRONTEND :3000" /D "%ROOT%\frontend" cmd /k ^
    "title lagaao - FRONTEND :3000 && color 07 && echo. && echo   [NEXT.JS FRONTEND - PORT 3000] && echo. && npm run dev"

:: ============================================================
::  Wait for services to boot, then open the browser
:: ============================================================
echo.
echo %CYAN%  =================================================%RESET%
echo %CYAN%  All 7 windows launched!%RESET%
echo.
echo %WHITE%  Waiting 20 seconds for services to boot...%RESET%
echo %WHITE%  (You can watch each window - NestJS takes ~10s)%RESET%
echo %CYAN%  =================================================%RESET%
echo.

:: Countdown display
for /L %%i in (20,-1,1) do (
    <nul set /p =  "  Opening browser in %%i seconds...   "
    echo.
    timeout /t 1 /nobreak >nul
    :: Move cursor up one line to overwrite (works in modern Windows Terminal)
    <nul set /p ="[1A"
)

echo   Opening http://localhost:3000 ...
echo.
start "" "http://localhost:3000"

echo.
echo %GREEN%  =================================================%RESET%
echo %GREEN%  lagaao.com is running!%RESET%
echo.
echo %WHITE%  URLs:%RESET%
echo %CYAN%    Frontend  → http://localhost:3000%RESET%
echo %CYAN%    Gateway   → http://localhost:4000%RESET%
echo %CYAN%    API Docs  → http://localhost:4000/api/docs%RESET%
echo %CYAN%    Health    → http://localhost:4000/health%RESET%
echo.
echo %YELLOW%  To stop everything: run stop.bat%RESET%
echo %GREEN%  =================================================%RESET%
echo.
pause
