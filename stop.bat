@echo off
REM Detiene backend (8001) y frontend (5173)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Servicios detenidos.
timeout /t 2 >nul
