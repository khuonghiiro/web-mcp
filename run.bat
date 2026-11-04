@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto setup
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto setup
if not exist "node_modules\tsx\package.json" goto setup
goto run
:setup
set "WEB_MCP_PREVIOUS_NO_PAUSE=%WEB_MCP_NO_PAUSE%"
set "WEB_MCP_NO_PAUSE=1"
call "%~dp0setup.bat"
set "RESULT=%ERRORLEVEL%"
set "WEB_MCP_NO_PAUSE=%WEB_MCP_PREVIOUS_NO_PAUSE%"
if not "%RESULT%"=="0" goto failed
echo Cài đặt hoàn tất. Vui lòng mở lại run.bat để cập nhật môi trường.
if not defined WEB_MCP_NO_PAUSE call :wait
exit /b 0
:run
node.exe "%~dp0scripts\run.mjs" %*
set "RESULT=%ERRORLEVEL%"
if not defined WEB_MCP_NO_PAUSE call :wait
exit /b %RESULT%
:failed
echo Cài đặt thất bại. Vui lòng xem thông báo lỗi phía trên.
if not defined WEB_MCP_NO_PAUSE call :wait
exit /b 1
:wait
echo Nhấn phím bất kỳ để đóng cửa sổ...
pause >nul
exit /b 0
