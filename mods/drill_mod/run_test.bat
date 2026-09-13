@echo off
title Minecraft 1.21.11 - Drill Mod Testing
cd /d "%~dp0"
set "JAVA_HOME=C:\Users\geg\AppData\Roaming\.minecraft\runtime\windows-x64\java-runtime-delta"
echo =========================================================
echo Launching Minecraft 1.21.11 with Drill Mod
echo =========================================================
call gradlew.bat runClient
pause
