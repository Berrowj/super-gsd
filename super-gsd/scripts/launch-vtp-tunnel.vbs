' Hidden launcher for vtp-tunnel-loop.cmd.
' Voice-Text-Plan is expected at %USERPROFILE%\Voice-Text-Plan; override via
' the VTP_PROJ env var if your sibling project lives elsewhere.
Set sh = CreateObject("WScript.Shell")
proj = sh.ExpandEnvironmentStrings("%VTP_PROJ%")
If proj = "%VTP_PROJ%" Or proj = "" Then
    proj = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\Voice-Text-Plan"
End If
sh.Run "cmd /c """ & proj & "\super-gsd\scripts\vtp-tunnel-loop.cmd" & """", 0, False
