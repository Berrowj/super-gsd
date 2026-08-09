@echo off
REM Restart-on-crash loop for the VTP MCP tunnel supervisor.
REM Invoked by launch-vtp-tunnel.vbs (hidden window) which is triggered at logon.
REM Waits for MCP to be listening before starting ssh, so the tunnel does not
REM thrash if the MCP server is slow to come up.

setlocal
REM Voice-Text-Plan project root. Defaults to %USERPROFILE%\Voice-Text-Plan;
REM override via the VTP_PROJ env var if your sibling project lives elsewhere.
if not defined VTP_PROJ set "VTP_PROJ=%USERPROFILE%\Voice-Text-Plan"
set "PROJ=%VTP_PROJ%"
set "LOGDIR=%PROJ%\.planning\logs\services"
set "OUT=%LOGDIR%\vtp-tunnel.out.log"
set "ERR=%LOGDIR%\vtp-tunnel.err.log"
set "VTP_MCP_TOKEN_FILE=%USERPROFILE%\.vtp\mcp-active-tokens.json"
set "NODE=C:\Program Files\nodejs\node.exe"
set "SUPERVISOR=%PROJ%\super-gsd\scripts\vtp-tunnel-supervisor.cjs"

if not exist "%LOGDIR%" mkdir "%LOGDIR%" 1>nul 2>nul
cd /d "%PROJ%"

REM Wait briefly for MCP to start listening on 4101 before the first ssh attempt.
echo [%date% %time%] waiting up to 60s for MCP on 127.0.0.1:4101 >> "%ERR%"
for /L %%i in (1,1,30) do (
  netstat -an | findstr /R /C:"127.0.0.1:4101 .*LISTENING" >nul && goto MCP_UP
  timeout /t 2 /nobreak >nul
)
echo [%date% %time%] WARN: MCP did not appear in 60s, starting tunnel anyway >> "%ERR%"

:MCP_UP
:LOOP
echo [%date% %time%] starting vtp-tunnel-supervisor >> "%ERR%"
"%NODE%" "%SUPERVISOR%" 1>>"%OUT%" 2>>"%ERR%"
echo [%date% %time%] supervisor exited with errorlevel %errorlevel% restarting in 5s >> "%ERR%"
timeout /t 5 /nobreak >nul
goto LOOP
