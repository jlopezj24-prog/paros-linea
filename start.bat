@echo off
REM Arranque local: backend (8001) + frontend (5173)
setlocal
set ROOT=%~dp0
echo === Paros de Linea digital ===

REM --- Backend ---
if not exist "%ROOT%.venv\Scripts\python.exe" (
    echo Creando entorno virtual...
    python -m venv "%ROOT%.venv"
)
echo Instalando/actualizando dependencias de backend...
call "%ROOT%.venv\Scripts\python.exe" -m pip install -q -r "%ROOT%backend\requirements.txt"

echo Lanzando backend (puerto 8001)...
start "Backend - Paros" cmd /k "cd /d %ROOT%backend && %ROOT%.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

REM --- Frontend ---
cd /d "%ROOT%frontend"
if not exist node_modules (
    echo Instalando dependencias de frontend...
    call npm install
)
start "Frontend - Paros" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo Backend:  http://localhost:8001/docs
echo Frontend: http://localhost:5173
echo.
endlocal
