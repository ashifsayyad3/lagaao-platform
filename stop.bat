@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  lagaao.com - Stop All Services
::  Double-click OR run:  .\stop.bat
:: ============================================================

title lagaao.com - Stopping Services

set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "CYAN=[96m"
set "WHITE=[97m"
set "BOLD=[1m"
set "RESET=[0m"

cls
echo.
echo %RED%  =================================================%RESET%
echo %RED%  ^|                                               ^|%RESET%
echo %RED%  ^|   %BOLD%%WHITE%lagaao.com%RESET%%RED%  - Stopping All Services         ^|%RESET%
echo %RED%  ^|                                               ^|%RESET%
echo %RED%  =================================================%RESET%
echo.

:: ============================================================
::  Kill every cmd.exe window whose title starts with "lagaao -"
::  TASKKILL /FI filters by window title; /F forces; /T kills
::  the whole process tree (so node.exe children die too)
:: ============================================================

echo %WHITE%  Closing service windows...%RESET%
echo.

set "KILLED=0"

:: Use WMIC to find cmd.exe windows with our title prefix and kill them
for /f "tokens=2 delims=," %%P in (
    'wmic process where "name='cmd.exe'" get processid^,commandline /format:csv 2^>nul ^| findstr /i "lagaao -"'
) do (
    set /a "KILLED+=1"
    taskkill /PID %%P /T /F >nul 2>&1
    echo %RED%  Stopped PID %%P%RESET%
)

echo.

:: Also kill any orphaned node.exe processes on our specific ports
echo %WHITE%  Releasing ports 3000-3005 and 4000...%RESET%
echo.

for %%P in (3000 3001 3002 3003 3004 3005 4000) do (
    for /f "tokens=5" %%X in (
        'netstat -aon 2^>nul ^| findstr ":%%P " ^| findstr "LISTENING"'
    ) do (
        if not "%%X"=="" (
            taskkill /PID %%X /T /F >nul 2>&1
            echo %RED%  Freed port %%P  ^(PID %%X^)%RESET%
        )
    )
)

echo.
echo %GREEN%  =================================================%RESET%
echo %GREEN%  All lagaao services stopped.%RESET%
echo %GREEN%  =================================================%RESET%
echo.

:: Ask whether to also stop MySQL
echo %YELLOW%  Stop MySQL80 service as well? (y/N)%RESET%
set /p "STOP_MYSQL=  > "
if /i "!STOP_MYSQL!"=="y" (
    echo.
    echo %YELLOW%  Stopping MySQL80...%RESET%
    net stop MySQL80 >nul 2>&1
    if !errorlevel! equ 0 (
        echo %GREEN%  MySQL80 stopped.%RESET%
    ) else (
        echo %YELLOW%  MySQL80 could not be stopped (may need admin rights).%RESET%
    )
)

echo.
pause
