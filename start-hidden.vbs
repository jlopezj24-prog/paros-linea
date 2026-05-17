' Lanza backend y frontend SIN ventanas visibles.
' Doble click o pin al menú inicio.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

' Backend: uvicorn sin --reload (más estable en background)
sh.Run "cmd /c """ & root & "\.venv\Scripts\python.exe"" -m uvicorn main:app --host 0.0.0.0 --port 8001 --app-dir """ & root & "\backend""", 0, False

' Frontend: vite dev server
sh.Run "cmd /c cd /d """ & root & "\frontend"" && npm run dev", 0, False

' Abre el navegador después de unos segundos
WScript.Sleep 4000
sh.Run "http://localhost:5173", 1, False
