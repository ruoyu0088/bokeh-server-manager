@echo off
setlocal EnableExtensions
title Bokeh Server Manager
set "MKL_THREADING_LAYER=TBB"
if not defined BSM_OPEN_BROWSER set "BSM_OPEN_BROWSER=1"
if not defined BSM_PORT set "BSM_PORT=8010"
if not defined BSM_HOST set "BSM_HOST=127.0.0.1"
set "BSM_WEB=0"
set "BSM_SET_PASSWORD=0"
set "BSM_HOST_SET=0"
set "USAGE_EXIT=1"
set "PYTHON=C:\pixi_env\.pixi\envs\default\python.exe"

cd /d "%~dp0"

:parse_args
if "%~1"=="" goto args_ready
if /I "%~1"=="--web" goto arg_web
if /I "%~1"=="--set-password" goto arg_set_password
if /I "%~1"=="--port" goto arg_port
if /I "%~1"=="-p" goto arg_port
if /I "%~1"=="--host" goto arg_host
if /I "%~1"=="--help" goto help
if /I "%~1"=="/?" goto help
echo Unknown argument: %~1
echo.
goto usage

:arg_web
set "BSM_WEB=1"
shift
goto parse_args

:arg_set_password
set "BSM_SET_PASSWORD=1"
shift
goto parse_args

:arg_port
if "%~2"=="" goto missing_value
set "BSM_PORT=%~2"
shift
shift
goto parse_args

:arg_host
if "%~2"=="" goto missing_value
set "BSM_HOST=%~2"
set "BSM_HOST_SET=1"
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
echo Usage: start.bat [--web] [--set-password] [--port PORT] [--host HOST]
echo.
echo   --web           Enable single-password web login.
echo   --set-password  Set the web password (requires --web).
echo   --port PORT     Manager port. Default: 8010
echo   --host HOST     Bind address. Default: 127.0.0.1
echo                   LAN access requires an explicit 0.0.0.0.
echo.
echo Examples:
echo   start.bat
echo   start.bat --web
echo   start.bat --web --set-password
echo   start.bat --web --port 8010 --host 0.0.0.0
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

if /I "%BSM_SET_PASSWORD%"=="1" goto do_set_password
if /I "%BSM_WEB%"=="1" goto do_web
goto do_default

:do_set_password
if /I not "%BSM_WEB%"=="1" (
    echo --set-password requires --web.
    echo Run: start.bat --web --set-password
    echo.
    pause
    exit /b 1
)
"%PYTHON%" -u web_auth.py --set-password
set "PASSWORD_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %PASSWORD_RESULT%

:do_web
if /I not "%BSM_HOST_SET%"=="1" set "BSM_HOST=127.0.0.1"
if /I "%BSM_HOST%"=="0.0.0.0" (
    set "START_URL=http://127.0.0.1:%BSM_PORT%"
) else (
    set "START_URL=http://%BSM_HOST%:%BSM_PORT%"
)
echo Starting Bokeh Server Manager in web mode at %START_URL%
if /I "%BSM_HOST%"=="0.0.0.0" (
    echo WARNING: the web service is exposed to the LAN over plain HTTP.
    echo          Traffic is not encrypted. Use only a trusted network.
    echo          Login protects the manager UI/API, not child app ports.
    echo          Open http://YOUR-COMPUTER-IP:%BSM_PORT% from another computer.
) else if /I not "%BSM_HOST%"=="127.0.0.1" if /I not "%BSM_HOST%"=="localhost" if /I not "%BSM_HOST%"=="::1" (
    echo WARNING: binding to %BSM_HOST% may expose the web service to your local network.
    echo          Traffic is not encrypted. Use only a trusted network.
)
echo Press Ctrl+C to stop the manager and all running Bokeh/Panel servers.
echo.
"%PYTHON%" -u app.py --web
set "WEB_RESULT=%ERRORLEVEL%"
if not "%WEB_RESULT%"=="0" pause
exit /b %WEB_RESULT%

:do_default
if /I not "%BSM_HOST_SET%"=="1" set "BSM_HOST=127.0.0.1"
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
echo Press Ctrl+C to stop the manager and all running Bokeh/Panel servers.
echo.

"%PYTHON%" -u app.py
set "APP_RESULT=%ERRORLEVEL%"
if not "%APP_RESULT%"=="0" pause
exit /b %APP_RESULT%
