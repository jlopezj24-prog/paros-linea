' Arranque oculto en MODO PRODUCCIÓN.
' Un solo proceso: FastAPI sirve API + frontend en http://localhost:8001
' Requiere haber ejecutado build.bat al menos una vez.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

sh.CurrentDirectory = root & "\backend"
sh.Run "cmd /c """ & root & "\.venv\Scripts\python.exe"" -m uvicorn main:app --host 0.0.0.0 --port 8001", 0, False

WScript.Sleep 3500
sh.Run "http://localhost:8001", 1, False
