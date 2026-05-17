@echo off
REM === Instala la app como servicio Windows usando NSSM ===
REM Requisitos:
REM   1) Haber ejecutado build.bat (genera .venv y frontend/dist)
REM   2) Descargar nssm.exe desde https://nssm.cc/download y ponerlo en PATH o en esta carpeta
REM   3) Ejecutar ESTE script como Administrador (clic derecho > Ejecutar como administrador)

setlocal
set ROOT=%~dp0
set SVC=ParosLinea
set PY=%ROOT%.venv\Scripts\python.exe
set NSSM=nssm.exe
where %NSSM% >nul 2>&1
if errorlevel 1 (
    if exist "%ROOT%nssm.exe" ( set NSSM=%ROOT%nssm.exe ) else (
        echo ERROR: nssm.exe no encontrado. Descargalo de https://nssm.cc/download y colocalo aqui o en PATH.
        pause & exit /b 1
    )
)

echo Deteniendo servicio previo si existe...
%NSSM% stop %SVC% >nul 2>&1
%NSSM% remove %SVC% confirm >nul 2>&1

echo Instalando servicio %SVC%...
%NSSM% install %SVC% "%PY%" "-m uvicorn main:app --host 0.0.0.0 --port 8001"
%NSSM% set %SVC% AppDirectory "%ROOT%backend"
%NSSM% set %SVC% Start SERVICE_AUTO_START
%NSSM% set %SVC% AppStdout "%ROOT%backend\service.log"
%NSSM% set %SVC% AppStderr "%ROOT%backend\service.err.log"
%NSSM% set %SVC% AppRotateFiles 1
%NSSM% set %SVC% AppRotateBytes 5242880
%NSSM% set %SVC% Description "Paros de Linea digital - API + Frontend"

echo Iniciando servicio...
%NSSM% start %SVC%

timeout /t 3 >nul
sc query %SVC%

echo.
echo Servicio instalado. URL: http://localhost:8001
echo Para gestionarlo: services.msc  o  nssm edit %SVC%
echo Para desinstalar:  nssm remove %SVC% confirm
endlocal
pause
