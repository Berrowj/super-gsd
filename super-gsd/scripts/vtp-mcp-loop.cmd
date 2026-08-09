@echo off
REM Restart-on-crash loop for the VTP MCP HTTP server.
REM Invoked by launch-vtp-mcp.vbs (hidden window) which is triggered at logon.

setlocal
REM Voice-Text-Plan project root. Defaults to %USERPROFILE%\Voice-Text-Plan;
REM override via the VTP_PROJ env var if your sibling project lives elsewhere.
if not defined VTP_PROJ set "VTP_PROJ=%USERPROFILE%\Voice-Text-Plan"
set "PROJ=%VTP_PROJ%"
set "LOGDIR=%PROJ%\.planning\logs\services"
set "OUT=%LOGDIR%\vtp-mcp.out.log"
set "ERR=%LOGDIR%\vtp-mcp.err.log"
set "VTP_MCP_TOKEN_FILE=%USERPROFILE%\.vtp\mcp-active-tokens.json"
set "NPX=C:\Program Files\nodejs\npx.cmd"

if not exist "%LOGDIR%" mkdir "%LOGDIR%" 1>nul 2>nul
cd /d "%PROJ%"

:LOOP
echo [%date% %time%] starting vtp-mcp >> "%ERR%"
"%NPX%" tsx src/cli.ts mcp --transport http --host 127.0.0.1 --port 4101 1>>"%OUT%" 2>>"%ERR%"
echo [%date% %time%] vtp-mcp exited with errorlevel %errorlevel% restarting in 5s >> "%ERR%"
timeout /t 5 /nobreak >nul
goto LOOP
