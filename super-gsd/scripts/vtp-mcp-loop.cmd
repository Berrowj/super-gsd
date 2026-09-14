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
REM Pinned BGE provider pair; both values enable semantic warm-up before transport.
set "VTP_EVIDENCE_STORE_URL=sqlite:%PROJ%\.tmp\evidence-phase04-semantic.sqlite"
set "VTP_EVIDENCE_EMBEDDING_PYTHON=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
set "VTP_EVIDENCE_EMBEDDING_MODEL_PATH=%USERPROFILE%\.cache\huggingface\hub\models--BAAI--bge-base-en-v1.5\snapshots\a5beb1e3e68b9ab74eb54cfd186867f64f240e1a"
set "NPX=C:\Program Files\nodejs\npx.cmd"

if not exist "%LOGDIR%" mkdir "%LOGDIR%" 1>nul 2>nul
cd /d "%PROJ%"

:LOOP
echo [%date% %time%] starting vtp-mcp >> "%ERR%"
call "%NPX%" tsx src/cli.ts mcp --transport http --host 127.0.0.1 --port 4101 1>>"%OUT%" 2>>"%ERR%"
echo [%date% %time%] vtp-mcp exited with errorlevel %errorlevel% restarting in 5s >> "%ERR%"
timeout /t 5 /nobreak >nul
goto LOOP
