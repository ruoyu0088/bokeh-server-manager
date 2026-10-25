@echo off
setlocal
title Bokeh Server Manager
set "MKL_THREADING_LAYER=TBB"
set "BSM_OPEN_BROWSER=1"
set "BSM_PORT=8010"
set "PYTHON=C:\pixi_env\.pixi\envs\default\python.exe"

cd /d "%~dp0"

if not exist "%PYTHON%" (
    echo Could not find the Python environment:
    echo   %PYTHON%
    echo.
    echo Update PYTHON in start.bat or install the environment described in README.md.
    pause
    exit /b 1
)

echo Starting Bokeh Server Manager at http://127.0.0.1:%BSM_PORT%
echo Press Ctrl+C to stop the manager and all running Bokeh servers.
echo.

"%PYTHON%" -u app.py
if errorlevel 1 pause
