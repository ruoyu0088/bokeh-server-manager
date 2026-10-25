@echo off
setlocal EnableExtensions
title Bokeh Server Manager
set "MKL_THREADING_LAYER=TBB"
if not defined BSM_OPEN_BROWSER set "BSM_OPEN_BROWSER=1"
if not defined BSM_PORT set "BSM_PORT=8010"
if not defined BSM_HOST set "BSM_HOST=127.0.0.1"
set "USAGE_EXIT=1"
set "PYTHON=C:\pixi_env\.pixi\envs\default\python.exe"

cd /d "%~dp0"

:parse_args
if "%~1"=="" goto args_ready
if /I "%~1"=="--port" goto arg_port
if /I "%~1"=="-p" goto arg_port
if /I "%~1"=="--host" goto arg_host
if /I "%~1"=="--help" goto help
if /I "%~1"=="/?" goto help
echo Unknown argument: %~1
echo.
goto usage

:arg_port
if "%~2"=="" goto missing_value
set "BSM_PORT=%~2"
shift
shift
goto parse_args

:arg_host
if "%~2"=="" goto missing_value
set "BSM_HOST=%~2"
shift
shift
goto parse_args

:missing_value
echo Missing value for %~1.
echo.
goto usage

:help
set "USAGE_EXIT=0"
:usage
echo Usage: start.bat [--port PORT] [--host HOST]
echo.
echo   --port PORT   Manager port. Default: 8010
echo   --host HOST   Bind address. Default: 127.0.0.1
echo                 Use 0.0.0.0 to allow access from other computers.
echo.
echo Examples:
echo   start.bat
echo   start.bat --port 8080
echo   start.bat --port 8010 --host 0.0.0.0
exit /b %USAGE_EXIT%

:args_ready
if not exist "%PYTHON%" (
    echo Could not find the Python environment:
    echo   %PYTHON%
    echo.
    echo Update PYTHON in start.bat or install the environment described in README.md.
    pause
    exit /b 1
)

if /I "%BSM_HOST%"=="0.0.0.0" (
    set "START_URL=http://127.0.0.1:%BSM_PORT%"
) else (
    set "START_URL=http://%BSM_HOST%:%BSM_PORT%"
)
echo Starting Bokeh Server Manager at %START_URL%
if /I "%BSM_HOST%"=="0.0.0.0" (
    echo WARNING: binding to 0.0.0.0 exposes the manager to your local network.
    echo          It has no authentication and can edit local files and run code.
    echo          Open http://YOUR-COMPUTER-IP:%BSM_PORT% from another computer.
) else if /I not "%BSM_HOST%"=="127.0.0.1" if /I not "%BSM_HOST%"=="localhost" if /I not "%BSM_HOST%"=="::1" (
    echo WARNING: binding to %BSM_HOST% may expose the manager to your local network.
    echo          It has no authentication and can edit local files and run code.
)
echo Press Ctrl+C to stop the manager and all running Bokeh servers.
echo.

"%PYTHON%" -u app.py
if errorlevel 1 pause
