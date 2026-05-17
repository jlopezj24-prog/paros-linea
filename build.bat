@echo off
REM === Build de producción ===
REM Ejecutar UNA vez (y cada vez que cambies el frontend).
setlocal
set ROOT=%~dp0

echo [1/3] Verificando venv...
if not exist "%ROOT%.venv\Scripts\python.exe" (
    python -m venv "%ROOT%.venv"
)

echo [2/3] Instalando dependencias backend...
call "%ROOT%.venv\Scripts\python.exe" -m pip install -q -r "%ROOT%backend\requirements.txt"

echo [3/3] Build frontend...
cd /d "%ROOT%frontend"
if not exist node_modules ( call npm install )
call npm run build

echo.
echo OK. Ahora ejecuta start-prod.bat (o instala como servicio NSSM).
endlocal
pause
