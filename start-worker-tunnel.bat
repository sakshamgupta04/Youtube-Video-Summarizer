@echo off
title EchoNotes AI Worker + Cloudflare Tunnel
echo ===================================================
echo   EchoNotes AI Worker + Cloudflare Public Tunnel
echo ===================================================
echo.

cd /d "%~dp0\worker"
echo [1/2] Starting Python AI Worker on port 8000...
start "EchoNotes Worker" /min cmd /c "..\worker\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 3 >nul

cd /d "%~dp0"
echo [2/2] Starting Cloudflare Tunnel to port 8000...
echo.
echo Your public tunnel URL will appear below:
echo ===================================================
tools\cloudflared.exe tunnel --url http://localhost:8000
pause
