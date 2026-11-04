@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
set "RESULT=%ERRORLEVEL%"
if not defined WEB_MCP_NO_PAUSE pause
exit /b %RESULT%
