' Hidden launcher for vtp-mcp-loop.cmd.
' Task Scheduler runs this; it spawns the .cmd with no visible window.
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c """ & "C:\Users\user\Voice-Text-Plan\super-gsd\scripts\vtp-mcp-loop.cmd" & """", 0, False
