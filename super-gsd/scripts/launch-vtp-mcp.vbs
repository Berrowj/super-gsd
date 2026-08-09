' Hidden launcher for vtp-mcp-loop.cmd.
' Task Scheduler runs this; it spawns the .cmd with no visible window.
' Voice-Text-Plan is expected at %USERPROFILE%\Voice-Text-Plan; override via
' the VTP_PROJ env var if your sibling project lives elsewhere.
Set sh = CreateObject("WScript.Shell")
proj = sh.ExpandEnvironmentStrings("%VTP_PROJ%")
If proj = "%VTP_PROJ%" Or proj = "" Then
    proj = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\Voice-Text-Plan"
End If
sh.Run "cmd /c """ & proj & "\super-gsd\scripts\vtp-mcp-loop.cmd" & """", 0, False
