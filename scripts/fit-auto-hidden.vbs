Option Explicit
Dim shell, command, result, i
If WScript.Arguments.Count <> 2 Then WScript.Quit 2
Set shell = CreateObject("WScript.Shell")
command = ""
For i = 0 To 1
  If InStr(WScript.Arguments(i), Chr(34)) > 0 Then WScript.Quit 2
  If i > 0 Then command = command & " "
  command = command & Chr(34) & WScript.Arguments(i) & Chr(34)
Next
' Wait for Node so Scheduler still tracks completion and prevents overlapping runs.
result = shell.Run(command, 0, True)
WScript.Quit result
