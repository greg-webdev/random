@echo off
title Remote Task Manager - Server Agent
cd /d "%~dp0"
echo ===================================================
echo   Starting Remote Task Manager Server Agent
echo   Default port: 8888
echo   Default token: remoteadmin123
echo ===================================================
echo.
python server.py --host 0.0.0.0 --port 8888 --token remoteadmin123
pause
