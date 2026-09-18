@echo off
title Build Remote Task Manager (Server & Client EXEs)
cd /d "%~dp0"
echo ===================================================
echo   Building Remote Task Manager Executables
echo ===================================================
echo.

echo [1/3] Ensuring dependencies and closing old instances...
powershell -Command "Stop-Process -Name RemoteTaskManager* -Force -ErrorAction SilentlyContinue"
python -m pip install psutil pyinstaller tkinterdnd2 opencv-python numpy

echo.
echo [2/3] Compiling Server Host Executable (Zero-Dependency Native Fullscreen Player)...
python build_server.py

echo.
echo [3/3] Compiling Client Dashboard Executable...
python -m PyInstaller --onefile --noconsole --name "RemoteTaskManagerClient" --collect-all "tkinterdnd2" --distpath "dist" --workpath "build_temp\client" --specpath "build_temp\client" client\client_app.py

echo.
echo Copying executables to respective component folders...
if exist "dist\RemoteTaskManagerServer.exe" copy /y "dist\RemoteTaskManagerServer.exe" "server\RemoteTaskManagerServer.exe"
if exist "dist\RemoteTaskManagerClient.exe" copy /y "dist\RemoteTaskManagerClient.exe" "client\RemoteTaskManagerClient.exe"

echo.
echo ===================================================
echo   BUILD COMPLETE!
echo   Server EXE: server\RemoteTaskManagerServer.exe
echo   Client EXE: client\RemoteTaskManagerClient.exe
echo   Combined:   dist\
echo ===================================================
pause
