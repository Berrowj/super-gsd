@echo off
REM Restart-on-crash loop for the VTP MCP HTTP server.
REM Invoked by launch-vtp-mcp.vbs (hidden window) which is triggered at logon.

setlocal
set "PROJ=C:\Users\jack.berrow\Voice-Text-Plan"
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
